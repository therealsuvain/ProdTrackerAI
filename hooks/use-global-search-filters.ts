import { useCallback, useState } from "react";

import type {
    GlobalSearchFilterKind,
    GlobalSearchFilters,
} from "@/types/global-search";

export function createDefaultGlobalSearchFilters(): GlobalSearchFilters {
    return {
        type: "all",
        categoryIds: [],
        tagIds: [],
        tagMatchMode: "all",
    };
}

function copyFilters(
    filters: GlobalSearchFilters,
): GlobalSearchFilters {
    return {
        ...filters,
        categoryIds: [...filters.categoryIds],
        tagIds: [...filters.tagIds],
    };
}

export function useGlobalSearchFilters() {
    const [filters, setFilters] = useState<GlobalSearchFilters>(
        createDefaultGlobalSearchFilters,
    );

    // null means the picker is closed. A non-null value is its draft.
    const [draftFilters, setDraftFilters] =
        useState<GlobalSearchFilters | null>(null);

    const isEditing = draftFilters !== null;

    const beginEditing = useCallback(() => {
        setDraftFilters((current) =>
            current ?? copyFilters(filters),
        );
    }, [filters]);

    const cancelEditing = useCallback(() => {
        setDraftFilters(null);
    }, []);

    const applyEditing = useCallback(() => {
        if (!draftFilters) return;

        setFilters(copyFilters(draftFilters));
        setDraftFilters(null);
    }, [draftFilters]);

    /**
     * Type chips are applied immediately.
     * Keep an open picker draft in sync so applying it cannot restore
     * an older type selection.
     */
    const setType = useCallback(
        (type: "all" | GlobalSearchFilterKind) => {
            setFilters((current) => ({ ...current, type }));
            setDraftFilters((current) =>
                current ? { ...current, type } : null,
            );
        },
        [],
    );

    const setDraftTagMatchMode = useCallback(
        (tagMatchMode: "all" | "any") => {
            setDraftFilters((current) =>
                current ? { ...current, tagMatchMode } : current,
            );
        },
        [],
    );

    const toggleDraftCategory = useCallback((categoryId: string) => {
        setDraftFilters((current) => {
            if (!current) return current;

            const isSelected = current.categoryIds.includes(categoryId);

            return {
                ...current,
                categoryIds: isSelected
                    ? current.categoryIds.filter((id) => id !== categoryId)
                    : [...current.categoryIds, categoryId],
            };
        });
    }, []);

    const toggleDraftTag = useCallback((tagId: string) => {
        setDraftFilters((current) => {
            if (!current) return current;

            const isSelected = current.tagIds.includes(tagId);

            return {
                ...current,
                tagIds: isSelected
                    ? current.tagIds.filter((id) => id !== tagId)
                    : [...current.tagIds, tagId],
            };
        });
    }, []);

    const clearDraftFacets = useCallback(() => {
        setDraftFilters((current) =>
            current
                ? {
                    ...current,
                    categoryIds: [],
                    tagIds: [],
                    tagMatchMode: "all",
                }
                : current,
        );
    }, []);

    /**
     * Remove one applied facet without changing the text query
     * or the other selected filters.
     */
    const removeCategoryFilter = useCallback((categoryId: string) => {
        setFilters((current) => ({
            ...current,
            categoryIds: current.categoryIds.filter(
                (id) => id !== categoryId,
            ),
        }));

        setDraftFilters((current) =>
            current
                ? {
                    ...current,
                    categoryIds: current.categoryIds.filter(
                        (id) => id !== categoryId,
                    ),
                }
                : current,
        );
    }, []);

    const removeTagFilter = useCallback((tagId: string) => {
        setFilters((current) => ({
            ...current,
            tagIds: current.tagIds.filter((id) => id !== tagId),
        }));

        setDraftFilters((current) =>
            current
                ? {
                    ...current,
                    tagIds: current.tagIds.filter((id) => id !== tagId),
                }
                : current,
        );
    }, []);

    const clearAllFilters = useCallback(() => {
        const defaults = createDefaultGlobalSearchFilters();

        setFilters(defaults);
        setDraftFilters((current) => (current ? copyFilters(defaults) : null));
    }, []);

    const replaceFilters = useCallback(
        (nextFilters: GlobalSearchFilters) => {
            const next = copyFilters(nextFilters);

            setFilters(next);

            // Keep an open picker consistent with the newly applied filters.
            setDraftFilters((current) =>
                current ? copyFilters(next) : null,
            );
        },
        [],
    );

    return {
        filters,
        draftFilters,
        isEditing,

        beginEditing,
        cancelEditing,
        applyEditing,

        setType,
        setDraftTagMatchMode,
        toggleDraftCategory,
        toggleDraftTag,
        clearDraftFacets,

        removeCategoryFilter,
        removeTagFilter,
        clearAllFilters,
        replaceFilters,
    };
}