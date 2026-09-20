import { useTaskStore } from "@/stores/use-task-store";
import { useEventStore } from "@/stores/use-event-store";
/*import { useTimerLogStore } from "@/stores/use-timer-log-store";
import { refreshTagsCategoriesAchievements } from "@/utils/task/refresh-tags-categories-achievements"; */
import { runTaskMaintenanceOncePerDay } from "@/utils/Data-services/task-services/task-maintenance";
import { Task } from "@/types/task";
import { useHabitStore } from "@/stores/use-habit-store";

let hydrationPromise: Promise<void> | null = null;

export function hydrateLocalWorkspace(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const [loadedTasks] = await Promise.all([
      useTaskStore.getState().refreshTasks(),
      useHabitStore.getState().refreshHabits(),
      useEventStore.getState().refreshEvents(),
      /*useTimerLogStore.getState().refreshLogs(),
      refreshTagsCategoriesAchievements(), */
    ]);

    //await runTaskMaintenanceOncePerDay(loadedTasks as Record<string, Task>, null);
  })();

  return hydrationPromise;
}

export function resetHydrationGuard(): void {
  hydrationPromise = null;
}