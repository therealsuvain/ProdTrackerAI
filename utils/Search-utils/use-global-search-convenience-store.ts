import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type {
    GlobalSearchDocument,
    GlobalSearchFilters,
} from "@/types/global-search";

import {
    MAX_RECENT_GLOBAL_SEARCH_ITEMS,
    MAX_SAVED_GLOBAL_SEARCH_SCOPES,
    MAX_SESSION_GLOBAL_SEARCHES,
    type RecentGlobalSearch,
    type RecentGlobalSearchItem,
    type SavedGlobalSearchScope,
} from "@/types/global-search-convenience";

import { normalizeSearchText } from "./text-normalization";

const STORAGE_KEY = "GLOBAL_SEARCH_CONVENIENCE_V1";

interface PersistedConvenienceData {
    version: 1;
    savedScopes: SavedGlobalSearchScope[];
    recentItems: RecentGlobalSearchItem[];
}

interface GlobalSearchConvenienceState {
    isLoaded: boolean;
    savedScopes: SavedGlobalSearchScope[];
    recentItems: RecentGlobalSearchItem[];

    // Intentionally in-memory only; never included in PersistedConvenienceData.
    recentSearches: RecentGlobalSearch[];

    hydrate: () => Promise<void>;

    saveScope: (
        name: string,
        filters: GlobalSearchFilters,
    ) => Promise<string | null>;

    updateScope: (
        id: string,
        name: string,
        filters: GlobalSearchFilters,
    ) => Promise<void>;

    deleteScope: (id: string) => Promise<void>;
    clearScopes: () => Promise<void>;

    recordRecentItem: (
        document: GlobalSearchDocument,
    ) => Promise<void>;

    removeRecentItem: (key: string) => Promise<void>;
    clearRecentItems: () => Promise<void>;

    recordRecentSearch: (
        query: string,
        filters: GlobalSearchFilters,
    ) => void;

    removeRecentSearch: (id: string) => void;
    clearRecentSearches: () => void;
}

function cloneFilters(
    filters: GlobalSearchFilters,
): GlobalSearchFilters {
    return {
        ...filters,
        categoryIds: [...filters.categoryIds],
        tagIds: [...filters.tagIds],
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

function normalizePersistedData(
    value: unknown,
): PersistedConvenienceData {
    if (
        !isObject(value) ||
        value.version !== 1 ||
        !Array.isArray(value.savedScopes) ||
        !Array.isArray(value.recentItems)
    ) {
        return {
            version: 1,
            savedScopes: [],
            recentItems: [],
        };
    }

    return {
        version: 1,
        savedScopes: value.savedScopes.filter(
            (scope): scope is SavedGlobalSearchScope =>
                isObject(scope) &&
                typeof scope.id === "string" &&
                typeof scope.name === "string" &&
                isObject(scope.filters) &&
                (scope.filters.type === "all" ||
                    typeof scope.filters.type === "string") &&
                Array.isArray(scope.filters.categoryIds) &&
                Array.isArray(scope.filters.tagIds) &&
                (scope.filters.tagMatchMode === "all" ||
                    scope.filters.tagMatchMode === "any") &&
                typeof scope.createdAt === "string" &&
                typeof scope.updatedAt === "string",
        ),
        recentItems: value.recentItems.filter(
            (item): item is RecentGlobalSearchItem =>
                isObject(item) &&
                typeof item.key === "string" &&
                typeof item.kind === "string" &&
                typeof item.title === "string" &&
                typeof item.lastSelectedAt === "string" &&
                isObject(item.target) &&
                typeof item.target.kind === "string",
        ),
    };
}

let hydrationPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
let scopeIdCounter = 0;

function persistCurrentState(
    savedScopes: SavedGlobalSearchScope[],
    recentItems: RecentGlobalSearchItem[],
): Promise<void> {
    const data: PersistedConvenienceData = {
        version: 1,
        savedScopes,
        recentItems,
    };

    const serialized = JSON.stringify(data);

    // Serialize writes to prevent a slower earlier write from overwriting
    // newer state written by another mutation.
    writeQueue = writeQueue
        .catch(() => undefined)
        .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));

    return writeQueue;
}

function createScopeId(): string {
    scopeIdCounter += 1;
    return `scope_${Date.now()}_${scopeIdCounter}`;
}

function filtersSignature(filters: GlobalSearchFilters): string {
    return JSON.stringify({
        type: filters.type,
        categoryIds: [...filters.categoryIds].sort(),
        tagIds: [...filters.tagIds].sort(),
        tagMatchMode: filters.tagMatchMode,
    });
}

export const useGlobalSearchConvenienceStore =
    create<GlobalSearchConvenienceState>((set, get) => ({
        isLoaded: false,
        savedScopes: [],
        recentItems: [],
        recentSearches: [],

        hydrate: async () => {
            if (get().isLoaded) return;
            if (hydrationPromise) return hydrationPromise;

            hydrationPromise = (async () => {
                try {
                    const stored = await AsyncStorage.getItem(STORAGE_KEY);

                    if (stored) {
                        const parsed: unknown = JSON.parse(stored);
                        const data = normalizePersistedData(parsed);

                        set({
                            savedScopes: data.savedScopes,
                            recentItems: data.recentItems,
                            isLoaded: true,
                        });
                    } else {
                        set({ isLoaded: true });
                    }
                } catch (error) {
                    console.warn(
                        "[Global Search] Couldn't load saved scopes and recent items.",
                        error,
                    );

                    set({ isLoaded: true });
                } finally {
                    hydrationPromise = null;
                }
            })();

            return hydrationPromise;
        },

        saveScope: async (rawName, filters) => {
            const name = rawName.trim();
            if (!name) return null;

            const current = get().savedScopes;

            if (current.length >= MAX_SAVED_GLOBAL_SEARCH_SCOPES) {
                return null;
            }

            const now = new Date().toISOString();

            const scope: SavedGlobalSearchScope = {
                id: createScopeId(),
                name,
                filters: cloneFilters(filters),
                createdAt: now,
                updatedAt: now,
            };

            const savedScopes = [scope, ...current];

            set({ savedScopes });
            await persistCurrentState(savedScopes, get().recentItems);

            return scope.id;
        },

        updateScope: async (id, rawName, filters) => {
            const name = rawName.trim();
            if (!name) return;

            const savedScopes = get().savedScopes.map((scope) =>
                scope.id === id
                    ? {
                        ...scope,
                        name,
                        filters: cloneFilters(filters),
                        updatedAt: new Date().toISOString(),
                    }
                    : scope,
            );

            set({ savedScopes });
            await persistCurrentState(savedScopes, get().recentItems);
        },

        deleteScope: async (id) => {
            const savedScopes = get().savedScopes.filter(
                (scope) => scope.id !== id,
            );

            set({ savedScopes });
            await persistCurrentState(savedScopes, get().recentItems);
        },

        clearScopes: async () => {
            set({ savedScopes: [] });
            await persistCurrentState([], get().recentItems);
        },

        recordRecentItem: async (document) => {
            // Actions and Easter eggs are executable/special experiences, not
            // destinations for the regular "recent items" list.
            if (
                document.kind === "action" ||
                document.kind === "easterEgg"
            ) {
                return;
            }

            const recent: RecentGlobalSearchItem = {
                key: document.key,
                target: document.target,
                kind: document.kind,
                title: document.display.title,
                subtitle: document.display.subtitle,
                lastSelectedAt: new Date().toISOString(),
            };

            const recentItems = [
                recent,
                ...get().recentItems.filter((item) => item.key !== recent.key),
            ].slice(0, MAX_RECENT_GLOBAL_SEARCH_ITEMS);

            set({ recentItems });
            await persistCurrentState(get().savedScopes, recentItems);
        },

        removeRecentItem: async (key) => {
            const recentItems = get().recentItems.filter(
                (item) => item.key !== key,
            );

            set({ recentItems });
            await persistCurrentState(get().savedScopes, recentItems);
        },

        clearRecentItems: async () => {
            set({ recentItems: [] });
            await persistCurrentState(get().savedScopes, []);
        },

        recordRecentSearch: (rawQuery, filters) => {
            const query = rawQuery.trim();
            if (!query) return;

            const signature = `${normalizeSearchText(query)}::${filtersSignature(filters)}`;
            const now = new Date().toISOString();

            const existing = get().recentSearches.find((item) => {
                const itemSignature =
                    `${normalizeSearchText(item.query)}::${filtersSignature(item.filters)}`;

                return itemSignature === signature;
            });

            const recentSearch: RecentGlobalSearch = {
                id: existing?.id ?? `search_${Date.now()}`,
                query,
                filters: cloneFilters(filters),
                searchedAt: now,
            };

            const recentSearches = [
                recentSearch,
                ...get().recentSearches.filter((item) => item.id !== recentSearch.id),
            ].slice(0, MAX_SESSION_GLOBAL_SEARCHES);

            set({ recentSearches });
        },

        removeRecentSearch: (id) => {
            set((state) => ({
                recentSearches: state.recentSearches.filter(
                    (item) => item.id !== id,
                ),
            }));
        },

        clearRecentSearches: () => set({ recentSearches: [] }),
    }));