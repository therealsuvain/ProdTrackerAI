import type {
    GlobalSearchFilters,
    GlobalSearchKind,
    GlobalSearchTarget,
} from "@/types/global-search";

export interface SavedGlobalSearchScope {
    id: string;
    name: string;
    filters: GlobalSearchFilters;
    createdAt: string;
    updatedAt: string;
}

export interface RecentGlobalSearchItem {
    key: string;
    target: GlobalSearchTarget;
    kind: GlobalSearchKind;
    title: string;
    subtitle?: string;
    lastSelectedAt: string;
}

export interface RecentGlobalSearch {
    id: string;
    query: string;
    filters: GlobalSearchFilters;
    searchedAt: string;
}

export const MAX_SAVED_GLOBAL_SEARCH_SCOPES = 20;
export const MAX_RECENT_GLOBAL_SEARCH_ITEMS = 12;
export const MAX_SESSION_GLOBAL_SEARCHES = 8;