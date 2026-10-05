import { create } from "zustand";

import {
    deleteTagSafely,
    getAllTags,
    incrementTagCount,
    insertTags,
    updateTag,
} from "@/db/repositories/tags-and-category-repository";
import { Tag } from "@/types/tag";

type TagStoreState = {
    tagsById: Record<string, Tag>;
    loaded: boolean;

    addTags: (
        payload: { id: string; name: string }[],
    ) => Promise<{ ids: string[]; createdCount: number }>;
    incrementTagUsage: (id: string) => Promise<void>;
    editTag: (tag: Tag) => Promise<void>;
    removeTag: (id: string, fallbackId?: string | null) => Promise<void>;
    refreshTags: () => Promise<Record<string, Tag>>;
};

function normalizeTags(list: Tag[]): Record<string, Tag> {
    const byId: Record<string, Tag> = {};
    for (const tag of list) byId[tag.id] = tag;
    return byId;
}

// Most-used first (matches getAllTags ordering), name as a stable tie-break.
export const selectTagList = (state: { tagsById: Record<string, Tag> }): Tag[] =>
    Object.values(state.tagsById).sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );

// For non-React callers (AI handlers etc.)
export const getTagList = (): Tag[] => selectTagList(useTagStore.getState());

export const useTagStore = create<TagStoreState>((set, get) => {
    const pendingOpByTagId = new Map<string, symbol>();

    const applyOptimisticMutation = async (
        affectedIds: string[],
        optimisticUpdate: (byId: Record<string, Tag>) => Record<string, Tag>,
        dbWrite: () => Promise<unknown>,
    ): Promise<void> => {
        const opId = Symbol();
        for (const id of affectedIds) pendingOpByTagId.set(id, opId);

        const previousById = get().tagsById;
        set((state) => ({ tagsById: optimisticUpdate(state.tagsById) }));

        try {
            await dbWrite();
        } catch (error) {
            set((state) => {
                const next = { ...state.tagsById };
                for (const id of affectedIds) {
                    if (pendingOpByTagId.get(id) !== opId) continue;
                    if (previousById[id]) next[id] = previousById[id];
                    else delete next[id];
                }
                return { tagsById: next };
            });
            throw error;
        } finally {
            for (const id of affectedIds) {
                if (pendingOpByTagId.get(id) === opId) pendingOpByTagId.delete(id);
            }
        }
    };

    return {
        tagsById: {},
        loaded: false,

        addTags: async (payload) => {
            const now = new Date().toISOString();
            const next = { ...get().tagsById };
            const idByName = new Map(Object.values(next).map((t) => [t.name, t.id]));
            const ids: string[] = [];
            const dbPayload: Tag[] = [];
            let createdCount = 0;

            for (const { id, name } of payload) {
                const tag: Tag = { id, name, count: 1, createdAt: now, updatedAt: now };
                dbPayload.push(tag);

                const existingId = idByName.get(name);
                if (existingId) {
                    next[existingId] = {
                        ...next[existingId],
                        count: next[existingId].count + 1,
                        updatedAt: now,
                    };
                    ids.push(existingId);
                } else {
                    next[id] = tag;
                    idByName.set(name, id);
                    ids.push(id);
                    createdCount += 1;
                }
            }

            await applyOptimisticMutation(
                [...new Set(ids)],
                () => next,
                () => insertTags(dbPayload),
            );
            return { ids, createdCount };
        },

        incrementTagUsage: async (id) => {
            await applyOptimisticMutation(
                [id],
                (byId) =>
                    byId[id]
                        ? { ...byId, [id]: { ...byId[id], count: byId[id].count + 1 } }
                        : byId,
                () => incrementTagCount(id),
            );
        },

        editTag: async (tag) => {
            const existing = get().tagsById[tag.id];
            if (!existing) throw new Error(`Tag ${tag.id} not found`);
            const merged: Tag = { ...existing, ...tag };
            await applyOptimisticMutation(
                [tag.id],
                (byId) => ({ ...byId, [tag.id]: merged }),
                () => updateTag(merged),
            );
        },

        removeTag: async (id, fallbackId = null) => {
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
                () => deleteTagSafely(id, fallbackId),
            );
        },

        refreshTags: async () => {
            const loadedTags = await getAllTags();
            set({ tagsById: normalizeTags(loadedTags), loaded: true });
            return get().tagsById;
        },
    };
});