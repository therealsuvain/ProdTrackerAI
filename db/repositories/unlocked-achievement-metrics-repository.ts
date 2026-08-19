import { achievementGlobalMetrics, db, globalMetrics } from "@/db";
import type {
    AchievementGlobalMetricsInsert,
    AchievementGlobalMetricsRow,
} from "@/db/schema";
import { AchievementMetrics } from "@/types/achievement-metrics";
import { defaultGlobal, globalRowToObject } from "./metrics-repository";
/* import type {
    AchievementMetrics,
} from "@/types/achievement-metrics";
 */

const achievementGlobalColumnMap: Record<keyof AchievementMetrics, keyof AchievementGlobalMetricsRow> = {
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
    habitsGoalsCompleted: "habitsGoalsCompleted",
    habitGoalsRestarted: "habitGoalsRestarted",
    habitCheckInsMissed: "habitCheckInsMissed",
    habitsStreakMax: "habitsStreakMax",
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
    syncedAt: "syncedAt",
};


// ─── converters ───────────────────────────────────────────────────────────────

function achievementGlobalRowToObject(row: AchievementGlobalMetricsRow): AchievementMetrics {
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
        habitsGoalsCompleted: row.habitsGoalsCompleted,
        habitGoalsRestarted: row.habitGoalsRestarted,
        habitCheckInsMissed: row.habitCheckInsMissed,
        habitsStreakMax: row.habitsStreakMax,
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
        syncedAt: row.syncedAt ?? undefined,
    };
}

const defaultAchievementGlobal: AchievementMetrics = {
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
    habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0,
    habitCheckInsMissed: 0,
    habitsStreakMax: 0,
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
};

// ─── read operations ──────────────────────────────────────────────────────────

/**
 * Load the full AppMetrics object from both tables.
 * Direct replacement for loadAppMetrics() in storage-utils.ts.
 */
export async function loadAchievementMetrics(): Promise<AchievementMetrics> {
    const [globalRows] = await Promise.all([
        db.select().from(achievementGlobalMetrics).limit(1),
    ]);

    const globalData: AchievementMetrics =
        globalRows.length > 0 ? achievementGlobalRowToObject(globalRows[0]) : { ...defaultAchievementGlobal };

    return globalData;
}

export async function mutateAchievementMetricsOnReset(): Promise<AchievementMetrics> {

    return await db.transaction(async (tx) => {
        // ── global row ────────────────────────────────────────────────────────
        const achievementsGlobalRows = await tx.select().from(achievementGlobalMetrics).limit(1);
        const currentAchievementGlobal: AchievementMetrics =
            achievementsGlobalRows.length > 0 ? achievementGlobalRowToObject(achievementsGlobalRows[0]) : { ...defaultAchievementGlobal };
        const globalRows = await tx.select().from(globalMetrics).limit(1);
        const currentGlobal = globalRows.length > 0 ? globalRowToObject(globalRows[0]) : { ...defaultGlobal };
        // Apply delta to global keys with floor of 0
        // Copy current global metrics values into achievement table as new baseline
        const updatedGlobal: AchievementMetrics = {
            tasksAdded: currentGlobal.tasksAdded,
            tasksCompleted: currentGlobal.tasksCompleted,
            tasksAbandoned: currentGlobal.tasksAbandoned,
            tasksMissed: currentGlobal.tasksMissed,
            tasksDeleted: currentGlobal.tasksDeleted,
            habitsAdded: currentGlobal.habitsAdded,
            habitsWithWeeklyGoals: currentGlobal.habitsWithWeeklyGoals,
            habitsWithDailyGoals: currentGlobal.habitsWithDailyGoals,
            habitsAbandoned: currentGlobal.habitsAbandoned,
            habitsCheckedIn: currentGlobal.habitsCheckedIn,
            habitsGoalsCompleted: currentGlobal.habitsGoalsCompleted,
            habitGoalsRestarted: currentGlobal.habitGoalsRestarted,
            habitCheckInsMissed: currentGlobal.habitCheckInsMissed,
            habitsStreakMax: currentGlobal.habitsStreakMax,
            habitsFrozen: currentGlobal.habitsFrozen,
            habitsAutoFrozen: currentGlobal.habitsAutoFrozen,
            habitsDeleted: currentGlobal.habitsDeleted,
            eventsAdded: currentGlobal.eventsAdded,
            eventsDeleted: currentGlobal.eventsDeleted,
            eventsEarlymorning: currentGlobal.eventsEarlymorning,
            eventsLatenight: currentGlobal.eventsLatenight,
            eventsOvernight: currentGlobal.eventsOvernight,
            eventsDaily: currentGlobal.eventsDaily,
            eventsWeekly: currentGlobal.eventsWeekly,
            eventsSingleton: currentGlobal.eventsSingleton,
            eventsInfinite: currentGlobal.eventsInfinite,
            timeTracked: currentGlobal.timeTracked,
            chatMessagesSent: currentGlobal.chatMessagesSent,
            chatActionsConfirmed: currentGlobal.chatActionsConfirmed,
            chatActionsExpired: currentGlobal.chatActionsExpired,
            chatActionsCancelled: currentGlobal.chatActionsCancelled,
        };

        // Upsert global row (always id = 1)
        await tx
            .insert(achievementGlobalMetrics)
            .values({ id: 1, ...updatedGlobal })
            .onConflictDoUpdate({
                target: achievementGlobalMetrics.id,
                set: updatedGlobal as Partial<AchievementGlobalMetricsInsert>,
            });

        return updatedGlobal;
    });
}

export async function deleteAllAchievementMetrics() {
    await db.delete(achievementGlobalMetrics);
}
