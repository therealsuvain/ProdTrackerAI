import { create } from "zustand";

import {
    deleteCategorySafely,
    getAllCategories,
    incrementCategoryCount,
    insertCategory,
    updateCategory,
} from "@/db/repositories/tags-and-category-repository";
import { Category } from "@/types/category";

type CategoryStoreState = {
    categoriesById: Record<string, Category>;
    loaded: boolean;

    addCategory: (payload: {
        id: string;
        name: string;
        color: string;
        icon: string;
    }) => Promise<{ id: string; created: boolean }>;
    incrementCategoryUsage: (id: string) => Promise<void>;
    editCategory: (category: Category) => Promise<void>;
    removeCategory: (id: string, fallbackId?: string | null) => Promise<void>;
    refreshCategories: () => Promise<Record<string, Category>>;
};

function normalizeCategories(list: Category[]): Record<string, Category> {
    const byId: Record<string, Category> = {};
    for (const category of list) byId[category.id] = category;
    return byId;
}

// Most-used first (matches getAllCategories ordering), name as a stable tie-break.
export const selectCategoryList = (state: {
    categoriesById: Record<string, Category>;
}): Category[] =>
    Object.values(state.categoriesById).sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );

// For non-React callers (AI handlers etc.)
export const getCategoryList = (): Category[] =>
    selectCategoryList(useCategoryStore.getState());

export const useCategoryStore = create<CategoryStoreState>((set, get) => {
    const pendingOpByCategoryId = new Map<string, symbol>();

    const applyOptimisticMutation = async (
        affectedIds: string[],
        optimisticUpdate: (byId: Record<string, Category>) => Record<string, Category>,
        dbWrite: () => Promise<unknown>,
    ): Promise<void> => {
        const opId = Symbol();
        for (const id of affectedIds) pendingOpByCategoryId.set(id, opId);

        const previousById = get().categoriesById;
        set((state) => ({ categoriesById: optimisticUpdate(state.categoriesById) }));

        try {
            await dbWrite();
        } catch (error) {
            set((state) => {
                const next = { ...state.categoriesById };
                for (const id of affectedIds) {
                    if (pendingOpByCategoryId.get(id) !== opId) continue;
                    if (previousById[id]) next[id] = previousById[id];
                    else delete next[id];
                }
                return { categoriesById: next };
            });
            throw error;
        } finally {
            for (const id of affectedIds) {
                if (pendingOpByCategoryId.get(id) === opId) pendingOpByCategoryId.delete(id);
            }
        }
    };

    return {
        categoriesById: {},
        loaded: false,

        addCategory: async ({ id, name, color, icon }) => {
            // The DB has a unique index on name and its upsert would bump the existing
            // row's usage count, so a duplicate name resolves to the existing category.
            const existing = Object.values(get().categoriesById).find((c) => c.name === name);
            if (existing) return { id: existing.id, created: false };

            const now = new Date().toISOString();
            const category: Category = {
                id,
                name,
                color,
                icon,
                count: 0,
                createdAt: now,
                updatedAt: now,
            };
            await applyOptimisticMutation(
                [id],
                (byId) => ({ ...byId, [id]: category }),
                () => insertCategory(category),
            );
            return { id, created: true };
        },

        incrementCategoryUsage: async (id) => {
            await applyOptimisticMutation(
                [id],
                (byId) =>
                    byId[id]
                        ? {
                            ...byId,
                            [id]: {
                                ...byId[id],
                                count: byId[id].count + 1,
                                updatedAt: new Date().toISOString(),
                            },
                        }
                        : byId,
                () => incrementCategoryCount(id),
            );
        },

        editCategory: async (category) => {
            const existing = get().categoriesById[category.id];
            if (!existing) throw new Error(`Category ${category.id} not found`);
            const merged: Category = { ...existing, ...category };
            await applyOptimisticMutation(
                [category.id],
                (byId) => ({ ...byId, [category.id]: merged }),
                () => updateCategory(merged),
            );
        },

        removeCategory: async (id, fallbackId = null) => {
            await applyOptimisticMutation(
                fallbackId ? [id, fallbackId] : [id],
                (byId) => {
                    const deleted = byId[id];
                    if (!deleted) return byId;
                    const next = { ...byId };
                    delete next[id];
                    if (fallbackId && next[fallbackId]) {
                        next[fallbackId] = {
                            ...next[fallbackId],
                            count: next[fallbackId].count + deleted.count,
                        };
                    }
                    return next;
                },
                () => deleteCategorySafely(id, fallbackId),
            );
        },

        // Read only. Seeding happens in hydrateCategoriesWithEffects.
        refreshCategories: async () => {
            const loadedCategories = await getAllCategories();
            set({ categoriesById: normalizeCategories(loadedCategories), loaded: true });
            return get().categoriesById;
        },
    };
});