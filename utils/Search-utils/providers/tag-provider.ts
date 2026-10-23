import type { Tag } from "@/types/tag";
import {
    getGlobalSearchKey,
    type GlobalSearchDocument,
    type GlobalSearchProvider,
} from "@/types/global-search";

export const tagSearchProvider: GlobalSearchProvider<readonly Tag[]> = {
    id: "tag",

    buildDocuments(tags) {
        return tags.map(
            (tag): GlobalSearchDocument => ({
                key: getGlobalSearchKey({
                    kind: "tag",
                    id: tag.id,
                }),
                kind: "tag",
                target: {
                    kind: "tag",
                    id: tag.id,
                },
                display: {
                    title: tag.name,
                    subtitle: "Tag",
                    presentation: {
                        icon: {
                            family: "material-community",
                            name: "tag-outline",
                        },
                        accentColor: "#A0A0A0",
                    },
                },
                fields: [],
            }),
        );
    },
};