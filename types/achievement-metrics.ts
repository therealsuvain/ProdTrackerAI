import { AppMetrics, DailyMetricKey, DailyMetrics } from "./metrics";
/* export interface AchievementMetrics extends DailyMetrics {
    syncedAt?: string;
} */

export type AchievementMetrics = AppMetrics['global'];
export type AchievementMetricKeyWithoutAI = keyof Omit<AchievementMetrics, 'aiMetrics'>;