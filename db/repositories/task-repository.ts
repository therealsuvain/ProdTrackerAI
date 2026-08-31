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

import { eq, desc, asc, isNull, and } from "drizzle-orm";
import { db, tasks, taskTags } from "@/db";
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
export function taskToInsert(task: Task): TaskInsert {
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
        .where(isNull(tasks.deletedAt))
        .orderBy(asc(tasks.createdAt));
    return rows.map(rowToTask);
}

/** Load a single task by id. Returns null if not found. */
export async function getTaskById(id: string): Promise<Task | null> {
    const rows = await db
        .select()
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), eq(tasks.id, id)))
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
    return await db.transaction(async (tx) => {
        // 1. Insert the parent record and return the generated payload
        const [insertedTask] = await tx
            .insert(tasks)
            .values(insert)
            .returning();

        // 2. Batch insert the junction records
        if (task.tags && task.tags.length > 0) {
            const junctionData = task.tags.map((tagId) => ({
                taskId: insertedTask.id,
                tagId: tagId,
            }));

            await tx.insert(taskTags).values(junctionData);
        }

        return rowToTask({ ...insertedTask } as TaskRow);
    });
}

/**
 * Update an existing task. Merges the provided fields and stamps updatedAt.
 * Throws on DB error.
 */
export async function updateTask(task: Task): Promise<Task> {
    const insert = taskToInsert(task);
    return await db.transaction(async (tx) => {
        await tx
            .update(tasks)
            .set({
                ...insert,
                updatedAt: new Date().toISOString(), // explicit — taskToInsert also sets it
            })
            .where(eq(tasks.id, task.id));

        await tx
            .delete(taskTags)
            .where(eq(taskTags.taskId, task.id));

        if (task.tags && task.tags.length > 0) {
            const junctionData = task.tags.map((tagId) => ({
                taskId: task.id,
                tagId: tagId,
            }));

            await tx.insert(taskTags).values(junctionData);
        }

        return rowToTask({ ...insert } as TaskRow);
    });

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
    //await db.delete(tasks).where(eq(tasks.id, id));
    const now = new Date().toISOString();
    await db
        .update(tasks)
        .set({
            deletedAt: now,
            updatedAt: now,
            syncedAt: null,
        })
        .where(eq(tasks.id, id));
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

    //await db.delete(tasks);
    await db.update(tasks)
        .set({ 
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedAt: null, 
        });

    return count;
}

/**
 * Count all tasks. Used by migration to confirm it succeeded.
 */
export async function countTasks(): Promise<number> {
    const result = await db.select({ id: tasks.id }).from(tasks);
    return result.length;
}

export async function batchUpdateTasks(tasksToMutate: Task[], newValues: any): Promise<void> {
    await db.transaction(async (tx) => {
        const taskIds = tasksToMutate.map(t => t.id);
        // Map to promises for parallel execution inside the locked connection
        const updatePromises = taskIds.map(id =>
            tx.update(tasks)
                .set({ ...newValues, updatedAt: new Date().toISOString() })
                .where(eq(tasks.id, id))
        );
        await Promise.all(updatePromises);
    });
}

export async function batchRestore(originalTasks: Task[]): Promise<void> {
    await db.transaction(async (tx) => {
        const restorePromises = originalTasks.map(task =>
            tx.update(tasks)
                .set(taskToInsert(task)) // Push the exact old object back into the row
                .where(eq(tasks.id, task.id))
        );
        await Promise.all(restorePromises);
    });
}