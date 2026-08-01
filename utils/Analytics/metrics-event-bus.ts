import mitt from 'mitt';
import { GlobalMetricKey, DailyMetricKey } from '@/types/metrics'; // Adjust path

type AnyMetricKey = GlobalMetricKey | DailyMetricKey;

// 1. Define strict types for all events traversing our app
type ApplicationEvents = {
    // Fired by UI components when a user performs an action
    'metric:track': { keys: AnyMetricKey[]; amount: number, actor?: 'user' | 'ai' };

    // Fired by the AnalyticsEngine to tell the UI to optimistically update
    'metric:optimistic_update': Record<string, number>;
    'metric:optimistic_update_ai': Record<AnyMetricKey, number>;
};

// 2. Instantiate and export the singleton event bus
export const metricsEventBus = mitt<ApplicationEvents>();