/**
 * Handles reads and writes for global_metrics and daily_metrics tables.
 * Replaces mutateMetric(), loadAppMetrics(), and saveAppMetrics()
 * from storage-utils.ts for the metrics slice.
 *
 * Key design points
 * ─────────────────
 * 1. global_metrics is always a single row with id = 1.
 *    All writes use INSERT OR REPLACE (upsert) — never a raw INSERT.
 *
 * 2. daily_metrics has one row per date (primary key = 'YYYY-MM-DD').
 *    mutateMetricInDb mirrors the logic of the old mutateMetric() exactly:
 *    - reads current values
 *    - applies delta with floor of 0
 *    - writes back
 *    - returns full AppMetrics so DataContext can update React state
 *
 * 3. loadAppMetrics() assembles the full AppMetrics object from both tables,
 *    maintaining the exact same shape the rest of the app expects.
 *    DataContext can drop in this function as a direct replacement for the
 *    AsyncStorage version.
 *
 * 4. No optimistic UI needed for metrics — they are internal counters
 *    incremented after user actions, never directly manipulated by the user.
 *    A failed metric write is logged but does not roll back the triggering
 *    action (completing a task is still completed even if the metric fails).
 */

import { eq, gte, sql } from "drizzle-orm";
import { db, globalMetrics, dailyMetrics } from "@/db";
import type {
    GlobalMetricsRow,
    GlobalMetricsInsert,
    DailyMetricsRow,
    DailyMetricsInsert,
} from "@/db/schema";
import type {
    AppMetrics,
    GlobalMetricKey,
    DailyMetricKey,
    MetricKey,
} from "@/types/metrics";

// ─── column name mapping ──────────────────────────────────────────────────────
//
// The application uses camelCase keys (tasksCompleted) but the DB uses
// snake_case columns (tasks_completed). Drizzle handles this transparently
// when you use the table object — you never write raw SQL column names.
// The mapping below is only needed for the dynamic key lookup in mutateMetricInDb.

/** Maps GlobalMetricKey → the Drizzle column object on globalMetrics table */
const globalColumnMap: Record<GlobalMetricKey, keyof GlobalMetricsRow> = {
    tasksCompleted: "tasksCompleted",
    tasksMissed: "tasksMissed",
    habitsCheckedIn: "habitsCheckedIn",
    habitsGoalsCompleted: "habitsGoalsCompleted",
    habitCheckInsMissed: "habitCheckInsMissed",
    habitsStreakMax: "habitsStreakMax",
    habitsFrozen: "habitsFrozen",
    habitsAutoFrozen: "habitsAutoFrozen",
    timeTracked: "timeTracked",
    chatMessagesSent: "chatMessagesSent",
    chatActionsConfirmed: "chatActionsConfirmed",
    chatActionsExpired: "chatActionsExpired",
    chatActionsCancelled: "chatActionsCancelled",
    lastSyncedAt: "lastSyncedAt",
};

/** Maps DailyMetricKey → the Drizzle column object on dailyMetrics table */
const dailyColumnMap: Record<DailyMetricKey, keyof DailyMetricsRow> = {
    tasksCompleted: "tasksCompleted",
    habitsCheckedIn: "habitsCheckedIn",
    habitsGoalsCompleted: "habitsGoalsCompleted",
    habitsStreakMax: "habitsStreakMax",
    habitsFrozen: "habitsFrozen",
    timeTracked: "timeTracked",
    chatMessagesSent: "chatMessagesSent",
    chatActionsConfirmed: "chatActionsConfirmed",
    chatActionsExpired: "chatActionsExpired",
    chatActionsCancelled: "chatActionsCancelled",
};

// ─── converters ───────────────────────────────────────────────────────────────

function globalRowToObject(row: GlobalMetricsRow): AppMetrics["global"] {
    return {
        tasksCompleted: row.tasksCompleted,
        tasksMissed: row.tasksMissed,
        habitsCheckedIn: row.habitsCheckedIn,
        habitsGoalsCompleted: row.habitsGoalsCompleted,
        habitCheckInsMissed: row.habitCheckInsMissed,
        habitsStreakMax: row.habitsStreakMax,
        habitsFrozen: row.habitsFrozen,
        habitsAutoFrozen: row.habitsAutoFrozen,
        timeTracked: row.timeTracked,
        chatMessagesSent: row.chatMessagesSent,
        chatActionsConfirmed: row.chatActionsConfirmed,
        chatActionsExpired: row.chatActionsExpired,
        chatActionsCancelled: row.chatActionsCancelled,
        lastSyncedAt: row.lastSyncedAt ?? undefined,
    };
}

const defaultGlobal: AppMetrics["global"] = {
    tasksCompleted: 0,
    tasksMissed: 0,
    habitsCheckedIn: 0,
    habitsGoalsCompleted: 0,
    habitCheckInsMissed: 0,
    habitsStreakMax: 0,
    habitsFrozen: 0,
    habitsAutoFrozen: 0,
    timeTracked: 0,
    chatMessagesSent: 0,
    chatActionsConfirmed: 0,
    chatActionsExpired: 0,
    chatActionsCancelled: 0,
};

// ─── read operations ──────────────────────────────────────────────────────────

/**
 * Load the full AppMetrics object from both tables.
 * Direct replacement for loadAppMetrics() in storage-utils.ts.
 */
export async function loadAppMetricsFromDb(): Promise<AppMetrics> {
    const [globalRows, dailyRows] = await Promise.all([
        db.select().from(globalMetrics).limit(1),
        db.select().from(dailyMetrics),
    ]);

    const globalData: AppMetrics["global"] =
        globalRows.length > 0 ? globalRowToObject(globalRows[0]) : { ...defaultGlobal };

    // Rebuild the daily map keyed by date string
    const daily: AppMetrics["daily"] = {};
    for (const row of dailyRows) {
        daily[row.date] = {
            tasksCompleted: row.tasksCompleted,
            habitsCheckedIn: row.habitsCheckedIn,
            habitsGoalsCompleted: row.habitsGoalsCompleted,
            habitsStreakMax: row.habitsStreakMax,
            habitsFrozen: row.habitsFrozen,
            timeTracked: row.timeTracked,
            chatMessagesSent: row.chatMessagesSent,
            chatActionsConfirmed: row.chatActionsConfirmed,
            chatActionsExpired: row.chatActionsExpired,
            chatActionsCancelled: row.chatActionsCancelled,
        };
    }

    return { global: globalData, daily };
}

/**
 * Load only the daily metrics rows for a date range.
 * Useful for heatmap queries: pass startDate = 90 days ago.
 */
export async function loadDailyMetricsRange(
    startDate: string, // 'YYYY-MM-DD'
): Promise<AppMetrics["daily"]> {
    const rows = await db
        .select()
        .from(dailyMetrics)
        .where(gte(dailyMetrics.date, startDate));

    const daily: AppMetrics["daily"] = {};
    for (const row of rows) {
        daily[row.date] = {
            tasksCompleted: row.tasksCompleted,
            habitsCheckedIn: row.habitsCheckedIn,
            habitsGoalsCompleted: row.habitsGoalsCompleted,
            habitsStreakMax: row.habitsStreakMax,
            habitsFrozen: row.habitsFrozen,
            timeTracked: row.timeTracked,
            chatMessagesSent: row.chatMessagesSent,
            chatActionsConfirmed: row.chatActionsConfirmed,
            chatActionsExpired: row.chatActionsExpired,
            chatActionsCancelled: row.chatActionsCancelled,
        };
    }
    return daily;
}

// ─── write operations ─────────────────────────────────────────────────────────

/**
 * Atomic metric mutation. Direct replacement for mutateMetric() in storage-utils.ts.
 *
 * Applies delta to both global and daily tables in a single transaction.
 * Returns full AppMetrics so DataContext can update React state immediately.
 * Floor of 0 preserved — counters never go negative.
 */
export async function mutateMetricInDb(
    keys: MetricKey[],
    amount: number,
    dateOverride?: string,
): Promise<AppMetrics> {
    const dateString = dateOverride ?? new Date().toISOString().split("T")[0];

    return await db.transaction(async (tx) => {
        // ── global row ────────────────────────────────────────────────────────
        const globalRows = await tx.select().from(globalMetrics).limit(1);
        const currentGlobal: AppMetrics["global"] =
            globalRows.length > 0 ? globalRowToObject(globalRows[0]) : { ...defaultGlobal };

        // Apply delta to global keys with floor of 0
        const updatedGlobal = { ...currentGlobal };
        for (const key of keys) {
            if (key in globalColumnMap) {
                const gKey = key as GlobalMetricKey;
                if (gKey === 'lastSyncedAt')
                    updatedGlobal[gKey] = new Date().toISOString();
                else
                    updatedGlobal[gKey] = Math.max(0, updatedGlobal[gKey] + amount);
            }
        }

        // Upsert global row (always id = 1)
        await tx
            .insert(globalMetrics)
            .values({ id: 1, ...updatedGlobal })
            .onConflictDoUpdate({
                target: globalMetrics.id,
                set: updatedGlobal as Partial<GlobalMetricsInsert>,
            });

        // ── daily row ─────────────────────────────────────────────────────────
        const dailyRows = await tx
            .select()
            .from(dailyMetrics)
            .where(eq(dailyMetrics.date, dateString))
            .limit(1);

        const currentDaily = dailyRows[0] ?? {
            date: dateString,
            tasksCompleted: 0,
            habitsCheckedIn: 0,
            habitsGoalsCompleted: 0,
            habitsStreakMax: 0,
            habitsFrozen: 0,
            timeTracked: 0,
            chatMessagesSent: 0,
            chatActionsConfirmed: 0,
            chatActionsExpired: 0,
            chatActionsCancelled: 0,
        };

        const updatedDaily = { ...currentDaily };
        for (const key of keys) {
            if (key in dailyColumnMap) {
                const dKey = key as DailyMetricKey;
                (updatedDaily as any)[dKey] = Math.max(
                    0,
                    ((updatedDaily as any)[dKey] ?? 0) + amount,
                );
            }
        }

        // Upsert daily row
        await tx
            .insert(dailyMetrics)
            .values(updatedDaily as DailyMetricsInsert)
            .onConflictDoUpdate({
                target: dailyMetrics.date,
                set: updatedDaily as Partial<DailyMetricsInsert>,
            });

        // ── assemble return value ─────────────────────────────────────────────
        // Load the full daily map so the returned AppMetrics is complete
        const allDailyRows = await tx.select().from(dailyMetrics);
        const daily: AppMetrics["daily"] = {};
        for (const row of allDailyRows) {
            daily[row.date] = {
                tasksCompleted: row.tasksCompleted,
                habitsCheckedIn: row.habitsCheckedIn,
                habitsGoalsCompleted: row.habitsGoalsCompleted,
                habitsStreakMax: row.habitsStreakMax,
                habitsFrozen: row.habitsFrozen,
                timeTracked: row.timeTracked,
                chatMessagesSent: row.chatMessagesSent,
                chatActionsConfirmed: row.chatActionsConfirmed,
                chatActionsExpired: row.chatActionsExpired,
                chatActionsCancelled: row.chatActionsCancelled,
            };
        }

        console.log("[MetricsRepo] Global metrics:", updatedGlobal);
        return { global: updatedGlobal, daily };
    });
}

export async function deleteAllMetrics() {
    await db.delete(globalMetrics);
    await db.delete(dailyMetrics);
}

// ─── migration helpers ────────────────────────────────────────────────────────
// OLD Was for migration appMetrics state from AsyncStorage to SQLite, what has some other use now?
/**
 * Seed metrics from an existing AppMetrics object.
 * Called during the AsyncStorage → SQLite migration for metrics.
 * Safe to call multiple times — upserts on conflict.
 */
export async function seedMetricsFromObject(metrics: AppMetrics): Promise<void> {
    await db.transaction(async (tx) => {
        // Global
        await tx
            .insert(globalMetrics)
            .values({ id: 1, ...metrics.global })
            .onConflictDoUpdate({
                target: globalMetrics.id,
                set: metrics.global as Partial<GlobalMetricsInsert>,
            });

        // Daily — one upsert per date
        for (const [date, daily] of Object.entries(metrics.daily)) {
            const row: DailyMetricsInsert = { date, ...daily };
            await tx
                .insert(dailyMetrics)
                .values(row)
                .onConflictDoUpdate({
                    target: dailyMetrics.date,
                    set: daily as Partial<DailyMetricsInsert>,
                });
        }
    });
}