import {
    getCategoryUsage,
    reassignAndAddBackCategory,
    seedCategoriesIfEmpty,
} from "@/db/repositories/tags-and-category-repository";
import { useCategoryStore } from "@/stores/use-category-store";
import { useEventStore } from "@/stores/use-event-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTaskStore } from "@/stores/use-task-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { Category } from "@/types/category";
import { trackMetric } from "../analytics-services/metric-actions";

type Actor = "user" | "ai";

// Call this from hydrateLocalWorkspace instead of the store's refresh, so a
// fresh install gets the default categories.
export async function hydrateCategoriesWithEffects(): Promise<void> {
    await seedCategoriesIfEmpty();
    await useCategoryStore.getState().refreshCategories();
}

export async function addCategoryWithEffects(
    payload: { id: string; name: string; color: string; icon: string },
    actor: Actor = "user",
    mode: "regular" | "undo" = "regular"
): Promise<string> {
    const { id, created } = await useCategoryStore.getState().addCategory(payload);
    if (created) {
        trackMetric(["categoriesAdded"], 1, actor);
    }
    if (mode === "undo") trackMetric(["categoriesDeleted"], -1, actor);
    return id;
}

export async function incrementCategoryUsageWithEffects(id: string): Promise<void> {
    await useCategoryStore.getState().incrementCategoryUsage(id);
}

export async function editCategoryWithEffects(category: Category, actor: Actor = "user", mode: "regular" | "undo" = "regular"): Promise<void> {
    await useCategoryStore.getState().editCategory(category);
    trackMetric(["categoriesEdited"], 1, actor);
    if (mode === "undo") trackMetric(["categoriesEdited"], -1, actor);
}

export async function deleteCategoryWithEffects(
    id: string,
    fallbackId: string | null = null,
    actor: Actor = "user",
    mode: "regular" | "undo" = "regular"
): Promise<void> {
    await useCategoryStore.getState().removeCategory(id, fallbackId);
    // TODO: if the category-settings screen currently calls the item stores'
    // "reassign category local" functions after deleting, move those calls here
    // so every delete path keeps task/habit/event/log rows in sync.
    trackMetric(["categoriesDeleted"], 1, actor);
    if (mode === "undo") trackMetric(["categoriesAdded"], -1, actor);
}

// Used when undoing a category delete: the repo restores the category and its
// item links, then every affected store is re-read.
export async function reassignDeletedCategoryWithEffects(
    category: Category,
    fallbackId: string | null,
    originalItems: Record<string, string[]>,
): Promise<void> {
    await reassignAndAddBackCategory(category, fallbackId, originalItems);
    await Promise.all([
        useCategoryStore.getState().refreshCategories(),
        useTaskStore.getState().refreshTasks(),
        useHabitStore.getState().refreshHabits(),
        useEventStore.getState().refreshEvents(),
        useTimerLogStore.getState().refreshLogs(),
    ]);
}

// Stateless DB read, so it skips the store.
export async function getCategoryUsageForAll(categoryId: string) {
    return (
        (await getCategoryUsage(categoryId)) ?? {
            tasks: 0,
            habits: 0,
            events: 0,
            logs: 0,
            total: 0,
        }
    );
}