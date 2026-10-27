import type { Category } from "@/types/category";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";

export const categorySearchProvider: GlobalSearchProvider<
    readonly Category[]
> = {
    id: "category",

    buildDocuments(categories) {
        return categories.map(
            (category): GlobalSearchDocument => ({
                key: getGlobalSearchKey({
                    kind: "category",
                    id: category.id,
                }),
                kind: "category",
                target: {
                    kind: "category",
                    id: category.id,
                },
                display: {
                    title: category.name,
                    subtitle: "Category",
                    presentation: {
                        icon: {
                            family: "ionicons",
                            name: category.icon || "shape-outline",
                        },
                        accentColor: category.color,
                    },
                },
                fields: [],
            }),
        );
    },
};