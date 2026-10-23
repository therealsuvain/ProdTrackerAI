import type {
    GlobalSearchField,
    GlobalSearchProviderContext,
} from "@/types/global-search";

export interface ItemSearchMetadata {
    fields: readonly GlobalSearchField[];
    facets: {
        tagIds: readonly string[];
        categoryIds: readonly string[];
    };
}

export function buildItemSearchMetadata(
    tags: readonly string[] | undefined,
    categoryId: string | undefined,
    context: GlobalSearchProviderContext,
    description?: string,
): ItemSearchMetadata {
    const tagIds = [...new Set(tags ?? [])];
    const categoryIds = categoryId ? [categoryId] : [];
    const fields: GlobalSearchField[] = [];

    if (description?.trim()) {
        fields.push({
            kind: "description",
            value: description.trim(),
        });
    }

    for (const tagId of tagIds) {
        const tag = context.tagsById.get(tagId);

        if (tag) {
            fields.push({
                kind: "tag",
                value: tag.name,
                sourceId: tagId,
            });
        }
    }

    if (categoryId) {
        const category = context.categoriesById.get(categoryId);

        if (category) {
            fields.push({
                kind: "category",
                value: category.name,
                sourceId: categoryId,
            });
        }
    }

    return {
        fields,
        facets: {
            tagIds,
            categoryIds,
        },
    };
}

/**
 * Defensively exclude records that still exist in a store but are
 * marked deleted or archived. Completion is intentionally not checked.
 */
export function isEligibleSearchRecord(record: object): boolean {
    const value = record as Record<string, unknown>;

    const deletedAt = value.deletedAt ?? value.deleted_at;
    const archivedAt = value.archivedAt ?? value.archived_at;

    return (
        !deletedAt &&
        !archivedAt &&
        value.isDeleted !== true &&
        value.isArchived !== true &&
        value.archived !== true
    );
}