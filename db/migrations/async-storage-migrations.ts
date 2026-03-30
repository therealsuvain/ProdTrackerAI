/**
 * db/migrations/async-storage-migration.ts
 *
 * One-time migration: reads existing task data from AsyncStorage and
 * inserts it into SQLite. Runs automatically on first launch after the
 * app is updated to use SQLite.
 *
 * Safety guarantees
 * ─────────────────
 * 1. Idempotent — a flag in AsyncStorage (`@migration_v1_tasks_done`)
 *    prevents this from running more than once. Even if called multiple
 *    times it won't duplicate data (bulkInsertTasks uses onConflictDoNothing).
 *
 * 2. Non-destructive — AsyncStorage data is left untouched. It serves as a
 *    backup until Phase 6 (AsyncStorage removal). If migration fails the app
 *    still works because DataContext will fall back to AsyncStorage data.
 *
 * 3. Backfills audit fields — existing tasks won't have createdAt/updatedAt.
 *    We set both to now() as a reasonable default. Not perfect but the
 *    alternative (null) would break the schema's NOT NULL constraint.
 *
 * 4. Fixes the dueDate bug — the old parse() in storage-utils was a no-op
 *    reviver that left dates as strings. This migration properly converts
 *    them to Date objects before handing off to the repository which then
 *    stores them as unix ms integers. After migration, date handling is
 *    consistent and correct.
 *
 * Called from: initDatabase() in db/index.ts
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { bulkInsertTasks } from "@/db/repositories/task-repository";
import type { Task } from "@/types/task";

const MIGRATION_FLAG_KEY = "@migration_v1_tasks_done";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * The original storage-utils parse() was broken — it matched ISO strings
 * but returned `value` unchanged in both branches (a no-op reviver).
 * This is the corrected version used only during migration.
 */
function parseWithDates(json: string): any {
  return JSON.parse(json, (_key, value) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      // Guard against invalid dates from malformed strings
      return isNaN(date.getTime()) ? value : date;
    }
    return value;
  });
}

/**
 * Backfill audit fields that didn't exist before Phase 1.
 * Uses a stable timestamp so all migrated tasks share the same createdAt
 * (accurate enough — we can't know when they were originally created).
 */
function backfillAuditFields(task: any, migrationTimestamp: string): Task {
  return {
    ...task,
    // Ensure dueDate is a proper Date object if it came through as string
    dueDate:
      task.dueDate instanceof Date
        ? task.dueDate
        : task.dueDate
          ? new Date(task.dueDate)
          : undefined,
    reminderDate:
      task.reminderDate instanceof Date
        ? task.reminderDate
        : task.reminderDate
          ? new Date(task.reminderDate)
          : undefined,
    // Backfill audit fields with migration timestamp
    createdAt: task.createdAt ?? migrationTimestamp,
    updatedAt: task.updatedAt ?? migrationTimestamp,
    // Derive completedAt: if completed but no completedAt, use migration timestamp
    // This is an approximation — better than null for completed tasks
    completedAt:
      task.completedAt ??
      (task.completed ? migrationTimestamp : undefined),
  } as Task;
}

// ─── main migration function ──────────────────────────────────────────────────

export async function migrateTasksFromAsyncStorage(): Promise<{
  migrated: number;
  skipped: boolean;
}> {
  // Check if already done
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
  if (flag === "true") {
    console.log("[Migration] Tasks already migrated, skipping.");
    return { migrated: 0, skipped: true };
  }

  // Load from AsyncStorage
  const json = await AsyncStorage.getItem("tasks");
  if (!json) {
    // No existing data — mark as done so we don't check again
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
    console.log("[Migration] No existing tasks found in AsyncStorage.");
    return { migrated: 0, skipped: false };
  }

  let rawTasks: any[];
  try {
    rawTasks = parseWithDates(json);
  } catch (e) {
    console.error("[Migration] Failed to parse AsyncStorage tasks:", e);
    // Don't set the flag — allow retry next launch
    throw new Error(`Task migration parse failed: ${e}`);
  }

  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");
    return { migrated: 0, skipped: false };
  }

  const migrationTimestamp = new Date().toISOString();
  const tasksToMigrate: Task[] = rawTasks.map((t) =>
    backfillAuditFields(t, migrationTimestamp),
  );

  // Bulk insert into SQLite
  await bulkInsertTasks(tasksToMigrate);

  // Mark migration complete only after successful insert
  await AsyncStorage.setItem(MIGRATION_FLAG_KEY, "true");

  console.log(
    `[Migration] Successfully migrated ${tasksToMigrate.length} tasks from AsyncStorage → SQLite.`,
  );
  return { migrated: tasksToMigrate.length, skipped: false };
}