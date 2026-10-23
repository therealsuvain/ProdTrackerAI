import type { CalendarEvent } from "@/types/calendar";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";
import {
    buildItemSearchMetadata,
    isEligibleSearchRecord,
} from "./common";

export const eventSearchProvider: GlobalSearchProvider<
    readonly CalendarEvent[]
> = {
    id: "event",

    buildDocuments(events, context) {
        return events
            .filter(isEligibleSearchRecord)
            .map((event): GlobalSearchDocument => {
                const metadata = buildItemSearchMetadata(
                    event.tags,
                    event.category,
                    context,
                    event.description,
                );

                return {
                    key: getGlobalSearchKey({
                        kind: "event",
                        id: event.id,
                    }),
                    kind: "event",
                    target: {
                        kind: "event",
                        id: event.id,
                    },
                    display: {
                        title: event.title,
                        subtitle: `${event.startDate} · ${event.startTime}`,
                        presentation: {
                            icon: {
                                family: "material-community",
                                name: "calendar-blank-outline",
                            },
                        },
                    },
                    fields: metadata.fields,
                    facets: metadata.facets,
                };
            });
    },
};