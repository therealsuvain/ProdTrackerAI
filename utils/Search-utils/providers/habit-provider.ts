import type { Habit } from "@/types/habits";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";
import {
    buildItemSearchMetadata,
    isEligibleSearchRecord,
} from "./common";

export const habitSearchProvider: GlobalSearchProvider<
    readonly Habit[]
> = {
    id: "habit",

    buildDocuments(habits, context) {
        return habits
            .filter(isEligibleSearchRecord)
            .map((habit): GlobalSearchDocument => {
                const metadata = buildItemSearchMetadata(
                    habit.tags,
                    habit.category,
                    context,
                    habit.description,
                );

                return {
                    key: getGlobalSearchKey({
                        kind: "habit",
                        id: habit.id,
                    }),
                    kind: "habit",
                    target: {
                        kind: "habit",
                        id: habit.id,
                    },
                    display: {
                        title: habit.title,
                        subtitle: `${habit.frequency === "daily" ? "Daily" : "Weekly"} habit`,
                        presentation: {
                            icon: {
                                family: "material-community",
                                name: "sprout",
                            },
                        },
                    },
                    fields: metadata.fields,
                    facets: metadata.facets,
                };
            });
    },
};