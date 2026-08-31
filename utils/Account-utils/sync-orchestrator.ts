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

      if (!isClockSkewError || attempt === maxAttempts - 1) throw err;

      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  throw new Error("unreachable");
}

export function runFullSync(options: SyncRunOptions): Promise<void> {
  if (syncPromise) return syncPromise;

  syncPromise = runFullSyncInternal(options).finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}

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
  
 await pullFromCloud({ userId, lastPulledAt, onSuccess, onPulled });

 
}

export const pushToCloud = async (userId: string) => {
  console.log("Pushing Data to Cloud for user with id", userId);
   await  withJwtSkewRetry(() => pushCategories(userId));
  await  withJwtSkewRetry(() => pushTags(userId));

  await  withJwtSkewRetry(() => pushTasks(userId));
  await  withJwtSkewRetry(() => pushHabits(userId));
  await  withJwtSkewRetry(() => pushEvents(userId));
  await  withJwtSkewRetry(() => pushLogs(userId));

  await  withJwtSkewRetry(() => pushUnlockedAchievements(userId));
  await  withJwtSkewRetry(() => pushDailyMetrics(userId));
  await  withJwtSkewRetry(() => pushGlobalMetrics(userId));
  await  withJwtSkewRetry(() => pushDailyAIMetrics(userId));
  await  withJwtSkewRetry(() => pushGlobalAIMetrics(userId));
  await  withJwtSkewRetry(() => pushAchievementMetrics(userId));
}

 export const pullFromCloud = async ({
  userId,
  lastPulledAt,
  onSuccess,
  onPulled,
}: SyncRunOptions) => {
   const since = lastPulledAt ?? "1970-01-01T00:00:00.000Z";
  console.log('Pulling Data from Cloud. It was last synced at ', since)
   await withJwtSkewRetry(() => pullCategories(userId, since));
  await  withJwtSkewRetry(() => pullTags(userId, since));
  const [pulledTasks, pulledHabits, pulledEvents] = await Promise.all([
     withJwtSkewRetry(() => pullTasks(userId, since)),
     withJwtSkewRetry(() => pullHabits(userId, since)),
     withJwtSkewRetry(() => pullEvents(userId, since)),
  ]);
  await  withJwtSkewRetry(() => pullLogs(userId, since));
  await  withJwtSkewRetry(() => pullUnlockedAchievements(userId));
  await  withJwtSkewRetry(() => pullDailyMetrics(userId, since));
  await  withJwtSkewRetry(() => pullGlobalMetrics(userId));
  await  withJwtSkewRetry(() => pullDailyAIMetrics(userId,since));
  await  withJwtSkewRetry(() => pullGlobalAIMetrics(userId));
  await  withJwtSkewRetry(() => pullAchievementMetrics(userId));

  await onPulled?.({
    tasks: pulledTasks,
    habits: pulledHabits,
    events: pulledEvents,
  });
 const completedAt = new Date().toISOString();
  await onSuccess?.(completedAt);
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

