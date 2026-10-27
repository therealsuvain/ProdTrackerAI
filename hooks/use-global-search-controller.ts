import { useCallback, useMemo, useState, useEffect } from "react";

import type { GlobalSearchFilterKind } from "@/types/global-search";

import { useGlobalSearchCatalogue } from "@/utils/Search-utils/use-global-search-catalogue";
import { searchGlobalDocuments } from "@/utils/Search-utils/matching";
import { useGlobalSearchFilters } from "@/hooks/use-global-search-filters";

import type {
    GlobalSearchDocument,
    GlobalSearchFilters,
} from "@/types/global-search";

import type {
    RecentGlobalSearch,
    SavedGlobalSearchScope,
} from "@/types/global-search-convenience";

import { useGlobalSearchConvenienceStore } from "@/utils/Search-utils/use-global-search-convenience-store";

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

    const sanitizeSavedFilters = useCallback(
        (savedFilters: GlobalSearchFilters): GlobalSearchFilters => {
            const validTagIds = new Set<string>();
            const validCategoryIds = new Set<string>();

            for (const document of documents) {
                if (document.kind === "tag") {
                    validTagIds.add(document.target.id);
                } else if (document.kind === "category") {
                    validCategoryIds.add(document.target.id);
                }
            }

            return {
                ...savedFilters,
                categoryIds: savedFilters.categoryIds.filter((id) =>
                    validCategoryIds.has(id),
                ),
                tagIds: savedFilters.tagIds.filter((id) =>
                    validTagIds.has(id),
                ),
            };
        },
        [documents],
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

    const applySavedScope = useCallback(
        (scope: SavedGlobalSearchScope) => {
            filterState.replaceFilters(sanitizeSavedFilters(scope.filters));
            // Intentionally do not clear or replace the current text query.
        },
        [filterState.replaceFilters, sanitizeSavedFilters],
    );

    const restoreRecentSearch = useCallback(
        (recentSearch: RecentGlobalSearch) => {
            filterState.replaceFilters(
                sanitizeSavedFilters(recentSearch.filters),
            );
            setQuery(recentSearch.query);
        },
        [filterState.replaceFilters, sanitizeSavedFilters, setQuery],
    );


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

    const hydrateConvenienceStore = useGlobalSearchConvenienceStore(
        (state) => state.hydrate,
    );
    const savedScopes = useGlobalSearchConvenienceStore(
        (state) => state.savedScopes,
    );
    const storedRecentItems = useGlobalSearchConvenienceStore(
        (state) => state.recentItems,
    );
    const recentSearches = useGlobalSearchConvenienceStore(
        (state) => state.recentSearches,
    );
    const isConvenienceStoreLoaded = useGlobalSearchConvenienceStore(
        (state) => state.isLoaded,
    );

    const saveScope = useGlobalSearchConvenienceStore(
        (state) => state.saveScope,
    );
    const updateScope = useGlobalSearchConvenienceStore(
        (state) => state.updateScope,
    );
    const deleteScope = useGlobalSearchConvenienceStore(
        (state) => state.deleteScope,
    );
    const recordRecentItem = useGlobalSearchConvenienceStore(
        (state) => state.recordRecentItem,
    );
    const removeRecentItem = useGlobalSearchConvenienceStore(
        (state) => state.removeRecentItem,
    );
    const clearRecentItems = useGlobalSearchConvenienceStore(
        (state) => state.clearRecentItems,
    );
    const recordRecentSearch = useGlobalSearchConvenienceStore(
        (state) => state.recordRecentSearch,
    );
    const removeRecentSearch = useGlobalSearchConvenienceStore(
        (state) => state.removeRecentSearch,
    );
    const clearRecentSearches = useGlobalSearchConvenienceStore(
        (state) => state.clearRecentSearches,
    );

    const recordSelectedResult = useCallback(
        (document: GlobalSearchDocument) => {
            void recordRecentItem(document);

            // Record one search when a result is selected, not on every keystroke.
            if (query.trim()) {
                recordRecentSearch(query, filterState.filters);
            }
        },
        [recordRecentItem, recordRecentSearch, query, filterState.filters],
    );

    const recordSubmittedSearch = useCallback(() => {
        if (query.trim()) {
            recordRecentSearch(query, filterState.filters);
        }
    }, [recordRecentSearch, query, filterState.filters]);

    const recentItems = useMemo(() => {
        const documentsByKey = new Map(
            documents.map((document) => [document.key, document] as const),
        );

        return storedRecentItems.flatMap((recent) => {
            const currentDocument = documentsByKey.get(recent.key);

            // A stale or deleted entity is not shown as a recent result.
            if (!currentDocument) return [];

            return [{
                ...recent,
                kind: currentDocument.kind,
                title: currentDocument.display.title,
                subtitle: currentDocument.display.subtitle,
                target: currentDocument.target,
            }];
        });
    }, [storedRecentItems, documents]);

    const clearScopes = useGlobalSearchConvenienceStore(
        (state) => state.clearScopes,
    );

    useEffect(() => {
        void hydrateConvenienceStore();
    }, [hydrateConvenienceStore]);

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

        savedScopes,
        recentItems,
        recentSearches,
        isConvenienceStoreLoaded,

        saveScope,
        updateScope,
        deleteScope,
        removeRecentItem,
        clearRecentItems,
        removeRecentSearch,
        clearRecentSearches,

        applySavedScope,
        restoreRecentSearch,

        recordSelectedResult,
        recordSubmittedSearch,
        clearScopes,
    };
}