import type { Task } from "@/types/task";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";
import {
    buildItemSearchMetadata,
    isEligibleSearchRecord,
} from "./common";

export const taskSearchProvider: GlobalSearchProvider<
    readonly Task[]
> = {
    id: "task",

    buildDocuments(tasks, context) {
        return tasks
            .filter(isEligibleSearchRecord)
            .map((task): GlobalSearchDocument => {
                const metadata = buildItemSearchMetadata(
                    task.tags,
                    task.category,
                    context,
                    task.description,
                );

                const status = task.completed ? "Completed" : "Incomplete";
                const priority = `${task.priority} priority`;

                return {
                    key: getGlobalSearchKey({
                        kind: "task",
                        id: task.id,
                    }),
                    kind: "task",
                    target: {
                        kind: "task",
                        id: task.id,
                    },
                    display: {
                        title: task.title,
                        subtitle: `${status} · ${priority}`,
                        presentation: {
                            icon: {
                                family: "material-community",
                                name: "checkbox-marked-circle-outline",
                            },
                        },
                    },
                    fields: metadata.fields,
                    facets: metadata.facets,
                };
            });
    },
};