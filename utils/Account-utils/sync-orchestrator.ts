import { CalendarEvent } from "@/types/calendar";
import { Habit } from "@/types/habits";
import { Task } from "@/types/task";
import {
  pushCategories, pushTags, pushTasks, pushHabits, pushEvents, pushLogs,
  pushUnlockedAchievements, pushDailyMetrics, pushGlobalMetrics,
  pullCategories, pullTags, pullTasks, pullHabits, pullEvents, pullLogs,
  pullUnlockedAchievements, pullDailyMetrics, pullGlobalMetrics,
  pushDailyAIMetrics,
  pushGlobalAIMetrics,
  pushAchievementMetrics,
  pullDailyAIMetrics,
  pullGlobalAIMetrics,
  pullAchievementMetrics,
  persistReconciledNotificationIds
} from "./sync-engine";
import { supabase } from "./supabase-client";
import { reconcileNotificationsForPulledData } from "./reconcile-notifications";
import { NotificationRescheduleChoice } from "@/components/modal/notificaiton-reschedule-modal";
import { Category } from "@/types/category";
import { dumpForeignKeys } from "@/components/dev/db-error-diagnosis-helper";

type SyncRunOptions = {
  userId: string;
  lastPulledAt: string | null;
  onSuccess?: (completedAt: string) => Promise<void> | void;
  onPulled?: (data: {
    tasks: Task[];
    habits: Habit[];
    events: CalendarEvent[];
  }) => Promise<void> | void;
};

let syncPromise: Promise<void> | null = null;

async function withJwtSkewRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isClockSkewError =
        err?.code === "PGRST303" ||
        String(err?.message ?? "").toLowerCase().includes("jwt issued at future");
      console.log("Caught Clock skew error?", isClockSkewError);
      if (!isClockSkewError || attempt === maxAttempts - 1) throw err;
      console.log("Clock skew error, retrying...", attempt + 1, "of", maxAttempts);
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw new Error("unreachable");
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[sync] step "${name}" failed:`, err);
    throw err;
  }
}

async function getServerTimeStamp() {
  // This is a server timestamp, not the device clock. Incremental pull
  // functions must query server_updated_at > since AND <= watermark.
  let data: unknown;
  try {
    data = await withJwtSkewRetry(async () => {
      const { data, error } = await supabase.rpc("get_sync_watermark" as any);
      // Throw INSIDE the retry wrapper so JWT-skew errors can be retried.
      if (error) throw error;
      return data;
    });
  } catch (error) {
    console.error("[Sync] Failed to obtain server pull watermark:", error);
    throw error;
  }

  // get_sync_watermark() currently returns a scalar timestamptz. The other
  // shapes are tolerated if the RPC is later changed to return a named row.
  let watermark: unknown = data;
  if (Array.isArray(data)) {
    watermark = data[0]?.watermark ?? data[0]?.get_sync_watermark;
  } else if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    watermark = row.watermark ?? row.get_sync_watermark;
  }

  if (typeof watermark !== "string" || !Number.isFinite(Date.parse(watermark))) {
    throw new Error(
      `[Sync] get_sync_watermark() returned an invalid timestamp: ${String(watermark)}`,
    );
  }

  return watermark;

}
export function runFullSync(options: SyncRunOptions): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = runFullSyncInternal(options).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
/**
// [
  "5535c7cc-b8f4-45e0-be20-c87defc36f1d",
  "2da40892-d5c7-4253-90af-7dac8f944879",
  "0802b642-b200-4b93-8847-8dc27e68efa6"


  9883abca-53db-4763-affe-24379a837664

   "5535c7cc-b8f4-45e0-be20-c87defc36f1d",
  "2da40892-d5c7-4253-90af-7dac8f944879",
  "0802b642-b200-4b93-8847-8dc27e68efa6"
 */
async function runFullSyncInternal({
  userId,
  lastPulledAt,
  onSuccess,
  onPulled,
}: SyncRunOptions): Promise<void> {
  const since = lastPulledAt ?? "1970-01-01T00:00:00.000Z";
  console.log(`[INTERNAL SYNC] Syncing from ${since}`);
  // Parents first because child rows reference them.

  await pushToCloud(userId);

  await pullFromCloud({ userId, lastPulledAt: since, onSuccess, onPulled });


}

export const pushToCloud = async (userId: string) => {
  console.log("Pushing Data to Cloud for user with id", userId);
  await withJwtSkewRetry(() => pushCategories(userId));
  await withJwtSkewRetry(() => pushTags(userId));

  await withJwtSkewRetry(() => pushTasks(userId));
  await withJwtSkewRetry(() => pushHabits(userId));
  await withJwtSkewRetry(() => pushEvents(userId));
  await withJwtSkewRetry(() => pushLogs(userId));

  await withJwtSkewRetry(() => pushUnlockedAchievements(userId));
  await withJwtSkewRetry(() => pushDailyMetrics(userId));
  await withJwtSkewRetry(() => pushGlobalMetrics(userId));
  await withJwtSkewRetry(() => pushDailyAIMetrics(userId));
  await withJwtSkewRetry(() => pushGlobalAIMetrics(userId));
  await withJwtSkewRetry(() => pushAchievementMetrics(userId));
}

export const pushEntitiesOnly = async (userId: string) => {
  await withJwtSkewRetry(() => pushTasks(userId));
  await withJwtSkewRetry(() => pushHabits(userId));
  await withJwtSkewRetry(() => pushEvents(userId));
  await withJwtSkewRetry(() => pushLogs(userId));
}
export const pullFromCloud = async ({
  userId,
  lastPulledAt,
  onSuccess,
  onPulled,
}: SyncRunOptions) => {
  const since = lastPulledAt ?? "1970-01-01T00:00:00.000Z";

  const watermark = await getServerTimeStamp();
  console.log('Pulling Data from Cloud. It was last synced at ', since, "server timestamp ", watermark)
  /* const midPullChangesCategory = await withJwtSkewRetry(() => pullCategories(userId, since, watermark));
  const midPullChangesCategory = await withJwtSkewRetry(() => pullTags(userId, since, watermark)) */;
  /*  const [midPullChangeViaCategory, midPullChangesViaTag, pulledTasks, pulledHabits, pulledEvents] = await Promise.all([
     withJwtSkewRetry(() => pullCategories(userId, since, watermark)),
     //console.log("Pulled cat, tag , tasks, habits, events"),
     withJwtSkewRetry(() => pullTags(userId, since, watermark)),
     withJwtSkewRetry(() => pullTasks(userId, since, watermark)),
     withJwtSkewRetry(() => pullHabits(userId, since, watermark)),
     withJwtSkewRetry(() => pullEvents(userId, since, watermark)),
   ]); */
  const midPullChangeViaCategory = await step("pullCategories", () => pullCategories(userId, since, watermark));
  console.log("Pulled cat");
  const midPullChangesViaTag = await step("pullTags", () => pullTags(userId, since, watermark));
  console.log("Pulled tag");
  const pulledTasks = await step("pullTasks", () => pullTasks(userId, since, watermark));
  console.log("Pulled tasks");
  const pulledHabits = await step("pullHabits", () => pullHabits(userId, since, watermark));
  console.log("Pulled habits");
  const pulledEvents = await step("pullEvents", () => pullEvents(userId, since, watermark));
  console.log("Pulled cat, tag , tasks, habits, events");
  await withJwtSkewRetry(() => pullLogs(userId, since, watermark));
  console.log("Pulled logs");
  await withJwtSkewRetry(() => pullUnlockedAchievements(userId));
  console.log("Pulled unlocked achievements");
  await withJwtSkewRetry(() => pullDailyMetrics(userId, since, watermark));
  console.log("Pulled daily metrics");
  await withJwtSkewRetry(() => pullGlobalMetrics(userId));
  console.log("Pulled global metrics");
  await withJwtSkewRetry(() => pullDailyAIMetrics(userId, since, watermark));
  console.log("Pulled daily ai metrics");
  await withJwtSkewRetry(() => pullGlobalAIMetrics(userId));
  console.log("Pulled global ai metrics");
  await withJwtSkewRetry(() => pullAchievementMetrics(userId));
  console.log("Pulled achievement metrics");

  await dumpForeignKeys();
  if (midPullChangeViaCategory || midPullChangesViaTag) {
    await pushEntitiesOnly(userId);
  }

  await onPulled?.({
    tasks: pulledTasks,
    habits: pulledHabits,
    events: pulledEvents,
  });

  await onSuccess?.(watermark);
}

export async function deleteAllCloudDataForUser(userId: string): Promise<void> {
  const tables = [
    "categories", "tags", "tasks", "habits", "calendar_events",
    "timer_logs", "unlocked_achievements",
    "global_metrics", "daily_metrics", "global_metrics_ai",
    "daily_metrics_ai", "achievement_global_metrics",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[replaceCloud] Failed to delete ${table}:`, error);
      throw error;
    }
  }
}

export async function runSelectiveNotificationReschedule(
  data: { tasks: Task[]; habits: Habit[]; events: CalendarEvent[] },
  choice: NotificationRescheduleChoice,
): Promise<void> {
  await reconcileNotificationsForPulledData(data, {
    rescheduleTasks: choice.tasks,
    rescheduleHabits: choice.habits,
    rescheduleEvents: choice.events,
  });

  await persistReconciledNotificationIds(data);
}


