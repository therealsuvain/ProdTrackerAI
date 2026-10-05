import { useTaskStore } from "@/stores/use-task-store";
import { useEventStore } from "@/stores/use-event-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { useChatStore } from "@/stores/use-chat-store";
import { useTagStore } from "@/stores/use-tag-store";
import { hydrateCategoriesWithEffects } from "./taxonomy-services/category-actions";
import { useMetricStore } from "@/stores/use-metrics-store";
import { useAchievementStore } from "@/stores/use-achievement-store";
import { initMetricsPipeline } from "./analytics-services/metrics-pipeline";
import { AIActionMemory } from "../AI-utils/agentic-handlers/ai-action-undo-handlers";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { sqlite } from "@/db";

let hydrationPromise: Promise<void> | null = null;

export function hydrateLocalWorkspace(): Promise<void> {
  console.log("hydrateLocalWorkspace");
  if (hydrationPromise) return hydrationPromise;
  console.log("hydrateLocalWorkspace2");
  hydrationPromise = (async () => {
    const [loadedTasks] = await Promise.all([
      useTaskStore.getState().refreshTasks(),
      useHabitStore.getState().refreshHabits(),
      useEventStore.getState().refreshEvents(),
      useTimerLogStore.getState().refreshLogs(),
      useChatStore.getState().refreshMessages(),
      useTagStore.getState().refreshTags(),
      hydrateCategoriesWithEffects(),
      useMetricStore.getState().refreshMetrics(),
      useAchievementStore.getState().refreshAchievements(),

    ]);

    //await runTaskMaintenanceOncePerDay(loadedTasks as Record<string, Task>, null);
    initMetricsPipeline();
    AIActionMemory.init();
    useDrizzleStudio(sqlite);

  })();
  console.log("hydrateLocalWorkspace3");

  return hydrationPromise;
}

export function resetHydrationGuard(): void {
  hydrationPromise = null;
}