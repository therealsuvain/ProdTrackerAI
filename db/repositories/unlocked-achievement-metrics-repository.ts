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


// ─── converters ───────────────────────────────────────────────────────────────

function achievementGlobalRowToObject(row: AchievementGlobalMetricsRow): AchievementMetrics {
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

const defaultAchievementGlobal: AchievementMetrics = {
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
            tasksCompleted: currentGlobal.tasksCompleted,
            tasksMissed: currentGlobal.tasksMissed,
            habitsCheckedIn: currentGlobal.habitsCheckedIn,
            habitsGoalsCompleted: currentGlobal.habitsGoalsCompleted,
            habitCheckInsMissed: currentGlobal.habitCheckInsMissed,
            habitsStreakMax: currentGlobal.habitsStreakMax,
            habitsFrozen: currentGlobal.habitsFrozen,
            habitsAutoFrozen: currentGlobal.habitsAutoFrozen,
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
