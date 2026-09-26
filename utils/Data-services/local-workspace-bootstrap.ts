import { useTaskStore } from "@/stores/use-task-store";
import { useEventStore } from "@/stores/use-event-store";
import { useData } from "@/hooks/context-hooks/use-data";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";

let hydrationPromise: Promise<void> | null = null;

export function hydrateLocalWorkspace(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  const { refreshTagsCatsAchievements } = useData();
  hydrationPromise = (async () => {
    const [loadedTasks] = await Promise.all([
      useTaskStore.getState().refreshTasks(),
      useHabitStore.getState().refreshHabits(),
      useEventStore.getState().refreshEvents(),
      useTimerLogStore.getState().refreshLogs(),
      refreshTagsCatsAchievements(),
    ]);
    5
    //await runTaskMaintenanceOncePerDay(loadedTasks as Record<string, Task>, null);
  })();

  return hydrationPromise;
}

export function resetHydrationGuard(): void {
  hydrationPromise = null;
}