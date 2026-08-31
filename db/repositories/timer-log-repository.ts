import { eq, desc, asc, isNull, and } from "drizzle-orm";
import { db, timerLogs, timerTags } from "@/db";
import type { TimerLog } from "@/types/timer";
import type { TimerLogRow, TimerLogInsert } from "@/db/schema";

// ─── type converters ──────────────────────────────────────────────────────────

/** DB row → application TimerLog. Called on every read. */
function rowToTimerLog(row: TimerLogRow): TimerLog {
    return {
        id: row.id,
        title: row.title,
        startTime: row.startTime,
        endTime: row.endTime ?? undefined,
        duration: row.duration ?? undefined,
        category: row.category ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        laps: row.laps ? JSON.parse(row.laps) : undefined,
        isPartial: row.isPartial ?? false,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/** Application TimerLog → DB insert shape. Called on every write. */
export function timer_logToInsert(timer_log: TimerLog): TimerLogInsert {
    const now = new Date().toISOString();
    return {
        id: timer_log.id,
        title: timer_log.title,
        startTime: timer_log.startTime,
        endTime: timer_log.endTime ?? null,
        duration: timer_log.duration ?? null,
        category: timer_log.category ?? null,
        tags: timer_log.tags ? JSON.stringify(timer_log.tags) : null,
        laps: timer_log.laps ? JSON.stringify(timer_log.laps) : null,
        isPartial: timer_log.isPartial ?? false,
        createdAt: timer_log.createdAt ?? now,
        updatedAt: now, // always stamp updatedAt to now on any write
    };
}

// ─── read operations ──────────────────────────────────────────────────────────

/** Load all timerLogs ordered by creation date descending (newest first). */
export async function getAllTimerLogs(): Promise<TimerLog[]> {
    const rows = await db
        .select()
        .from(timerLogs)
        .where(isNull(timerLogs.deletedAt))
        .orderBy(desc(timerLogs.createdAt));
    return rows.map(rowToTimerLog);
}

/** Load a single timer_log by id. Returns null if not found. */
export async function getTimerLogById(id: string): Promise<TimerLog | null> {
    const rows = await db
        .select()
        .from(timerLogs)
        .where(and(isNull(timerLogs.deletedAt), eq(timerLogs.id, id)))
        .limit(1);
    return rows.length > 0 ? rowToTimerLog(rows[0]) : null;
}

// ─── write operations ─────────────────────────────────────────────────────────

/**
 * Insert a new timer_log. Returns the inserted timer_log (with server-stamped updatedAt).
 * Throws on DB error — caller is responsible for catching and rolling back
 * optimistic UI state.
 */
export async function insertTimerLog(timer_log: TimerLog): Promise<TimerLog> {
    const insert = timer_logToInsert(timer_log);
    await db.insert(timerLogs).values(insert);
    if (timer_log.tags&& timer_log.tags.length>0) {
        const junctionData = timer_log.tags.map((tagId) => ({
                logId: timer_log.id,
                tagId: tagId,
            }));

            await db.insert(timerTags).values(junctionData);
        }
    // Return with the exact timestamps that were written
    return rowToTimerLog({ ...insert } as TimerLogRow);
}

/**
 * Update an existing timer_log. Merges the provided fields and stamps updatedAt.
 * Throws on DB error.
 */
export async function updateTimerLog(timer_log: TimerLog): Promise<TimerLog> {
    const insert = timer_logToInsert(timer_log);
    await db
        .update(timerLogs)
        .set({
            ...insert,
            updatedAt: new Date().toISOString(), // explicit — timer_logToInsert also sets it
        })
        .where(eq(timerLogs.id, timer_log.id));
    if (timer_log.tags&& timer_log.tags.length>0) {
        const junctionData = timer_log.tags.map((tagId) => ({
                logId: timer_log.id,
                tagId: tagId,
            }));
            await db.delete(timerTags).where(eq(timerTags.logId, timer_log.id));
            await db.insert(timerTags).values(junctionData);
        }
    return rowToTimerLog({ ...insert } as TimerLogRow);
}

/**
 * Delete a timer_log by id.
 * Throws on DB error.
 */
export async function deleteTimerLog(id: string): Promise<void> {
   // await db.delete(timerLogs).where(eq(timerLogs.id, id));
    const now = new Date().toISOString();
    await db
        .update(timerLogs)
        .set({
            deletedAt: now,
            updatedAt: now,
            syncedAt: null,
        })
        .where(eq(timerLogs.id, id));
}

// ─── bulk operations (used by data migration) ────────────────────────────────

/**
 * Insert multiple timerLogs in a single transaction.
 * Used by the one-time AsyncStorage → SQLite migration.
 * Skips timerLogs whose id already exists (INSERT OR IGNORE).
 */
export async function bulkInsertTimerLogs(timer_logList: TimerLog[]): Promise<void> {
    if (timer_logList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const timer_log of timer_logList) {
            await tx
                .insert(timerLogs)
                .values(timer_logToInsert(timer_log))
                .onConflictDoNothing(); // safe to re-run migration
        }
    });
}

export async function deleteAllTimerLogs(): Promise<number> {
  const count = await countTimerLogs();
  if (count === 0) return 0;

 // await db.delete(timerLogs);
 const now = new Date().toISOString();
  await db
    .update(timerLogs)
    .set({
      deletedAt: now,
      updatedAt: now,
      syncedAt: null,
    });

  return count;
}

/**
 * Count all timerLogs. Used by migration to confirm it succeeded.
 */
export async function countTimerLogs(): Promise<number> {
    const result = await db.select({ id: timerLogs.id }).from(timerLogs);
    return result.length;
}