import { useMemo } from "react";
import { create } from "zustand";

import { deleteAllMetrics, loadAppMetricsFromDb } from "@/db/repositories/metrics-repository";
import { AppMetrics, DailyMetricsWithAI, DefaultMetrics, GlobalMetricNums } from "@/types/metrics";
import {
    MetricActor,
    applyDailyDelta,
    applyGlobalDelta,
    emptyDay,
    metricDateKey,
} from "@/utils/Data-services/analytics-services/metric-reducer";

type MetricStoreState = {
    global: AppMetrics["global"];
    today: { date: string; metrics: DailyMetricsWithAI };
    history: AppMetrics["daily"];
    loaded: boolean;

    applyTrack: (keys: GlobalMetricNums[], amount: number, actor: MetricActor) => void;
    refreshMetrics: () => Promise<void>;
    resetMetrics: () => Promise<void>;
};

const freshGlobal = (): AppMetrics["global"] => ({
    ...DefaultMetrics.global,
    aiMetrics: { ...DefaultMetrics.global.aiMetrics },
});

export const useMetricStore = create<MetricStoreState>((set) => ({
    global: freshGlobal(),
    today: { date: metricDateKey(), metrics: emptyDay() },
    history: {},
    loaded: false,

    // Synchronous and allocation-light: touches `global` and today's entry only.
    applyTrack: (keys, amount, actor) =>
        set((state) => {
            const date = metricDateKey();
            let history = state.history;
            let todayMetrics = state.today.metrics;
            if (state.today.date !== date) {
                history = { ...history, [state.today.date]: todayMetrics };
                todayMetrics = emptyDay();
            }
            return {
                global: applyGlobalDelta(state.global, keys, amount, actor),
                today: { date, metrics: applyDailyDelta(todayMetrics, keys, amount, actor) },
                history,
            };
        }),

    refreshMetrics: async () => {
        const loaded = await loadAppMetricsFromDb();
        const date = metricDateKey();
        const { [date]: todayMetrics, ...history } = loaded.daily;
        set({
            global: loaded.global,
            today: { date, metrics: todayMetrics ?? emptyDay() },
            history,
            loaded: true,
        });
    },

    resetMetrics: async () => {
        await deleteAllMetrics();
        set({
            global: freshGlobal(),
            today: { date: metricDateKey(), metrics: emptyDay() },
            history: {},
        });
    },
}));

// For the analytics screen: the full date-keyed map, rebuilt only while mounted.
export const useDailyMetrics = (): AppMetrics["daily"] => {
    const history = useMetricStore((s) => s.history);
    const today = useMetricStore((s) => s.today);
    return useMemo(() => ({ ...history, [today.date]: today.metrics }), [history, today]);
};