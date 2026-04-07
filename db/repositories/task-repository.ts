/**
 * db/repositories/task-repository.ts
 *
 * The single point of contact between application code and the tasks table.
 * Screens, hooks, and AI handlers all go through here — nothing writes to
 * the tasks table directly.
 *
 * Responsibilities
 * ────────────────
 * 1. Type conversion: Task (application) ↔ TaskRow (DB)
 *    - dueDate / reminderDate: Date ↔ INTEGER (unix ms)
 *    - tags / embedding: string[] / number[] ↔ TEXT (JSON)
 *    - completed / reminder: boolean ↔ INTEGER (0/1)
 *    - audit fields: set automatically, never passed by callers
 *
 * 2. CRUD operations returning Task (application type), not raw rows.
 *
 * 3. One-time data migration from AsyncStorage (called by initDatabase).
 */

import { eq, desc, asc } from "drizzle-orm";
import { db, tasks } from "@/db";
import type { Task } from "@/types/task";
import type { TaskRow, TaskInsert } from "@/db/schema";

// ─── type converters ──────────────────────────────────────────────────────────
/** DB row → application Task. Called on every read. */
function rowToTask(row: TaskRow): Task {
    return {
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        category: row.category ?? undefined,
        dueDate: row.dueDate,
        reminderDate: row.reminderDate ?? undefined,
        reminder: row.reminder,
        notificationId: row.notificationId ?? undefined,
        priority: row.priority,
        completed: row.completed,
        completedAt: row.completedAt ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Application Task → DB insert shape. Called on every write. */
function taskToInsert(task: Task): TaskInsert {
    const now = new Date().toISOString();
    return {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        category: task.category ?? null,
        dueDate: task.dueDate,
        reminderDate: task.reminderDate ?? null,
        reminder: task.reminder,
        notificationId: task.notificationId ?? null,
        priority: task.priority,
        completed: task.completed,
        completedAt: task.completedAt ?? null,
        tags: task.tags ? JSON.stringify(task.tags) : null,
        embedding: task.embedding ? JSON.stringify(task.embedding) : null,
        createdAt: task.createdAt ?? now,
        updatedAt: now, // always stamp updatedAt to now on any write
    };
}

// ─── read operations ──────────────────────────────────────────────────────────

/** Load all tasks ordered by creation date descending (newest first). */
export async function getAllTasks(): Promise<Task[]> {
    const rows = await db
        .select()
        .from(tasks)
        .orderBy(desc(tasks.createdAt));
    return rows.map(rowToTask);
}

/** Load a single task by id. Returns null if not found. */
export async function getTaskById(id: string): Promise<Task | null> {
    const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
    return rows.length > 0 ? rowToTask(rows[0]) : null;
}

// ─── write operations ─────────────────────────────────────────────────────────

/**
 * Insert a new task. Returns the inserted task (with server-stamped updatedAt).
 * Throws on DB error — caller is responsible for catching and rolling back
 * optimistic UI state.
 */
export async function insertTask(task: Task): Promise<Task> {
    const insert = taskToInsert(task);
    await db.insert(tasks).values(insert);
    // Return with the exact timestamps that were written
    return rowToTask({ ...insert } as TaskRow);
}

/**
 * Update an existing task. Merges the provided fields and stamps updatedAt.
 * Throws on DB error.
 */
export async function updateTask(task: Task): Promise<Task> {
    const insert = taskToInsert(task);
    await db
        .update(tasks)
        .set({
            ...insert,
            updatedAt: new Date().toISOString(), // explicit — taskToInsert also sets it
        })
        .where(eq(tasks.id, task.id));
    return rowToTask({ ...insert } as TaskRow);
}

/**
 * Toggle completed status. Sets completedAt when completing, clears it
 * when un-completing. This is the most common mutation in the app so it
 * gets its own method rather than going through updateTask.
 */
export async function toggleTaskCompleted(
    id: string,
    currentCompleted: boolean,
): Promise<{ completed: boolean; completedAt: string | null; updatedAt: string }> {
    const newCompleted = !currentCompleted;
    const now = new Date().toISOString();
    const completedAt = newCompleted ? now : null;

    await db
        .update(tasks)
        .set({
            completed: newCompleted,
            completedAt,
            updatedAt: now,
        })
        .where(eq(tasks.id, id));

    return { completed: newCompleted, completedAt, updatedAt: now };
}

/**
 * Delete a task by id.
 * Throws on DB error.
 */
export async function deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
}

// ─── bulk operations (used by data migration) ────────────────────────────────

/**
 * Insert multiple tasks in a single transaction.
 * Used by the one-time AsyncStorage → SQLite migration.
 * Skips tasks whose id already exists (INSERT OR IGNORE).
 */
export async function bulkInsertTasks(taskList: Task[]): Promise<void> {
    if (taskList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const task of taskList) {
            await tx
                .insert(tasks)
                .values(taskToInsert(task))
                .onConflictDoNothing(); // safe to re-run migration
        }
    });
}

export async function deleteAllTasks(): Promise<number> {
  const count = await countTasks();
  if (count === 0) return 0;

  await db.delete(tasks);

  return count;
}

/**
 * Count all tasks. Used by migration to confirm it succeeded.
 */
export async function countTasks(): Promise<number> {
    const result = await db.select({ id: tasks.id }).from(tasks);
    return result.length;
}