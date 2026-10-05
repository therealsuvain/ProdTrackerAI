import {
    getItemIdsForTag,
    getTagUsageStats,
    reassignAndAddBackTag,
} from "@/db/repositories/tags-and-category-repository";
import { useEventStore } from "@/stores/use-event-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTagStore } from "@/stores/use-tag-store";
import { useTaskStore } from "@/stores/use-task-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { Tag } from "@/types/tag";
import { trackMetric } from "../analytics-services/metric-actions";


type Actor = "user" | "ai";

export async function addTagsWithEffects(
    payload: { id: string; name: string }[],
    actor: Actor = "user",
    mode: "regular" | "undo" = "regular"
): Promise<string[]> {
    const { ids, createdCount } = await useTagStore.getState().addTags(payload);
    trackMetric(["tagsAdded"], createdCount, actor);
    trackMetric(["tagsAssigned"], payload.length, actor);
    if (mode === "undo") trackMetric(["tagsDeleted"], -1, actor);
    return ids;
}

export async function incrementTagUsageWithEffects(id: string): Promise<void> {
    await useTagStore.getState().incrementTagUsage(id);
}

export async function editTagWithEffects(tag: Tag, actor: Actor = "user", mode: "regular" | "undo" = "regular"): Promise<void> {
    await useTagStore.getState().editTag(tag);
    trackMetric(["tagsEdited"], 1, actor);
    if (mode === "undo") trackMetric(["tagsEdited"], -1, actor);
}

export async function deleteTagWithEffects(
    id: string,
    fallbackId: string | null = null,
    actor: Actor = "user",
    mode: "regular" | "undo" = "regular"
): Promise<void> {
    await useTagStore.getState().removeTag(id, fallbackId);
    // TODO: if the tag-settings screen currently calls the item stores' "reassign
    // tag local" functions after deleting, move those calls here so every delete
    // path keeps task/habit/event/log rows in sync.
    trackMetric(["tagsDeleted"], 1, actor);
    if (mode === "undo") trackMetric(["tagsAdded"], -1, actor);
}

// Used when undoing a tag delete: repo restores the tag and its item links,
// then every affected store is re-read.
export async function reassignDeletedTagWithEffects(
    tag: Tag,
    fallbackId: string | null,
    originalItems: Record<string, string[]>,
): Promise<void> {
    await reassignAndAddBackTag(tag, fallbackId, originalItems);
    await Promise.all([
        useTagStore.getState().refreshTags(),
        useTaskStore.getState().refreshTasks(),
        useHabitStore.getState().refreshHabits(),
        useEventStore.getState().refreshEvents(),
        useTimerLogStore.getState().refreshLogs(),
    ]);
}

// Stateless DB reads, so they skip the store.
export async function getTagUsageForAll(tagId: string) {
    return (
        (await getTagUsageStats(tagId)) ?? { tasks: 0, habits: 0, events: 0, logs: 0, total: 0 }
    );
}

export async function getItemIdsForTagLocal(tagId: string): Promise<Record<string, string[]>> {
    return (
        (await getItemIdsForTag(tagId)) ?? { tasks: [], habits: [], events: [], logs: [] }
    );
}