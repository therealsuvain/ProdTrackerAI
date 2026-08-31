import { randomUUID } from "expo-crypto";
import { and, eq, lt } from "drizzle-orm";
import {
  db,
  tasks,
  habits,
  calendarEvents,
  timerLogs,
  categories,
  tags,
  taskTags,
  habitTags,
  eventTags,
  timerTags,
  habitCheckIns,
  habitFreezeHistory,
  habitGoalCompletions,
  eventDeletedOccurrences,
  unlockedAchievements,
  globalMetrics,
  dailyMetrics,
  globalMetricsAI,
  dailyMetricsAI,
  achievementGlobalMetrics,
  localRecoverySnapshots,
  localRecoveryItems,
} from "@/db";
import { RecoveryItem ,RecoveryEntityType } from "@/types/recovery-snapshot";




function groupBy<T>(
  rows: T[],
  getKey: (row: T) => string,
): Map<string, T[]> {
  const result = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    const existing = result.get(key) ?? [];
    existing.push(row);
    result.set(key, existing);
  }

  return result;
}

  // 1. Read complete current workspace.
  // 2. Delete previous recovery snapshot.
  // 3. Insert new header.
  // 4. Insert all logical payloads.
  // 5. Commit atomically.

  function buildRecoveryItems(data: {
  taskRows: any[];
  habitRows: any[];
  eventRows: any[];
  logRows: any[];
  categoryRows: any[];
  tagRows: any[];
  taskTagRows: any[];
  habitTagRows: any[];
  eventTagRows: any[];
  timerTagRows: any[];
  checkInRows: any[];
  freezeRows: any[];
  goalCompletionRows: any[];
  eventDeletedOccurrenceRows: any[];
  achievementRows: any[];
  globalMetricRows: any[];
  dailyMetricRows: any[];
  globalMetricAIRows: any[];
  dailyMetricAIRows: any[];
  achievementMetricRows: any[];
}): RecoveryItem[] {
  const taskTagsByTask = groupBy(
    data.taskTagRows,
    (row) => row.taskId,
  );

  const habitTagsByHabit = groupBy(
    data.habitTagRows,
    (row) => row.habitId,
  );

  const eventTagsByEvent = groupBy(
    data.eventTagRows,
    (row) => row.eventId,
  );

  const timerTagsByLog = groupBy(
    data.timerTagRows,
    (row) => row.logId,
  );

  const checkInsByHabit = groupBy(
    data.checkInRows,
    (row) => row.habitId,
  );

  const freezesByHabit = groupBy(
    data.freezeRows,
    (row) => row.habitId,
  );

  const goalsByHabit = groupBy(
    data.goalCompletionRows,
    (row) => row.habitId,
  );

  const deletedOccurrencesByEvent = groupBy(
    data.eventDeletedOccurrenceRows,
    (row) => row.eventId,
  );

  const items: RecoveryItem[] = [];

  for (const row of data.taskRows) {
    items.push({
      entityType: "task",
      entityId: row.id,
      payload: {
        parent: {
          ...row,
          notificationId: null,
          embedding: null,
        },
        tags: taskTagsByTask.get(row.id) ?? [],
      },
    });
  }

  for (const row of data.habitRows) {
    items.push({
      entityType: "habit",
      entityId: row.id,
      payload: {
        parent: {
          ...row,
          notificationId: null,
          embedding: null,
        },
        tags: habitTagsByHabit.get(row.id) ?? [],
        checkIns: checkInsByHabit.get(row.id) ?? [],
        freezes: freezesByHabit.get(row.id) ?? [],
        goalCompletions: goalsByHabit.get(row.id) ?? [],
      },
    });
  }

  for (const row of data.eventRows) {
    items.push({
      entityType: "calendar_event",
      entityId: row.id,
      payload: {
        parent: {
          ...row,
          embedding: null,
          notificationIds: null,
        },
        tags: eventTagsByEvent.get(row.id) ?? [],
        deletedOccurrences:
          deletedOccurrencesByEvent.get(row.id) ?? [],
      },
    });
  }

  for (const row of data.logRows) {
    items.push({
      entityType: "timer_log",
      entityId: row.id,
      payload: {
        parent: row,
        tags: timerTagsByLog.get(row.id) ?? [],
      },
    });
  }

  for (const row of data.categoryRows) {
    items.push({
      entityType: "category",
      entityId: row.id,
      payload: row,
    });
  }

  for (const row of data.tagRows) {
    items.push({
      entityType: "tag",
      entityId: row.id,
      payload: row,
    });
  }

  for (const row of data.achievementRows) {
    items.push({
      entityType: "unlocked_achievement",
      entityId: row.id,
      payload: row,
    });
  }

  for (const row of data.globalMetricRows) {
    items.push({
      entityType: "global_metrics",
      entityId: String(row.id),
      payload: row,
    });
  }

  for (const row of data.dailyMetricRows) {
    items.push({
      entityType: "daily_metrics",
      entityId: row.date,
      payload: row,
    });
  }

  for (const row of data.globalMetricAIRows) {
    items.push({
      entityType: "global_metrics_ai",
      entityId: String(row.id),
      payload: row,
    });
  }

  for (const row of data.dailyMetricAIRows) {
    items.push({
      entityType: "daily_metrics_ai",
      entityId: row.date,
      payload: row,
    });
  }

  for (const row of data.achievementMetricRows) {
    items.push({
      entityType: "achievement_global_metrics",
      entityId: String(row.id),
      payload: row,
    });
  }


  console.log(JSON.stringify(items));
  return items;
}

export async function createRecoverySnapshot(options: {
  sourceUserId: string | null;
  sourceIsAnonymous: boolean;
}): Promise<string> {
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  console.log("[AI] Creating recovery snapshot...", createdAt);
  const [
    taskRows,
    habitRows,
    eventRows,
    logRows,
    categoryRows,
    tagRows,
    taskTagRows,
    habitTagRows,
    eventTagRows,
    timerTagRows,
    checkInRows,
    freezeRows,
    goalCompletionRows,
    eventDeletedOccurrenceRows,
    achievementRows,
    globalMetricRows,
    dailyMetricRows,
    globalMetricAIRows,
    dailyMetricAIRows,
    achievementMetricRows,
  ] = await Promise.all([
    db.select().from(tasks),
    db.select().from(habits),
    db.select().from(calendarEvents),
    db.select().from(timerLogs),
    db.select().from(categories),
    db.select().from(tags),
    db.select().from(taskTags),
    db.select().from(habitTags),
    db.select().from(eventTags),
    db.select().from(timerTags),
    db.select().from(habitCheckIns),
    db.select().from(habitFreezeHistory),
    db.select().from(habitGoalCompletions),
    db.select().from(eventDeletedOccurrences),
    db.select().from(unlockedAchievements),
    db.select().from(globalMetrics),
    db.select().from(dailyMetrics),
    db.select().from(globalMetricsAI),
    db.select().from(dailyMetricsAI),
    db.select().from(achievementGlobalMetrics),
  ]);

  const items = buildRecoveryItems({
    taskRows,
    habitRows,
    eventRows,
    logRows,
    categoryRows,
    tagRows,
    taskTagRows,
    habitTagRows,
    eventTagRows,
    timerTagRows,
    checkInRows,
    freezeRows,
    goalCompletionRows,
    eventDeletedOccurrenceRows,
    achievementRows,
    globalMetricRows,
    dailyMetricRows,
    globalMetricAIRows,
    dailyMetricAIRows,
    achievementMetricRows,
  });

  const snapshotId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.delete(localRecoverySnapshots);

    await tx.insert(localRecoverySnapshots).values({
      id: snapshotId,
      createdAt,
      expiresAt,
      sourceUserId: options.sourceUserId,
      sourceIsAnonymous: options.sourceIsAnonymous,
    });

    if (items.length > 0) {
      await tx.insert(localRecoveryItems).values(
        items.map((item) => ({
          snapshotId,
          entityType: item.entityType,
          entityId: item.entityId,
          payload: JSON.stringify(item.payload),
        })),
      );
    }
  });
  console.log("[AI] Recovery snapshot created:", snapshotId);
  return snapshotId;
}

