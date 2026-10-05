import { useAchievementStore } from "@/stores/use-achievement-store";
import { useMetricStore } from "@/stores/use-metrics-store";
import { GlobalMetricKey } from "@/types/metrics";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

// Drop-in replacement for useData().trackMetric
export function trackMetric(
    keys: GlobalMetricKey[],
    amount: number,
    actor: "user" | "ai" = "user",
): void {
    metricsEventBus.emit("metric:track", { keys, amount, actor });
}

export async function resetMetricsWithEffects(): Promise<void> {
    await useMetricStore.getState().resetMetrics();
}

export async function resetAchievementsWithEffects(): Promise<void> {
    await useAchievementStore.getState().resetAchievements();
}