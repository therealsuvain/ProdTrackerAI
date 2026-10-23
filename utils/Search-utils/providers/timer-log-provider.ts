import type { TimerLog } from "@/types/timer";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";
import {
    buildItemSearchMetadata,
    isEligibleSearchRecord,
} from "./common";

function formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    if (minutes > 0) {
        return `${minutes}m`;
    }

    return `${remainingSeconds}s`;
}

export const timerLogSearchProvider: GlobalSearchProvider<
    readonly TimerLog[]
> = {
    id: "log",

    buildDocuments(logs, context) {
        return logs
            .filter(isEligibleSearchRecord)
            .map((log): GlobalSearchDocument => {
                const metadata = buildItemSearchMetadata(
                    log.tags,
                    log.category,
                    context,
                );

                const date = log.startTime.slice(0, 10);
                const duration =
                    log.duration !== undefined
                        ? formatDuration(log.duration)
                        : undefined;

                return {
                    key: getGlobalSearchKey({
                        kind: "log",
                        id: log.id,
                    }),
                    kind: "log",
                    target: {
                        kind: "log",
                        id: log.id,
                    },
                    display: {
                        title: log.title,
                        subtitle: duration ? `${date} · ${duration}` : date,
                        presentation: {
                            icon: {
                                family: "material-community",
                                name: "timer-outline",
                            },
                        },
                    },
                    fields: metadata.fields,
                    facets: metadata.facets,
                };
            });
    },
};