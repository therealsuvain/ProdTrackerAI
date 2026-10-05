import {
    AppMetrics,
    DailyMetricsWithAI,
    DefaultDailyMetrics,
    GlobalMetricNums,
} from "@/types/metrics";

export type MetricActor = "user" | "ai";

// UTC date key, matching mutateMetricInDb so memory and DB agree after a reload.
export const metricDateKey = (): string => new Date().toISOString().split("T")[0];

const MAX_KEYS = new Set<string>(["habitsStreakMaxDaily", "habitsStreakMaxWeekly"]);

const bumpGlobal = (current: number, key: string, amount: number) =>
    MAX_KEYS.has(key) ? Math.max(current, amount) : Math.max(0, current + amount);

export const emptyDay = (): DailyMetricsWithAI => ({
    ...DefaultDailyMetrics,
    aiMetrics: { ...DefaultDailyMetrics.aiMetrics },
});

export function applyGlobalDelta(
    global: AppMetrics["global"],
    keys: GlobalMetricNums[],
    amount: number,
    actor: MetricActor,
): AppMetrics["global"] {
    const next = { ...global, aiMetrics: { ...global.aiMetrics } };
    for (const key of keys) {
        next[key] = bumpGlobal(next[key], key, amount); // totals include AI actions
        if (actor === "ai") next.aiMetrics[key] = bumpGlobal(next.aiMetrics[key], key, amount);
    }
    return next;
}

// The DB sums every key in the daily tables, including the streak keys.
export function applyDailyDelta(
    day: DailyMetricsWithAI,
    keys: GlobalMetricNums[],
    amount: number,
    actor: MetricActor,
): DailyMetricsWithAI {
    const next = { ...day, aiMetrics: { ...day.aiMetrics } };
    for (const key of keys) {
        next[key] = Math.max(0, next[key] + amount);
        if (actor === "ai") next.aiMetrics[key] = Math.max(0, next.aiMetrics[key] + amount);
    }
    return next;
}