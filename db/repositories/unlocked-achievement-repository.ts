import { eq, desc, asc } from "drizzle-orm";
import { db, unlockedAchievements } from "@/db";
import type { AchievementBadge, AchievementTier } from "@/types/achievements";
import type { UnlockedAchievementsRow, UnlockedAchievementsInsert } from "@/db/schema";

// ─── type converters ──────────────────────────────────────────────────────────

function rowToUnlockedAchievements(row: UnlockedAchievementsRow): AchievementBadge {
    return {
        id: row.id,
       title: row.title,
       description: row.description,
       unlockedDescription: row.unlockedDescription,
       tier: row.tier,
       target: row.target,
       unlockedAt: row.unlockedAt
    };
}

function achievementBadgeToInsert(achievement: AchievementBadge): UnlockedAchievementsInsert {
    const now = new Date().toISOString();
    return {
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        unlockedDescription: achievement.unlockedDescription,
        tier: achievement.tier,
        target: achievement.target,
        unlockedAt: achievement.unlockedAt
    };
}

export async function getAllUnlockedAchievementss(): Promise<AchievementBadge[]> {
    const rows = await db
        .select()
        .from(unlockedAchievements)
        .orderBy(desc(unlockedAchievements.unlockedAt));
    return rows.map(rowToUnlockedAchievements);
}

export async function insertUnlockedAchievements(achievement: AchievementBadge): Promise<AchievementBadge> {
    const insert =achievementBadgeToInsert(achievement);
    await db.insert(unlockedAchievements).values(insert);
    // Return with the exact timestamps that were written
    return rowToUnlockedAchievements({ ...insert } as UnlockedAchievementsRow);
}

export async function bulkInsertUnlockedAchievements(achievementList: AchievementBadge[]): Promise<void> {
    if (achievementList.length === 0) return;

    await db.transaction(async (tx) => {
        for (const achievement of achievementList) {
            await tx
                .insert(unlockedAchievements)
                .values(achievementBadgeToInsert(achievement))
                .onConflictDoNothing(); // safe to re-run migration
        }
    });
}
export async function countUnlockedAchievements(): Promise<number> {
    const result = await db.select({ id: unlockedAchievements.id }).from(unlockedAchievements);
    return result.length;
}
