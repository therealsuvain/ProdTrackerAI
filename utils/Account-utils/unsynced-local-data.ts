// sync/has-unsynced-local-data.ts
//
// Checks across all syncable tables whether any row is dirty (never synced,
// or edited since last sync). Call this BEFORE pulling on sign-in.

import { calendarEvents, db, habits, tasks, timerLogs } from "@/db";
import { categories } from "@/db";
import { isNull, or, lt, sql } from "drizzle-orm";

// Add one check per synced table as they come online in Phase 3.
async function countDirty(table: any): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(table)
    .where(or(isNull(table.syncedAt), lt(table.syncedAt, table.updatedAt)));
  return result[0]?.count ?? 0;
}

export async function hasUnsyncedCategories(): Promise<boolean> {
  return (await countDirty(categories)) > 0;
}
export async function hasUnsyncedTasks(): Promise<boolean> {
  return (await countDirty(tasks)) > 0;
}
export async function hasUnsyncedHabits(): Promise<boolean> {
  return (await countDirty(habits)) > 0;
}
export async function hasUnsyncedEvents(): Promise<boolean> {
  return (await countDirty(calendarEvents)) > 0;
}
export async function hasUnsyncedLogs(): Promise<boolean> {
  return (await countDirty(timerLogs)) > 0;
}

export async function hasAnyUnsyncedData(): Promise<boolean> {
  const [c, t, h, e, l] = await Promise.all([
    hasUnsyncedCategories(),
    hasUnsyncedTasks(),
    hasUnsyncedHabits(),
    hasUnsyncedEvents(),
    hasUnsyncedLogs(),
  ]);
  return c || t || h || e || l;
}

export async function unsyncedLocalDataCount(): Promise<number> {
 

  const categoryDirtyCount =await countDirty(categories);
  const taskDirtyCount =await countDirty(tasks);
  const habitDirtyCount =await countDirty(habits);
  const eventDirtyCount =await countDirty(calendarEvents);
  const logDirtyCount =await countDirty(timerLogs);
 console.log("[AI] Category Dirty Count:", categoryDirtyCount);
 console.log("[AI] Task Dirty Count:", taskDirtyCount);
 console.log("[AI] Habit Dirty Count:", habitDirtyCount);
 console.log("[AI] Event Dirty Count:", eventDirtyCount);
 console.log("[AI] Log Dirty Count:", logDirtyCount);
  // TODO: add tasks / habits / events / timerLogs checks here as each
  // table gets its own syncedAt column and sync functions.

  return categoryDirtyCount + taskDirtyCount + habitDirtyCount + eventDirtyCount + logDirtyCount;
}

