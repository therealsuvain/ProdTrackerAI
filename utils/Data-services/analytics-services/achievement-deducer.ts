import { AchievementBadge } from "@/types/achievements";
import {
    ACHIEVEMENTS_ACHIEVEMENTS,
    ALL_ACHIEVEMENTS,
    AchievementDefinition,
} from "@/types/achievements-ui";
import { GlobalMetricNums } from "@/types/metrics";

const definitionsByMetric = new Map<string, AchievementDefinition[]>();
for (const def of ALL_ACHIEVEMENTS) {
    if (def.metricTrigger === "meta") continue;
    const list = definitionsByMetric.get(def.metricTrigger) ?? [];
    list.push(def);
    definitionsByMetric.set(def.metricTrigger, list);
}
for (const list of definitionsByMetric.values()) list.sort((a, b) => a.target - b.target);

export const hasAchievementsFor = (key: string): boolean => definitionsByMetric.has(key);

const toBadge = (def: AchievementDefinition, unlockedAt: string): AchievementBadge => {
    const { metricTrigger, ...rest } = def;
    return { ...rest, unlockedAt };
};

// Both functions add newly unlocked ids to `unlockedIds` as they go.
export function findNewlyUnlocked(
    unlockedIds: Set<string>,
    value: number,
    key: GlobalMetricNums,
    now: string,
): AchievementBadge[] {
    const defs = definitionsByMetric.get(key);
    if (!defs) return [];
    const result: AchievementBadge[] = [];
    for (const def of defs) {
        if (def.target > value) break;
        if (unlockedIds.has(def.id)) continue;
        unlockedIds.add(def.id);
        result.push(toBadge(def, now));
    }
    return result;
}

export function findNewlyUnlockedMeta(unlockedIds: Set<string>, now: string): AchievementBadge[] {
    const result: AchievementBadge[] = [];
    for (const meta of ACHIEVEMENTS_ACHIEVEMENTS) {
        if (unlockedIds.size >= meta.target && !unlockedIds.has(meta.id)) {
            unlockedIds.add(meta.id);
            result.push(toBadge(meta, now));
        }
    }
    return result;
}