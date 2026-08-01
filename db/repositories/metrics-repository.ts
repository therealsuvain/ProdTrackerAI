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

import { dailyMetrics, dailyMetricsAI, db, globalMetrics, globalMetricsAI } from "@/db";
import type {
    DailyMetricsInsert,
    DailyMetricsRow,
    GlobalMetricsAIRow,
    GlobalMetricsInsert,
    GlobalMetricsRow,
} from "@/db/schema";
import {
    DefaultDailyMetrics,
    type AppMetrics,
    type DailyMetricKey,
    type GlobalMetricKey,
    type MetricKey,
    type GlobalMetricKeyWithoutAI,
    type GlobalMetricNums,

} from "@/types/metrics";
import { eq, gte, sql } from "drizzle-orm";

// ─── column name mapping ──────────────────────────────────────────────────────
//
// The application uses camelCase keys (tasksCompleted) but the DB uses
// snake_case columns (tasks_completed). Drizzle handles this transparently
// when you use the table object — you never write raw SQL column names.
// The mapping below is only needed for the dynamic key lookup in mutateMetricInDb.

/** Maps GlobalMetricKey → the Drizzle column object on globalMetrics table */
const globalColumnMap: Record<GlobalMetricKeyWithoutAI, keyof GlobalMetricsRow> = {
    tasksAdded: "tasksAdded",
    tasksCompleted: "tasksCompleted",
    tasksAbandoned: "tasksAbandoned",
    tasksMissed: "tasksMissed",
    tasksDeleted: "tasksDeleted",
    habitsAdded: "habitsAdded",
    habitsWithWeeklyGoals: "habitsWithWeeklyGoals",
    habitsWithDailyGoals: "habitsWithDailyGoals",
    habitsAbandoned: "habitsAbandoned",
    habitsCheckedIn: "habitsCheckedIn",
    habitsCheckedInBefore8am: "habitsCheckedInBefore8am",
    habitsCheckedInAfter10pm: "habitsCheckedInAfter10pm",
    habitsGoalsCompleted: "habitsGoalsCompleted",
    habitGoalsRestarted: "habitGoalsRestarted",
    habitCheckInsMissed: "habitCheckInsMissed",
    habitsStreakMaxDaily: "habitsStreakMaxDaily",
    habitsStreakMaxWeekly: "habitsStreakMaxWeekly",
    habitsFrozen: "habitsFrozen",
    habitsAutoFrozen: "habitsAutoFrozen",
    habitsDeleted: "habitsDeleted",
    eventsAdded: "eventsAdded",
    eventsDeleted: "eventsDeleted",
    eventsEarlymorning: "eventsEarlymorning",
    eventsLatenight: "eventsLatenight",
    eventsOvernight: "eventsOvernight",
    eventsDaily: "eventsDaily",
    eventsWeekly: "eventsWeekly",
    eventsSingleton: "eventsSingleton",
    eventsInfinite: "eventsInfinite",
    timeTracked: "timeTracked",
    chatMessagesSent: "chatMessagesSent",
    chatActionsConfirmed: "chatActionsConfirmed",
    chatActionsExpired: "chatActionsExpired",
    chatActionsCancelled: "chatActionsCancelled",
    tagsAdded: "tagsAdded",
    tagsAssigned: "tagsAssigned",
    tagsDeleted: "tagsDeleted",
    categoriesAdded: "categoriesAdded",
    categoriesAssigned: "categoriesAssigned",
    categoriesDeleted: "categoriesDeleted",
    logsAdded: "logsAdded",
    logsDeleted: "logsDeleted",
    tasksEdited: "tasksEdited",
    habitsEdited: "habitsEdited",
    eventsEdited: "eventsEdited",
    logsEdited: "logsEdited",
    tagsEdited: "tagsEdited",
    categoriesEdited: "categoriesEdited",
    lastSyncedAt: "lastSyncedAt",
};

/** Maps DailyMetricKey → the Drizzle column object on dailyMetrics table */
const dailyColumnMap: Record<DailyMetricKey, keyof DailyMetricsRow> = {
    tasksAdded: "tasksAdded",
    tasksCompleted: "tasksCompleted",
    tasksAbandoned: "tasksAbandoned",
    tasksMissed: "tasksMissed",
    tasksDeleted: "tasksDeleted",
    habitsAdded: "habitsAdded",
    habitsWithWeeklyGoals: "habitsWithWeeklyGoals",
    habitsWithDailyGoals: "habitsWithDailyGoals",
    habitsAbandoned: "habitsAbandoned",
    habitsCheckedIn: "habitsCheckedIn",
    habitsCheckedInBefore8am: "habitsCheckedInBefore8am",
    habitsCheckedInAfter10pm: "habitsCheckedInAfter10pm",
    habitsGoalsCompleted: "habitsGoalsCompleted",
    habitGoalsRestarted: "habitGoalsRestarted",
    habitCheckInsMissed: "habitCheckInsMissed",
    habitsStreakMaxDaily: "habitsStreakMaxDaily",
    habitsStreakMaxWeekly: "habitsStreakMaxWeekly",
    habitsFrozen: "habitsFrozen",
    habitsAutoFrozen: "habitsAutoFrozen",
    habitsDeleted: "habitsDeleted",
    eventsAdded: "eventsAdded",
    eventsDeleted: "eventsDeleted",
    eventsEarlymorning: "eventsEarlymorning",
    eventsLatenight: "eventsLatenight",
    eventsOvernight: "eventsOvernight",
    eventsDaily: "eventsDaily",
    eventsWeekly: "eventsWeekly",
    eventsSingleton: "eventsSingleton",
    eventsInfinite: "eventsInfinite",
    timeTracked: "timeTracked",
    chatMessagesSent: "chatMessagesSent",
    chatActionsConfirmed: "chatActionsConfirmed",
    chatActionsExpired: "chatActionsExpired",
    chatActionsCancelled: "chatActionsCancelled",
    tagsAdded: "tagsAdded",
    tagsAssigned: "tagsAssigned",
    tagsDeleted: "tagsDeleted",
    categoriesAdded: "categoriesAdded",
    categoriesAssigned: "categoriesAssigned",
    categoriesDeleted: "categoriesDeleted",
    logsAdded: "logsAdded",
    logsDeleted: "logsDeleted",
    tasksEdited: "tasksEdited",
    habitsEdited: "habitsEdited",
    eventsEdited: "eventsEdited",
    logsEdited: "logsEdited",
    tagsEdited: "tagsEdited",
    categoriesEdited: "categoriesEdited",
};

// ─── converters ───────────────────────────────────────────────────────────────

export function globalRowToObject(row: GlobalMetricsRow, aiRow: GlobalMetricsAIRow): AppMetrics["global"] {
    return {
        tasksAdded: row.tasksAdded,
        tasksCompleted: row.tasksCompleted,
        tasksAbandoned: row.tasksAbandoned,
        tasksMissed: row.tasksMissed,
        tasksDeleted: row.tasksDeleted,
        habitsAdded: row.habitsAdded,
        habitsWithWeeklyGoals: row.habitsWithWeeklyGoals,
        habitsWithDailyGoals: row.habitsWithDailyGoals,
        habitsAbandoned: row.habitsAbandoned,
        habitsCheckedIn: row.habitsCheckedIn,
        habitsCheckedInBefore8am: row.habitsCheckedInBefore8am,
        habitsCheckedInAfter10pm: row.habitsCheckedInAfter10pm,
        habitsGoalsCompleted: row.habitsGoalsCompleted,
        habitGoalsRestarted: row.habitGoalsRestarted,
        habitCheckInsMissed: row.habitCheckInsMissed,
        habitsStreakMaxDaily: row.habitsStreakMaxDaily,
        habitsStreakMaxWeekly: row.habitsStreakMaxWeekly,
        habitsFrozen: row.habitsFrozen,
        habitsAutoFrozen: row.habitsAutoFrozen,
        habitsDeleted: row.habitsDeleted,
        eventsAdded: row.eventsAdded,
        eventsDeleted: row.eventsDeleted,
        eventsEarlymorning: row.eventsEarlymorning,
        eventsLatenight: row.eventsLatenight,
        eventsOvernight: row.eventsOvernight,
        eventsDaily: row.eventsDaily,
        eventsWeekly: row.eventsWeekly,
        eventsSingleton: row.eventsSingleton,
        eventsInfinite: row.eventsInfinite,
        timeTracked: row.timeTracked,
        chatMessagesSent: row.chatMessagesSent,
        chatActionsConfirmed: row.chatActionsConfirmed,
        chatActionsExpired: row.chatActionsExpired,
        chatActionsCancelled: row.chatActionsCancelled,
        tagsAdded: row.tagsAdded,
        tagsAssigned : row.tagsAssigned,
        tagsDeleted : row.tagsDeleted,
        categoriesAdded : row.categoriesAdded,
        categoriesAssigned : row.categoriesAssigned,
        categoriesDeleted : row.categoriesDeleted,
        logsAdded : row.logsAdded,
        logsDeleted : row.logsDeleted,
        tasksEdited: row.tasksEdited,
        habitsEdited: row.habitsEdited,
        eventsEdited: row.eventsEdited,
        logsEdited: row.logsEdited,
        tagsEdited: row.tagsEdited,
        categoriesEdited: row.categoriesEdited,       
        lastSyncedAt: row.lastSyncedAt ?? undefined,
        aiMetrics: {
             tasksAdded: aiRow.tasksAdded,
        tasksCompleted: aiRow.tasksCompleted,
        tasksAbandoned: aiRow.tasksAbandoned,
        tasksMissed: aiRow.tasksMissed,
        tasksDeleted: aiRow.tasksDeleted,
        habitsAdded: aiRow.habitsAdded,
        habitsWithWeeklyGoals: aiRow.habitsWithWeeklyGoals,
        habitsWithDailyGoals: aiRow.habitsWithDailyGoals,
        habitsAbandoned: aiRow.habitsAbandoned,
        habitsCheckedIn: aiRow.habitsCheckedIn,
        habitsCheckedInBefore8am: aiRow.habitsCheckedInBefore8am,
        habitsCheckedInAfter10pm: aiRow.habitsCheckedInAfter10pm,
        habitsGoalsCompleted: aiRow.habitsGoalsCompleted,
        habitGoalsRestarted: aiRow.habitGoalsRestarted,
        habitCheckInsMissed: aiRow.habitCheckInsMissed,
        habitsStreakMaxDaily: aiRow.habitsStreakMaxDaily,
        habitsStreakMaxWeekly: aiRow.habitsStreakMaxWeekly,
        habitsFrozen: aiRow.habitsFrozen,
        habitsAutoFrozen: aiRow.habitsAutoFrozen,
        habitsDeleted: aiRow.habitsDeleted,
        eventsAdded: aiRow.eventsAdded,
        eventsDeleted: aiRow.eventsDeleted,
        eventsEarlymorning: aiRow.eventsEarlymorning,
        eventsLatenight: aiRow.eventsLatenight,
        eventsOvernight: aiRow.eventsOvernight,
        eventsDaily: aiRow.eventsDaily,
        eventsWeekly: aiRow.eventsWeekly,
        eventsSingleton: aiRow.eventsSingleton,
        eventsInfinite: aiRow.eventsInfinite,
        timeTracked: aiRow.timeTracked,
        chatMessagesSent: aiRow.chatMessagesSent,
        chatActionsConfirmed: aiRow.chatActionsConfirmed,
        chatActionsExpired: aiRow.chatActionsExpired,
        chatActionsCancelled: aiRow.chatActionsCancelled,
        tagsAdded: aiRow.tagsAdded,
        tagsAssigned : aiRow.tagsAssigned,
        tagsDeleted : aiRow.tagsDeleted,
        categoriesAdded : aiRow.categoriesAdded,
        categoriesAssigned : aiRow.categoriesAssigned,
        categoriesDeleted : aiRow.categoriesDeleted,
        logsAdded : aiRow.logsAdded,
        logsDeleted : aiRow.logsDeleted,
        tasksEdited: aiRow.tasksEdited,
        habitsEdited: aiRow.habitsEdited,
        eventsEdited: aiRow.eventsEdited,
        logsEdited: aiRow.logsEdited,
        tagsEdited: aiRow.tagsEdited,
        categoriesEdited: aiRow.categoriesEdited,
        }
    };
}

export const defaultGlobal: AppMetrics["global"] = {
    tasksAdded: 0,
    tasksCompleted: 0,
    tasksAbandoned: 0,
    tasksMissed: 0,
    tasksDeleted: 0,
    habitsAdded: 0,
    habitsWithWeeklyGoals: 0,
    habitsWithDailyGoals: 0,
    habitsAbandoned: 0,
    habitsCheckedIn: 0,
    habitsCheckedInBefore8am: 0,
    habitsCheckedInAfter10pm: 0,
    habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0,
    habitCheckInsMissed: 0,
    habitsStreakMaxDaily: 0,
    habitsStreakMaxWeekly: 0,
    habitsFrozen: 0,
    habitsAutoFrozen: 0,
    habitsDeleted: 0,
    eventsAdded: 0,
    eventsDeleted: 0,
    eventsEarlymorning: 0,
    eventsLatenight: 0,
    eventsOvernight: 0,
    eventsDaily: 0,
    eventsWeekly: 0,
    eventsSingleton: 0,
    eventsInfinite: 0,
    timeTracked: 0,
    chatMessagesSent: 0,
    chatActionsConfirmed: 0,
    chatActionsExpired: 0,
    chatActionsCancelled: 0,
    tagsAssigned :0,
    tagsDeleted : 0,
    categoriesAdded : 0,
    categoriesAssigned :0,
    categoriesDeleted : 0,
    logsAdded : 0,
    logsDeleted : 0,
    tagsAdded:0,
    tasksEdited: 0,
    habitsEdited: 0,
    eventsEdited: 0,
    logsEdited: 0,
    tagsEdited: 0,
    categoriesEdited: 0,
    aiMetrics: {tasksAdded: 0,
    tasksCompleted: 0,
    tasksAbandoned: 0,
    tasksMissed: 0,
    tasksDeleted: 0,
    habitsAdded: 0,
    habitsWithWeeklyGoals: 0,
    habitsWithDailyGoals: 0,
    habitsAbandoned: 0,
    habitsCheckedIn: 0,
    habitsCheckedInBefore8am: 0,
    habitsCheckedInAfter10pm: 0,
    habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0,
    habitCheckInsMissed: 0,
    habitsStreakMaxDaily: 0,
    habitsStreakMaxWeekly: 0,
    habitsFrozen: 0,
    habitsAutoFrozen: 0,
    habitsDeleted: 0,
    eventsAdded: 0,
    eventsDeleted: 0,
    eventsEarlymorning: 0,
    eventsLatenight: 0,
    eventsOvernight: 0,
    eventsDaily: 0,
    eventsWeekly: 0,
    eventsSingleton: 0,
    eventsInfinite: 0,
    timeTracked: 0,
    chatMessagesSent: 0,
    chatActionsConfirmed: 0,
    chatActionsExpired: 0,
    chatActionsCancelled: 0,
    tagsAssigned :0,
    tagsDeleted : 0,
    categoriesAdded : 0,
    categoriesAssigned :0,
    categoriesDeleted : 0,
    logsAdded : 0,
    logsDeleted : 0,
    tagsAdded:0,
    tasksEdited: 0,
    habitsEdited: 0,
    eventsEdited: 0,
    logsEdited: 0,
    tagsEdited: 0,
    categoriesEdited: 0,},
    lastSyncedAt: undefined,
};

// ─── read operations ──────────────────────────────────────────────────────────

/**
 * Load the full AppMetrics object from both tables.
 * Direct replacement for loadAppMetrics() in storage-utils.ts.
 */
export async function loadAppMetricsFromDb(): Promise<AppMetrics> {
    const [globalRows, dailyRows, globalRowsAI, dailyRowsAI] = await Promise.all([
        db.select().from(globalMetrics).limit(1),
        db.select().from(dailyMetrics),
        db.select().from(globalMetricsAI).limit(1),
        db.select().from(dailyMetricsAI),
    ]);

    const globalAIData = globalRowsAI.length > 0 ? globalRowsAI[0] : { id:1, ...defaultGlobal.aiMetrics };
    const globalDataHold =globalRows.length > 0 ? globalRows[0] : { id:1, ...defaultGlobal.aiMetrics, lastSyncedAt: null };
   const globalData = globalRowToObject(globalDataHold, globalAIData);
    // Rebuild the daily map keyed by date string
    const daily: AppMetrics["daily"] = {};
    for (const row of dailyRows) {
        daily[row.date] = {
            tasksAdded: row.tasksAdded,
            tasksCompleted: row.tasksCompleted,
            tasksAbandoned: row.tasksAbandoned,
            tasksMissed: row.tasksMissed,
            tasksDeleted: row.tasksDeleted,
            habitsAdded: row.habitsAdded,
            habitsWithWeeklyGoals: row.habitsWithWeeklyGoals,
            habitsWithDailyGoals: row.habitsWithDailyGoals,
            habitsAbandoned: row.habitsAbandoned,
            habitsCheckedIn: row.habitsCheckedIn,
            habitsCheckedInBefore8am: row.habitsCheckedInBefore8am,
            habitsCheckedInAfter10pm: row.habitsCheckedInAfter10pm,
            habitsGoalsCompleted: row.habitsGoalsCompleted,
            habitGoalsRestarted: row.habitGoalsRestarted,
            habitCheckInsMissed: row.habitCheckInsMissed,
            habitsStreakMaxDaily: row.habitsStreakMaxDaily,
            habitsStreakMaxWeekly: row.habitsStreakMaxWeekly,
            habitsFrozen: row.habitsFrozen,
            habitsAutoFrozen: row.habitsAutoFrozen,
            habitsDeleted: row.habitsDeleted,
            eventsAdded: row.eventsAdded,
            eventsDeleted: row.eventsDeleted,
            eventsEarlymorning: row.eventsEarlymorning,
            eventsLatenight: row.eventsLatenight,
            eventsOvernight: row.eventsOvernight,
            eventsDaily: row.eventsDaily,
            eventsWeekly: row.eventsWeekly,
            eventsSingleton: row.eventsSingleton,
            eventsInfinite: row.eventsInfinite,
            timeTracked: row.timeTracked,
            chatMessagesSent: row.chatMessagesSent,
            chatActionsConfirmed: row.chatActionsConfirmed,
            chatActionsExpired: row.chatActionsExpired,
            chatActionsCancelled: row.chatActionsCancelled,
            tagsAdded: row.tagsAdded,
            tagsAssigned : row.tagsAssigned,
            tagsDeleted : row.tagsDeleted,
            categoriesAdded : row.categoriesAdded,
            categoriesAssigned : row.categoriesAssigned,
            categoriesDeleted : row.categoriesDeleted,
            logsAdded : row.logsAdded,
            logsDeleted : row.logsDeleted,
            tasksEdited: row.tasksEdited,
            habitsEdited: row.habitsEdited,
            eventsEdited: row.eventsEdited,
            logsEdited: row.logsEdited,
            tagsEdited: row.tagsEdited,
            categoriesEdited: row.categoriesEdited,
            aiMetrics: dailyRowsAI.find((aiRow) => aiRow.date === row.date)?? defaultGlobal.aiMetrics,
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

    const rowsAI = await db
        .select()
        .from(dailyMetricsAI)
        .where(gte(dailyMetricsAI.date, startDate));

    const daily: AppMetrics["daily"] = {};
    for (const row of rows) {
        daily[row.date] = {
            tasksAdded: row.tasksAdded,
            tasksCompleted: row.tasksCompleted,
            tasksAbandoned: row.tasksAbandoned,
            tasksMissed: row.tasksMissed,
            tasksDeleted: row.tasksDeleted,
            habitsAdded: row.habitsAdded,
            habitsWithWeeklyGoals: row.habitsWithWeeklyGoals,
            habitsWithDailyGoals: row.habitsWithDailyGoals,
            habitsAbandoned: row.habitsAbandoned,
            habitsCheckedIn: row.habitsCheckedIn,
            habitsCheckedInBefore8am: row.habitsCheckedInBefore8am,
            habitsCheckedInAfter10pm: row.habitsCheckedInAfter10pm,
            habitsGoalsCompleted: row.habitsGoalsCompleted,
            habitGoalsRestarted: row.habitGoalsRestarted,
            habitCheckInsMissed: row.habitCheckInsMissed,
            habitsStreakMaxDaily: row.habitsStreakMaxDaily,
            habitsStreakMaxWeekly: row.habitsStreakMaxWeekly,
            habitsFrozen: row.habitsFrozen,
            habitsAutoFrozen: row.habitsAutoFrozen,
            habitsDeleted: row.habitsDeleted,
            eventsAdded: row.eventsAdded,
            eventsDeleted: row.eventsDeleted,
            eventsEarlymorning: row.eventsEarlymorning,
            eventsLatenight: row.eventsLatenight,
            eventsOvernight: row.eventsOvernight,
            eventsDaily: row.eventsDaily,
            eventsWeekly: row.eventsWeekly,
            eventsSingleton: row.eventsSingleton,
            eventsInfinite: row.eventsInfinite,
            timeTracked: row.timeTracked,
            chatMessagesSent: row.chatMessagesSent,
            chatActionsConfirmed: row.chatActionsConfirmed,
            chatActionsExpired: row.chatActionsExpired,
            chatActionsCancelled: row.chatActionsCancelled,
            tagsAdded:row.tagsAdded,
            tagsAssigned : row.tagsAssigned,
            tagsDeleted : row.tagsDeleted,
            categoriesAdded : row.categoriesAdded,
            categoriesAssigned : row.categoriesAssigned,
            categoriesDeleted : row.categoriesDeleted,
            logsAdded : row.logsAdded,
            logsDeleted : row.logsDeleted,
            tasksEdited: row.tasksEdited,
            habitsEdited: row.habitsEdited,
            eventsEdited: row.eventsEdited,
            logsEdited: row.logsEdited,
            tagsEdited: row.tagsEdited,
            categoriesEdited: row.categoriesEdited,
            aiMetrics: rowsAI.find((aiRow) => aiRow.date === row.date)?? defaultGlobal.aiMetrics,
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
/* export async function mutateMetricInDb(
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
} */
export async function mutateMetricInDb(
    batchedQueue: Record<string, number>,
    aiBatchedQueue: Record<string, number>,
    dateOverride?: string,
): Promise<void> {
    const dateString = dateOverride ?? new Date().toISOString().split("T")[0];

    // 1. Separate the batched queue into Global and Daily updates
    const globalInsert = { id: 1, ...defaultGlobal };
    const globalUpdate: Record<string, any> = {};

    const globalInsertAI = { id: 1, ...defaultGlobal.aiMetrics };
    const globalUpdateAI: Record<string, any> = {};

    const dailyInsert = { date: dateString, ...DefaultDailyMetrics };
    const dailyUpdate: Record<string, any> = {};

    const dailyInsertAI = { date: dateString, ...DefaultDailyMetrics.aiMetrics };
    const dailyUpdateAI: Record<string, any> = {};

    let hasGlobalUpdates = false;
    let hasDailyUpdates = false;
    let hasGlobalUpdatesAI = false;
    let hasDailyUpdatesAI = false;

    for (const [key, amount] of Object.entries(batchedQueue)) {
        if (key in globalColumnMap) {
            const globalKey = key as GlobalMetricKeyWithoutAI;
            if (globalKey === 'lastSyncedAt') {
                const now = new Date().toISOString();
                globalInsert[globalKey] = now;
                globalUpdate[globalKey] = now;
            } else if(globalKey === 'habitsStreakMaxDaily' || globalKey === 'habitsStreakMaxWeekly')
            {
                globalInsert[globalKey] = Math.max(0, amount);
                globalUpdate[globalKey] = sql`MAX(COALESCE(${globalMetrics[globalKey]}, 0) ,${amount})`;
            }
            else {
                globalInsert[globalKey] = Math.max(0, amount);
                globalUpdate[globalKey] = sql`MAX(0, COALESCE(${globalMetrics[globalKey]}, 0) + ${amount})`;
            }
            hasGlobalUpdates = true;
        }

        if (key in dailyColumnMap) {
            const dailyKey = key as DailyMetricKey;
            dailyInsert[dailyKey] = Math.max(0, amount);
            dailyUpdate[dailyKey] = sql`MAX(0, COALESCE(${dailyMetrics[dailyKey]}, 0) + ${amount})`;
            hasDailyUpdates = true;
        }
    }
for (const [key, amount] of Object.entries(aiBatchedQueue)) {
    const globalKeyAI = key as GlobalMetricNums;
    if (globalKeyAI) {
      if(globalKeyAI === 'habitsStreakMaxDaily' || globalKeyAI === 'habitsStreakMaxWeekly')
      {
        globalInsertAI[globalKeyAI] = Math.max(0, amount);
        globalUpdateAI[globalKeyAI] = sql`MAX(COALESCE(${globalMetricsAI[globalKeyAI]}, 0) ,${amount})`;
      }
      else {
        globalInsertAI[globalKeyAI] = Math.max(0, amount);
        globalUpdateAI[globalKeyAI] = sql`MAX(0, COALESCE(${globalMetricsAI[globalKeyAI]}, 0) + ${amount})`;
      }
      hasGlobalUpdatesAI = true;
    }

    const dailyKeyAI = key as DailyMetricKey;
    dailyInsertAI[dailyKeyAI] = Math.max(0, amount);
    dailyUpdateAI[dailyKeyAI] = sql`MAX(0, COALESCE(${dailyMetricsAI[dailyKeyAI]}, 0) + ${amount})`;
    hasDailyUpdatesAI = true;
  }
    // 2. Execute true O(1) upserts within a single transaction
    await db.transaction(async (tx) => {
        if (hasGlobalUpdates) {
            await tx
                .insert(globalMetrics)
                .values(globalInsert) // Uses the safe, static numbers
                .onConflictDoUpdate({
                    target: globalMetrics.id,
                    set: globalUpdate, // Uses the SQL increment
                });
        }

        if (hasDailyUpdates) {
            await tx
                .insert(dailyMetrics)
                .values(dailyInsert)
                .onConflictDoUpdate({
                    target: dailyMetrics.date,
                    set: dailyUpdate,
                });
        }

         if (hasGlobalUpdatesAI) {
            await tx
                .insert(globalMetricsAI)
                .values(globalInsertAI) // Uses the safe, static numbers
                .onConflictDoUpdate({
                    target: globalMetricsAI.id,
                    set: globalUpdateAI, // Uses the SQL increment
                });
        }

        if (hasDailyUpdatesAI) {
            await tx
                .insert(dailyMetricsAI)
                .values(dailyInsertAI)
                .onConflictDoUpdate({
                    target: dailyMetricsAI.date,
                    set: dailyUpdateAI,
                });
        }
    });


    // Note: We no longer return the full AppMetrics object here. 
    // The UI is already optimistically updated by the AnalyticsEngine via Mitt!
    console.log(`[MetricsRepo] Successfully wrote batched metrics to disk for ${dateString}.`);
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