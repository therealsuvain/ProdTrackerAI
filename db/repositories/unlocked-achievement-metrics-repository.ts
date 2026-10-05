import { achievementGlobalMetrics, achievementGlobalMetricsAI, db, globalMetrics } from "@/db";
import {
    AchievementGlobalMetricsAIInsert,
    globalMetricsAI,
    type AchievementGlobalMetricsAIRow,
    type AchievementGlobalMetricsInsert,
    type AchievementGlobalMetricsRow,
} from "@/db/schema";
import { AchievementMetricKeyWithoutAI, AchievementMetrics } from "@/types/achievement-metrics";
import { defaultGlobal, globalRowToObject } from "./metrics-repository";
/* import type {
    AchievementMetrics,
} from "@/types/achievement-metrics";
 */

const achievementGlobalColumnMap: Record<AchievementMetricKeyWithoutAI, keyof AchievementGlobalMetricsRow> = {
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
    syncedAt: "syncedAt",

};


// ─── converters ───────────────────────────────────────────────────────────────

function achievementGlobalRowToObject(row: AchievementGlobalMetricsRow, aiRow: AchievementGlobalMetricsAIRow): AchievementMetrics {
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
        tagsAssigned: row.tagsAssigned,
        tagsDeleted: row.tagsDeleted,
        categoriesAdded: row.categoriesAdded,
        categoriesAssigned: row.categoriesAssigned,
        categoriesDeleted: row.categoriesDeleted,
        logsAdded: row.logsAdded,
        logsDeleted: row.logsDeleted,
        tasksEdited: row.tasksEdited,
        habitsEdited: row.habitsEdited,
        eventsEdited: row.eventsEdited,
        logsEdited: row.logsEdited,
        tagsEdited: row.tagsEdited,
        categoriesEdited: row.categoriesEdited,
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
            tagsAssigned: aiRow.tagsAssigned,
            tagsDeleted: aiRow.tagsDeleted,
            categoriesAdded: aiRow.categoriesAdded,
            categoriesAssigned: aiRow.categoriesAssigned,
            categoriesDeleted: aiRow.categoriesDeleted,
            logsAdded: aiRow.logsAdded,
            logsDeleted: aiRow.logsDeleted,
            tasksEdited: aiRow.tasksEdited,
            habitsEdited: aiRow.habitsEdited,
            eventsEdited: aiRow.eventsEdited,
            logsEdited: aiRow.logsEdited,
            tagsEdited: aiRow.tagsEdited,
            categoriesEdited: aiRow.categoriesEdited,
        },
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
    tagsAssigned: 0,
    tagsDeleted: 0,
    categoriesAdded: 0,
    categoriesAssigned: 0,
    categoriesDeleted: 0,
    logsAdded: 0,
    logsDeleted: 0,
    tagsAdded: 0,
    tasksEdited: 0,
    habitsEdited: 0,
    eventsEdited: 0,
    logsEdited: 0,
    tagsEdited: 0,
    categoriesEdited: 0,
    aiMetrics: {
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
        tagsAssigned: 0,
        tagsDeleted: 0,
        categoriesAdded: 0,
        categoriesAssigned: 0,
        categoriesDeleted: 0,
        logsAdded: 0,
        logsDeleted: 0,
        tagsAdded: 0,
        tasksEdited: 0,
        habitsEdited: 0,
        eventsEdited: 0,
        logsEdited: 0,
        tagsEdited: 0,
        categoriesEdited: 0,
    },
    syncedAt: undefined,
};

// ─── read operations ──────────────────────────────────────────────────────────

/**
 * Load the full AppMetrics object from both tables.
 * Direct replacement for loadAppMetrics() in storage-utils.ts.
 */
export async function loadAchievementMetrics(): Promise<AchievementMetrics> {
    const [globalAchievementRows, globalAchievementRowsAI] = await Promise.all([
        db.select().from(achievementGlobalMetrics).limit(1),
        db.select().from(achievementGlobalMetricsAI).limit(1),
    ]);

    const globalAchievementData = globalAchievementRows.length > 0 ? globalAchievementRows[0] : { id: 1, ...defaultAchievementGlobal.aiMetrics, updatedAt: null, syncedSnapshot: null, syncedAt: null };
    const globalAchievementDataAI = globalAchievementRowsAI.length > 0 ? globalAchievementRowsAI[0] : { id: 1, ...defaultAchievementGlobal.aiMetrics, updatedAt: null, syncedSnapshot: null, syncedAt: null };
    const globalData: AchievementMetrics = achievementGlobalRowToObject(globalAchievementData, globalAchievementDataAI);
    return globalData;
}

export async function mutateAchievementMetricsOnReset(): Promise<void> {

    await db.transaction(async (tx) => {
        // ── global row ────────────────────────────────────────────────────────
        /*  const achievementsGlobalRows = await tx.select().from(achievementGlobalMetrics).limit(1);
         const currentAchievementGlobal: AchievementMetrics =
             achievementsGlobalRows.length > 0 ? achievementGlobalRowToObject(achievementsGlobalRows[0]) : { ...defaultAchievementGlobal }; */
        const [globalRows, globalRowsAI] = await Promise.all([
            tx.select().from(globalMetrics).limit(1),
            tx.select().from(globalMetricsAI).limit(1),
        ]);

        const globalAIData = globalRowsAI.length > 0 ? globalRowsAI[0] : { id: 1, ...defaultGlobal.aiMetrics, updatedAt: null, syncedSnapshot: null, syncedAt: null };
        const globalDataHold = globalRows.length > 0 ? globalRows[0] : { id: 1, ...defaultGlobal.aiMetrics, updatedAt: null, syncedSnapshot: null, syncedAt: null };
        const currentGlobal = globalRowToObject(globalDataHold, globalAIData);
        /* const globalRows = await tx.select().from(globalMetrics).limit(1);
        const currentGlobal = globalRows.length > 0 ? globalRowToObject(globalRows[0], globalRows[0].aiMetrics) : { ...defaultGlobal }; */
        // Apply delta to global keys with floor of 0
        // Copy current global metrics values into achievement table as new baseline
        const updatedGlobal = {
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
            habitsCheckedInBefore8am: currentGlobal.habitsCheckedInBefore8am,
            habitsCheckedInAfter10pm: currentGlobal.habitsCheckedInAfter10pm,
            habitsGoalsCompleted: currentGlobal.habitsGoalsCompleted,
            habitGoalsRestarted: currentGlobal.habitGoalsRestarted,
            habitCheckInsMissed: currentGlobal.habitCheckInsMissed,
            habitsStreakMaxDaily: currentGlobal.habitsStreakMaxDaily,
            habitsStreakMaxWeekly: currentGlobal.habitsStreakMaxWeekly,
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
            tagsAdded: currentGlobal.tagsAdded,
            tagsAssigned: currentGlobal.tagsAssigned,
            tagsDeleted: currentGlobal.tagsDeleted,
            categoriesAdded: currentGlobal.categoriesAdded,
            categoriesAssigned: currentGlobal.categoriesAssigned,
            categoriesDeleted: currentGlobal.categoriesDeleted,
            logsAdded: currentGlobal.logsAdded,
            logsDeleted: currentGlobal.logsDeleted,
            tasksEdited: currentGlobal.tasksEdited,
            habitsEdited: currentGlobal.habitsEdited,
            eventsEdited: currentGlobal.eventsEdited,
            logsEdited: currentGlobal.logsEdited,
            tagsEdited: currentGlobal.tagsEdited,
            categoriesEdited: currentGlobal.categoriesEdited,
            syncedAt: currentGlobal.syncedAt,
        };

        // Upsert global row (always id = 1)
        await tx
            .insert(achievementGlobalMetrics)
            .values({ id: 1, ...updatedGlobal })
            .onConflictDoUpdate({
                target: achievementGlobalMetrics.id,
                set: updatedGlobal as Partial<AchievementGlobalMetricsInsert>,
            });

        await tx
            .insert(achievementGlobalMetricsAI)
            .values({ id: 1, ...currentGlobal.aiMetrics })
            .onConflictDoUpdate({
                target: achievementGlobalMetricsAI.id,
                set: currentGlobal.aiMetrics as Partial<AchievementGlobalMetricsAIInsert>,
            });
    });
}

export async function deleteAllAchievementMetrics() {
    await db.delete(achievementGlobalMetrics);
}
