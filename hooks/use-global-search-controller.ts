import { useCallback, useMemo, useState } from "react";

import type { GlobalSearchFilterKind } from "@/types/global-search";

import { useGlobalSearchCatalogue } from "@/utils/Search-utils/use-global-search-catalogue";
import { searchGlobalDocuments } from "@/utils/Search-utils/matching";
import { useGlobalSearchFilters } from "@/hooks/use-global-search-filters";

interface GlobalSearchControllerOptions {
    query?: string;
    onQueryChange?: (query: string) => void;
}

export function useGlobalSearchController(
    options: GlobalSearchControllerOptions = {},
) {
    const [internalQuery, setInternalQuery] = useState("");
    const query = options.query ?? internalQuery;

    const documents = useGlobalSearchCatalogue();
    const filterState = useGlobalSearchFilters();

    const results = useMemo(
        () =>
            searchGlobalDocuments(
                documents,
                query,
                filterState.filters,
            ),
        [documents, query, filterState.filters],
    );

    const setQuery = useCallback(
        (value: string) => {
            if (options.onQueryChange) {
                options.onQueryChange(value);
            } else {
                setInternalQuery(value);
            }
        },
        [options.onQueryChange],
    );

    const clearQuery = useCallback(() => {
        setQuery("");
    }, [setQuery]);

    const activeFacetCount =
        filterState.filters.categoryIds.length +
        filterState.filters.tagIds.length;

    const activeFilterCount =
        activeFacetCount +
        (filterState.filters.type === "all" ? 0 : 1);

    const setType = useCallback(
        (type: "all" | GlobalSearchFilterKind) => {
            filterState.setType(type);
        },
        [filterState.setType],
    );

    const openFilterPicker = useCallback(() => {
        filterState.beginEditing();
    }, [filterState.beginEditing]);

    return {
        query,
        setQuery,
        clearQuery,

        documents,
        results,

        filters: filterState.filters,
        draftFilters: filterState.draftFilters,
        isEditingFilters: filterState.isEditing,

        setType,
        openFilterPicker,
        cancelFilterEditing: filterState.cancelEditing,
        applyFilterEditing: filterState.applyEditing,

        toggleDraftCategory: filterState.toggleDraftCategory,
        toggleDraftTag: filterState.toggleDraftTag,
        setDraftTagMatchMode: filterState.setDraftTagMatchMode,
        clearDraftFacets: filterState.clearDraftFacets,

        removeCategoryFilter: filterState.removeCategoryFilter,
        removeTagFilter: filterState.removeTagFilter,
        clearAllFilters: filterState.clearAllFilters,

        activeFacetCount,
        activeFilterCount,
        hasActiveFilters: activeFilterCount > 0,
    };
}