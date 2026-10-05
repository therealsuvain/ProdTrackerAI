import { create } from "zustand";

import {
    deleteAllUnlockedAchievements,
    getAllUnlockedAchievements,
    insertUnlockedAchievements,
} from "@/db/repositories/unlocked-achievement-repository";
import {
    loadAchievementMetrics,
    mutateAchievementMetricsOnReset,
} from "@/db/repositories/unlocked-achievement-metrics-repository";
import { useMetricStore } from "@/stores/use-metrics-store";
import { AchievementBadge } from "@/types/achievements";
import { GlobalMetricNums } from "@/types/metrics";
import {
    findNewlyUnlocked,
    findNewlyUnlockedMeta,
    hasAchievementsFor,
} from "@/utils/Data-services/analytics-services/achievement-deducer";

type Baseline = Partial<Record<GlobalMetricNums, number>>;

type AchievementStoreState = {
    unlockedById: Record<string, AchievementBadge>;
    baseline: Baseline;
    activeBadge: AchievementBadge | null;

    evaluate: (keys: GlobalMetricNums[], amount: number) => void;
    refreshAchievements: () => Promise<void>;
    resetAchievements: () => Promise<void>;
};

export const selectUnlockedList = (s: { unlockedById: Record<string, AchievementBadge> }) =>
    Object.values(s.unlockedById).sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));

export const useAchievementStore = create<AchievementStoreState>((set, get) => {
    const toastQueue: AchievementBadge[] = [];
    let isToasting = false;

    const processToastQueue = () => {
        if (isToasting || toastQueue.length === 0) return;
        isToasting = true;
        set({ activeBadge: toastQueue.shift()! });
        setTimeout(() => {
            set({ activeBadge: null });
            setTimeout(() => {
                isToasting = false;
                processToastQueue();
            }, 500);
        }, 6000);
    };

    const commit = (badges: AchievementBadge[]) => {
        // State first, DB second: overlapping events can't double-unlock.
        set((s) => {
            const next = { ...s.unlockedById };
            for (const b of badges) next[b.id] = b;
            return { unlockedById: next };
        });
        for (const badge of badges) {
            insertUnlockedAchievements(badge).catch((err) => {
                console.error("[achievements] persist failed, rolling back:", err);
                set((s) => {
                    const next = { ...s.unlockedById };
                    delete next[badge.id];
                    return { unlockedById: next };
                });
            });
        }
        toastQueue.push(...badges);
        processToastQueue();
    };

    return {
        unlockedById: {},
        baseline: {},
        activeBadge: null,

        evaluate: (keys, amount) => {
            if (amount <= 0) return;
            const relevant = [...new Set(keys)].filter(hasAchievementsFor);
            if (relevant.length === 0) return; // the common case

            const { global } = useMetricStore.getState();
            const { unlockedById, baseline } = get();
            const unlockedIds = new Set(Object.keys(unlockedById));
            const now = new Date().toISOString();

            const newly: AchievementBadge[] = [];
            for (const key of relevant) {
                newly.push(...findNewlyUnlocked(unlockedIds, global[key] - (baseline[key] ?? 0), key, now));
            }
            if (newly.length > 0) newly.push(...findNewlyUnlockedMeta(unlockedIds, now));
            if (newly.length > 0) commit(newly);
        },

        refreshAchievements: async () => {
            const [unlocked, baseline] = await Promise.all([
                getAllUnlockedAchievements(),
                loadAchievementMetrics(),
            ]);
            const unlockedById: Record<string, AchievementBadge> = {};
            for (const badge of unlocked) unlockedById[badge.id] = badge;
            set({ unlockedById, baseline });
        },

        resetAchievements: async () => {
            await deleteAllUnlockedAchievements();
            await mutateAchievementMetricsOnReset();
            toastQueue.length = 0;
            set({
                unlockedById: {},
                activeBadge: null,
                baseline: { ...useMetricStore.getState().global } as Baseline,
            });
        },
    };
});