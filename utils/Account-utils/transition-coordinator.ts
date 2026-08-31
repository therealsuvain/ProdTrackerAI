import { eq, inArray } from "drizzle-orm";

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
  eventNotificationIds,
  unlockedAchievements,
  globalMetrics,
  dailyMetrics,
  globalMetricsAI,
  dailyMetricsAI,
  achievementGlobalMetrics,
} from "@/db";
import { clearSyncCursor, getRecoverySnapshotItems, getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";
import { createRecoverySnapshot } from "./recovery-snapshot-engine";
import { clearActiveWorkspace, clearWorkspaceInTransaction } from "./workspace-replacement";
import { cancelAllScheduledNotifications } from "@/hooks/use-notifications";
import { setWorkspaceSyncMode } from "@/utils/Account-utils/workspace-sync-mode-store";
import { deleteAllCloudDataForUser } from "./sync-orchestrator";

type RecoveryItem = {
  snapshotId: string;
  entityType: string;
  entityId: string;
  payload: string;
};

type RecoveryPayload = {
  parent?: Record<string, any>;
  tags?: Record<string, any>[];
  checkIns?: Record<string, any>[];
  freezes?: Record<string, any>[];
  goalCompletions?: Record<string, any>[];
  deletedOccurrences?: Record<string, any>[];
};

function parsePayload(item: RecoveryItem): RecoveryPayload {
  return JSON.parse(item.payload);
}

function parsePlainPayload(item: RecoveryItem): Record<string, any> {
  return JSON.parse(item.payload);
}

function itemsOfType(
  items: RecoveryItem[],
  entityType: string,
): RecoveryItem[] {
  return items.filter((item) => item.entityType === entityType);
}

export async function replaceWorkspaceFromAccount(options: {
  targetUserId: string;
  sourceUserId: string | null;
  sourceIsAnonymous: boolean;
  pullAccountData: () => Promise<void>;
}): Promise<void> {
  await createRecoverySnapshot({
    sourceUserId: options.sourceUserId,
    sourceIsAnonymous: options.sourceIsAnonymous,
  });

  await clearActiveWorkspace();

  await clearSyncCursor(options.targetUserId);

  await options.pullAccountData();
}



async function restoreCategoriesAndTags(
  tx: any,
  items: RecoveryItem[],
  restoreTimestamp: string,
): Promise<void> {
  const categoryItems = itemsOfType(items, "category");

  for (const item of categoryItems) {
    const row = parsePlainPayload(item);

    await tx.insert(categories)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: row.name,
          color: row.color,
          icon: row.icon,
          count: row.count,
          createdAt: row.createdAt,
          deletedAt: row.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }

  const tagItems = itemsOfType(items, "tag");

  for (const item of tagItems) {
    const row = parsePlainPayload(item);

    await tx.insert(tags)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
      })
      .onConflictDoUpdate({
        target: tags.id,
        set: {
          name: row.name,
          count: row.count,
          createdAt: row.createdAt,
          deletedAt: row.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }
}


async function restoreParents(
  tx: any,
  items: RecoveryItem[],
  restoreTimestamp: string,
): Promise<void> {
  for (const item of itemsOfType(items, "task")) {
    const { parent } = parsePayload(item);
    if (!parent) continue;

    await tx.insert(tasks)
      .values({
        ...parent,
        notificationId: null,
        embedding: null,
        updatedAt: restoreTimestamp,
        syncedAt: null,
      })
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: parent.title,
          description: parent.description ?? null,
          category: parent.category ?? null,
          dueDate: parent.dueDate,
          reminderDate: parent.reminderDate ?? null,
          reminder: parent.reminder ?? false,
          notificationId: null,
          priority: parent.priority,
          completed: parent.completed,
          completedAt: parent.completedAt ?? null,
          tags: parent.tags ?? null,
          embedding: null,
          createdAt: parent.createdAt,
          deletedAt: parent.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }

  for (const item of itemsOfType(items, "habit")) {
    const { parent } = parsePayload(item);
    if (!parent) continue;

    await tx.insert(habits)
      .values({
        ...parent,
        notificationId: null,
        embedding: null,
        updatedAt: restoreTimestamp,
        syncedAt: null,
      })
      .onConflictDoUpdate({
        target: habits.id,
        set: {
          title: parent.title,
          description: parent.description ?? null,
          frequency: parent.frequency,
          reminder: parent.reminder ?? false,
          reminderDate: parent.reminderDate ?? null,
          targetDays: parent.targetDays ?? null,
          streak: parent.streak ?? 0,
          longestStreak: parent.longestStreak ?? 0,
          streakFreezes: parent.streakFreezes ?? 1,
          goal: parent.goal ?? 7,
          pendingStreakResetAfter:
            parent.pendingStreakResetAfter ?? null,
          notificationId: null,
          category: parent.category ?? null,
          tags: parent.tags ?? null,
          embedding: null,
          createdAt: parent.createdAt,
          deletedAt: parent.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }

  for (const item of itemsOfType(items, "calendar_event")) {
    const { parent } = parsePayload(item);
    if (!parent) continue;

    await tx.insert(calendarEvents)
      .values({
        ...parent,
        embedding: null,
        updatedAt: restoreTimestamp,
        syncedAt: null,
      })
      .onConflictDoUpdate({
        target: calendarEvents.id,
        set: {
          title: parent.title,
          description: parent.description ?? null,
          startDate: parent.startDate,
          startTime: parent.startTime,
          endTime: parent.endTime,
          endDate: parent.endDate ?? null,
          reminder: parent.reminder ?? false,
          recurrence: parent.recurrence ?? "none",
          category: parent.category ?? null,
          tags: parent.tags ?? null,
          embedding: null,
          createdAt: parent.createdAt,
          deletedAt: parent.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }

  for (const item of itemsOfType(items, "timer_log")) {
    const { parent } = parsePayload(item);
    if (!parent) continue;

    await tx.insert(timerLogs)
      .values({
        ...parent,
        updatedAt: restoreTimestamp,
        syncedAt: null,
      })
      .onConflictDoUpdate({
        target: timerLogs.id,
        set: {
          title: parent.title,
          startTime: parent.startTime,
          endTime: parent.endTime ?? null,
          duration: parent.duration ?? null,
          category: parent.category ?? null,
          tags: parent.tags ?? null,
          laps: parent.laps ?? null,
          isPartial: parent.isPartial ?? false,
          createdAt: parent.createdAt,
          deletedAt: parent.deletedAt ?? null,
          updatedAt: restoreTimestamp,
          syncedAt: null,
        },
      });
  }
}

async function restoreChildren(
  tx: any,
  items: RecoveryItem[],
): Promise<void> {
  for (const item of itemsOfType(items, "habit")) {
    const payload = parsePayload(item);

    if (payload.checkIns?.length) {
      await tx.insert(habitCheckIns)
        .values(payload.checkIns.map((row) => ({
          ...row,
          habitId: item.entityId,
        })))
        .onConflictDoNothing();
    }

    if (payload.freezes?.length) {
      await tx.insert(habitFreezeHistory)
        .values(payload.freezes.map((row) => ({
          ...row,
          habitId: item.entityId,
        })))
        .onConflictDoNothing();
    }

    if (payload.goalCompletions?.length) {
      await tx.insert(habitGoalCompletions)
        .values(payload.goalCompletions.map((row) => ({
          ...row,
          habitId: item.entityId,
        })))
        .onConflictDoNothing();
    }
  }

  for (const item of itemsOfType(items, "calendar_event")) {
    const payload = parsePayload(item);

    if (payload.deletedOccurrences?.length) {
      await tx.insert(eventDeletedOccurrences)
        .values(payload.deletedOccurrences.map((row) => ({
          ...row,
          eventId: item.entityId,
        })))
        .onConflictDoNothing();
    }
  }

  // Notification IDs are intentionally not restored.
  // They belong to the previous device scheduling state.
}

async function restoreJunctions(
  tx: any,
  items: RecoveryItem[],
): Promise<void> {
  for (const item of itemsOfType(items, "task")) {
    const payload = parsePayload(item);

    if (!payload.tags?.length) continue;

    await tx.insert(taskTags)
      .values(
        payload.tags.map((row) => ({
          taskId: item.entityId,
          tagId: row.tagId,
        })),
      )
      .onConflictDoNothing();
  }

  for (const item of itemsOfType(items, "habit")) {
    const payload = parsePayload(item);

    if (!payload.tags?.length) continue;

    await tx.insert(habitTags)
      .values(
        payload.tags.map((row) => ({
          habitId: item.entityId,
          tagId: row.tagId,
        })),
      )
      .onConflictDoNothing();
  }

  for (const item of itemsOfType(items, "calendar_event")) {
    const payload = parsePayload(item);

    if (!payload.tags?.length) continue;

    await tx.insert(eventTags)
      .values(
        payload.tags.map((row) => ({
          eventId: item.entityId,
          tagId: row.tagId,
        })),
      )
      .onConflictDoNothing();
  }

  for (const item of itemsOfType(items, "timer_log")) {
    const payload = parsePayload(item);

    if (!payload.tags?.length) continue;

    await tx.insert(timerTags)
      .values(
        payload.tags.map((row) => ({
          logId: item.entityId,
          tagId: row.tagId,
        })),
      )
      .onConflictDoNothing();
  }
}

async function restoreMetrics(
  tx: any,
  items: RecoveryItem[],
  restoreTimestamp: string,
): Promise<void> {
  for (const item of itemsOfType(items, "global_metrics")) {
    const row = parsePlainPayload(item);

    await tx.insert(globalMetrics)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
        syncedSnapshot: null,
      })
      .onConflictDoUpdate({
        target: globalMetrics.id,
        set: {
          ...row,
          syncedAt: null,
          updatedAt: restoreTimestamp,
          syncedSnapshot: null,
        },
      });
  }

  for (const item of itemsOfType(items, "daily_metrics")) {
    const row = parsePlainPayload(item);

    await tx.insert(dailyMetrics)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
        syncedSnapshot: null,
      })
      .onConflictDoUpdate({
        target: dailyMetrics.date,
        set: {
          ...row,
          syncedAt: null,
          updatedAt: restoreTimestamp,
          syncedSnapshot: null,
        },
      });
  }

  for (const item of itemsOfType(items, "global_metrics_ai")) {
    const row = parsePlainPayload(item);

    await tx.insert(globalMetricsAI)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
        syncedSnapshot: null,
      })
      .onConflictDoUpdate({
        target: globalMetricsAI.id,
        set: {
          ...row,
          syncedAt: null,
          updatedAt: restoreTimestamp,
          syncedSnapshot: null,
        },
      });
  }

  for (const item of itemsOfType(items, "daily_metrics_ai")) {
    const row = parsePlainPayload(item);

    await tx.insert(dailyMetricsAI)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
        syncedSnapshot: null,
      })
      .onConflictDoUpdate({
        target: dailyMetricsAI.date,
        set: {
          ...row,
          syncedAt: null,
          updatedAt: restoreTimestamp,
          syncedSnapshot: null,
        },
      });
  }

  for (const item of itemsOfType(
    items,
    "achievement_global_metrics",
  )) {
    const row = parsePlainPayload(item);

    await tx.insert(achievementGlobalMetrics)
      .values({
        ...row,
        syncedAt: null,
        updatedAt: restoreTimestamp,
        syncedSnapshot: null,
      })
      .onConflictDoUpdate({
        target: achievementGlobalMetrics.id,
        set: {
          ...row,
          syncedAt: null,
          updatedAt: restoreTimestamp,
          syncedSnapshot: null,
        },
      });
  }
}


async function restoreAchievements(
  tx: any,
  items: RecoveryItem[],
): Promise<void> {
  const achievementItems = itemsOfType(
    items,
    "unlocked_achievement",
  );

  if (achievementItems.length === 0) return;

  await tx.insert(unlockedAchievements)
    .values(
      achievementItems.map((item) => {
        const row = parsePlainPayload(item);

        return {
          ...row,
          syncedAt: null,
        };
      }),
    )
    .onConflictDoNothing();
}

export async function restoreRecoverySnapshotAsActiveWorkspace(
  snapshotId: string,
  mode: 'replace'|'merge',
): Promise<void> {
  const snapshot = await getRecoverySnapshotSummary();

  if (!snapshot || snapshot.id !== snapshotId) {
    throw new Error("Recovery snapshot is unavailable or expired.");
  }

  const items = await getRecoverySnapshotItems(snapshotId);
  const restoreTimestamp = new Date().toISOString();

  if (mode === "replace") {
     await cancelAllScheduledNotifications();
  }
 

  await db.transaction(async (tx) => {
    if(mode === "replace") {
      await clearWorkspaceInTransaction(tx);
    }
    await restoreCategoriesAndTags(tx, items, restoreTimestamp);
    await restoreParents(tx, items, restoreTimestamp);
    await restoreChildren(tx, items);
    await restoreJunctions(tx, items);
    await restoreMetrics(tx, items, restoreTimestamp);
    await restoreAchievements(tx, items);
  });
}

export async function mergeIntoAccount(options: {
  userId: string;
  pushLocalData: (userId: string) => Promise<void>;
  pullAccountData: () => Promise<void>;
  markRecoveryConsumed : (snapshotId: string, action: "Restored" | "Merged", timestamp: string) => void;
}): Promise<void> {
   const snapshot = await getRecoverySnapshotSummary();
   if(snapshot){
    await restoreRecoverySnapshotAsActiveWorkspace(snapshot.id, "merge");
    options.markRecoveryConsumed(snapshot.id, "Merged", new Date().toISOString());
  }
  await options.pushLocalData(options.userId);
  await options.pullAccountData();
  await setWorkspaceSyncMode("synced");
}

export async function discardAndReturnToAccount(options: {
  targetUserId: string;
  pullAccountData: () => Promise<void>;
}): Promise<void> {
  // Snapshot the restored/detached state before discarding it —
  // gives the user one more chance to get back to it if this was a mistake.
  await cancelAllScheduledNotifications();
  await createRecoverySnapshot({
    sourceUserId: options.targetUserId,
    sourceIsAnonymous: false,
  });

  await clearActiveWorkspace();
  await clearSyncCursor(options.targetUserId);
  await options.pullAccountData();
  await setWorkspaceSyncMode("synced");
}

export async function replaceCloudWithLocal(options: {
  userId: string;
  pushAllLocalData: () => Promise<void>;
}): Promise<void> {
  // Force-push every local row regardless of syncedAt state, since the
  // intent here is "local wins unconditionally," not incremental push.
  await deleteAllCloudDataForUser(options.userId);
  await options.pushAllLocalData();
  await setWorkspaceSyncMode("synced");
}