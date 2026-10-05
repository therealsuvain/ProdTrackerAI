import { useAchievementStore } from "@/stores/use-achievement-store";
import { useMetricStore } from "@/stores/use-metrics-store";
import { GlobalMetricNums } from "@/types/metrics";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

let started = false;

export function initMetricsPipeline(): void {
    if (started) return;
    started = true;

    metricsEventBus.on("metric:track", ({ keys, amount, actor = "user" }) => {
        try {
            if (amount === 0) return;
            const numericKeys = keys.filter(
                (k) => k !== "syncedAt" && k !== "aiMetrics",
            ) as GlobalMetricNums[];
            if (numericKeys.length === 0) return;
            useMetricStore.getState().applyTrack(numericKeys, amount, actor);
            useAchievementStore.getState().evaluate(numericKeys, amount);
        } catch (err) {
            console.error("[metrics-pipeline] failed:", err); // never fail the user's action
        }
    });
}