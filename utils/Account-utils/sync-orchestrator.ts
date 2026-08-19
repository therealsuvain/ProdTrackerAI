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
  pullAchievementMetrics
} from "./sync-engine";

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
  await pushCategories(userId);
  await pushTags(userId);

  await pushTasks(userId);
  await pushHabits(userId);
  await pushEvents(userId);
  await pushLogs(userId);

  await pushUnlockedAchievements(userId);
  await pushDailyMetrics(userId);
  await pushGlobalMetrics(userId);
  await pushDailyAIMetrics(userId);
  await pushGlobalAIMetrics(userId);
  await pushAchievementMetrics(userId);
  
  console.log('Pulling Cats')
  await pullCategories(userId, lastPulledAt);
  console.log('Pulling Tags')
  await pullTags(userId, lastPulledAt);

  console.log('Pulling Tasks, Habits, Events')
  const [pulledTasks, pulledHabits, pulledEvents] = await Promise.all([
    pullTasks(userId, since),
    pullHabits(userId, since),
    pullEvents(userId, since),
  ]);
 
  console.log('Pulling Logs')
  await pullLogs(userId, since);
  console.log('Pulling Unlocked Achievements')
  await pullUnlockedAchievements(userId);
  console.log('Pulling Daily Metrics')
  await pullDailyMetrics(userId, lastPulledAt);
  console.log('Pulling Global Metrics')
  await pullGlobalMetrics(userId);
  console.log('Pulling Daily AI Metrics')
  await pullDailyAIMetrics(userId,lastPulledAt);
  console.log('Pulling Global AI Metrics')
  await pullGlobalAIMetrics(userId);
  console.log('Pulling Achievement Metrics')
  await pullAchievementMetrics(userId);

  await onPulled?.({
    tasks: pulledTasks,
    habits: pulledHabits,
    events: pulledEvents,
  });

  const completedAt = new Date().toISOString();
  await onSuccess?.(completedAt);
}