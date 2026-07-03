import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { GlobalMetricKey, DailyMetricKey } from '@/types/metrics'; // Adjust import path
import { metricsEventBus } from './metrics-event-bus';
import { mutateMetricInDb } from '@/db/repositories/metrics-repository';

type AnyMetricKey = GlobalMetricKey | DailyMetricKey;

class AnalyticsEngine {
    // The In-Memory Queue for Write-Behind Caching
    private pendingMetrics: Record<string, number> = {};
    private flushIntervalId?: ReturnType<typeof setInterval> | null = null;
    private appStateSubscription?: NativeEventSubscription;
    private isFlushing: boolean = false;

    constructor() {
        metricsEventBus.on('metric:track', this.handleTrackEvent);
    }

    /**
   * The listener for the UI events
   */
    private handleTrackEvent = ({ keys, amount }: { keys: GlobalMetricKey[], amount: number }) => {
        if (keys.length === 0 || amount === 0) return;

        // 1. Update the in-memory queue
        keys.forEach((key) => {
            this.pendingMetrics[key] = (this.pendingMetrics[key] || 0) + amount;
        });

        // 2. Broadcast the snapshot back to the UI for instant re-renders (Achievements, etc.)
        metricsEventBus.emit('metric:optimistic_update', { ...this.pendingMetrics });
    };

    // ============================================================================
    // BACKGROUND SYNC & LIFECYCLE (Phase 2 intact)
    // ============================================================================

    public initBackgroundSync(flushIntervalMs: number = 20000) {
        this.flushIntervalId = setInterval(() => {
            this.flushQueue();
        }, flushIntervalMs);

        this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    }

    public destroy() {
        metricsEventBus.off('metric:track', this.handleTrackEvent);
        if (this.flushIntervalId) clearInterval(this.flushIntervalId);
        if (this.appStateSubscription) this.appStateSubscription.remove();
    }

    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'inactive' || nextAppState === 'background') {
            this.flushQueue();
        }
    };

    private async flushQueue() {
        if (this.isFlushing) return;

        const keys = Object.keys(this.pendingMetrics) as AnyMetricKey[];
        if (keys.length === 0) return;

        this.isFlushing = true;
        const queueToFlush = { ...this.pendingMetrics };
        this.pendingMetrics = {}; // Sync reset

        try {
            // Phase 3 hook: Ready for Drizzle batched upsert
            await mutateMetricInDb(queueToFlush);
            console.log(`[AnalyticsEngine] Flushed ${keys.length} metric types via Mitt.`);
        } catch (error) {
            console.error("[AnalyticsEngine] Failed to flush metrics:", error);

            // Rollback memory queue gracefully
            Object.entries(queueToFlush).forEach(([key, amount]) => {
                this.pendingMetrics[key] = (this.pendingMetrics[key] || 0) + amount;
            });
        } finally {
            this.isFlushing = false;
        }
    }
}

// Export as a Singleton so the entire app shares the exact same queue
export const analyticsEngine = new AnalyticsEngine();