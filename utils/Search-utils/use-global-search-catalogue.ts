import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/shallow";

import { ALL_ACHIEVEMENTS } from "@/types/achievements-ui";

import { useTaskStore } from "@/stores/use-task-store";
import { useEventStore } from "@/stores/use-event-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { useTagStore } from "@/stores/use-tag-store";
import { useCategoryStore } from "@/stores/use-category-store";
import {
    selectUnlockedList,
    useAchievementStore,
} from "@/stores/use-achievement-store";
import { useMetricStore } from "@/stores/use-metrics-store";

import { useEntitlement } from "@/context/EntitlementContext";
import { tierAtLeast } from "@/types/entitlement";

import type { GlobalSearchProviderContext } from "@/types/global-search";

import {
    bindGlobalSearchProvider,
    buildGlobalSearchCatalogue,
    createGlobalSearchProviderRegistry,
} from "@/utils/Search-utils/provider-registry";

import { taskSearchProvider } from "@/utils/Search-utils/providers/task-provider";
import { eventSearchProvider } from "@/utils/Search-utils/providers/event-provider";
import { habitSearchProvider } from "@/utils/Search-utils/providers/habit-provider";
import { timerLogSearchProvider } from "@/utils/Search-utils/providers/timer-log-provider";
import { tagSearchProvider } from "@/utils/Search-utils/providers/tag-provider";
import { categorySearchProvider } from "@/utils/Search-utils/providers/category-provider";
import {
    achievementSearchProvider,
    type AchievementSearchSource,
} from "@/utils/Search-utils/providers/achievement-provider";
import { settingsSearchProvider, type SearchableSettingsSection } from "@/utils/Search-utils/providers/settings-provider";
import { chartSearchProvider } from "@/utils/Search-utils/providers/chart-provider";
import { buildGlobalSearchActionDocuments } from "@/utils/Search-utils/action-registry";
import { CHART_REGISTRY } from "@/components/ui/analytics/charts-registry";
import { SETTINGS_LAYOUT } from "@/types/settings-ui";

import {
    recordGlobalSearchCatalogueFinalized
} from "@/utils/Search-utils/diagnostics/search-diagnostics";

export function useGlobalSearchCatalogue() {
    // Subscribe to the existing record stores.
    // useShallow avoids treating a newly created Object.values array as
    // a change when its individual record references are unchanged.
    const tasks = useTaskStore(
        useShallow((state) => Object.values(state.tasksById)),
    );

    const events = useEventStore(
        useShallow((state) => Object.values(state.eventsById)),
    );

    const habits = useHabitStore(
        useShallow((state) => Object.values(state.habitsById)),
    );

    const timerLogs = useTimerLogStore(
        useShallow((state) => Object.values(state.logsById)),
    );

    // Keep the lookup maps subscribed to their source stores.
    const tagsById = useTagStore((state) => state.tagsById);
    const categoriesById = useCategoryStore(
        (state) => state.categoriesById,
    );
    const tagList = useMemo(
        () => Object.values(tagsById),
        [tagsById],
    );

    const categoryList = useMemo(
        () => Object.values(categoriesById),
        [categoriesById],
    );

    const unlockedAchievements = useAchievementStore(
        useShallow(selectUnlockedList),
    );

    const metricBaseline = useAchievementStore(
        (state) => state.baseline,
    );

    const metricGlobal = useMetricStore(
        (state) => state.global,
    );

    const achievementSource = useMemo<AchievementSearchSource>(
        () => ({
            definitions: ALL_ACHIEVEMENTS,
            unlockedAchievements,
            metricBaseline,
            metricGlobal,
        }),
        [unlockedAchievements, metricBaseline, metricGlobal],
    );

    const settingsSections =
        SETTINGS_LAYOUT as readonly SearchableSettingsSection[];

    const chartIds = useMemo(
        () => Object.keys(CHART_REGISTRY),
        [],
    );

    const { plan, isLoaded } = useEntitlement();

    // The provider contract uses ReadonlyMap rather than the
    // Record<string, T> representation used by the Zustand stores.
    const providerContext = useMemo<GlobalSearchProviderContext>(() => {
        return {
            tagsById: new Map(
                Object.entries(tagsById).map(([id, tag]) => [
                    id,
                    {
                        name: tag.name,
                        normalizedName: tag.normalizedName,
                    },
                ] as const),
            ),

            categoriesById: new Map(
                Object.entries(categoriesById).map(([id, category]) => [
                    id,
                    {
                        name: category.name,
                        normalizedName: category.normalizedName,
                        color: category.color,
                    },
                ] as const),
            ),

            // Treat the user as non-paid until entitlement loading finishes.
            paidModeEnabled:
                isLoaded && tierAtLeast(plan, "starter"),
            plan,
            isEntitlementLoaded: isLoaded,
        };
    }, [tagsById, categoriesById, plan, isLoaded]);

    // Bind the current store data to the provider definitions.
    const providerRegistry = useMemo(
        () =>
            createGlobalSearchProviderRegistry([
                bindGlobalSearchProvider(taskSearchProvider, () => tasks),
                bindGlobalSearchProvider(eventSearchProvider, () => events),
                bindGlobalSearchProvider(habitSearchProvider, () => habits),
                bindGlobalSearchProvider(
                    timerLogSearchProvider,
                    () => timerLogs,
                ),
                bindGlobalSearchProvider(tagSearchProvider, () => tagList),
                bindGlobalSearchProvider(categorySearchProvider, () => categoryList),
                bindGlobalSearchProvider(
                    achievementSearchProvider,
                    () => achievementSource,
                ),
                bindGlobalSearchProvider(settingsSearchProvider, () => settingsSections),
                bindGlobalSearchProvider(chartSearchProvider, () => chartIds),
            ]),
        [tasks, events, habits, timerLogs, tagList, categoryList, achievementSource, settingsSections, chartIds],
    );

    // Rebuild documents when source records, lookups, or provider
    // definitions change—not in response to each search keystroke.
    const documents = useMemo(
        () => [
            ...buildGlobalSearchCatalogue(providerRegistry, providerContext),
            ...buildGlobalSearchActionDocuments(),
        ],
        [providerRegistry, providerContext],
    );

    useEffect(() => {
        recordGlobalSearchCatalogueFinalized(documents.length);
    }, [documents]);
    return documents;
}