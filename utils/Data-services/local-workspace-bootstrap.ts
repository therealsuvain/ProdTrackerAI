import { useTaskStore } from "@/stores/use-task-store";
import { useEventStore } from "@/stores/use-event-store";
import { useData } from "@/hooks/context-hooks/use-data";
import { useHabitStore } from "@/stores/use-habit-store";
import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { useChatStore } from "@/stores/use-chat-store";

let hydrationPromise: Promise<void> | null = null;

export function hydrateLocalWorkspace(): Promise<void> {
  console.log("hydrateLocalWorkspace");
  if (hydrationPromise) return hydrationPromise;
  console.log("hydrateLocalWorkspace2");
  //const { refreshTagsCatsAchievements } = useData();
  hydrationPromise = (async () => {
    const [loadedTasks] = await Promise.all([
      useTaskStore.getState().refreshTasks(),
      useHabitStore.getState().refreshHabits(),
      useEventStore.getState().refreshEvents(),
      useTimerLogStore.getState().refreshLogs(),
      useChatStore.getState().refreshMessages(),
      //refreshTagsCatsAchievements(),
    ]);

    //await runTaskMaintenanceOncePerDay(loadedTasks as Record<string, Task>, null);
  })();
  console.log("hydrateLocalWorkspace3");

  return hydrationPromise;
}

export function resetHydrationGuard(): void {
  hydrationPromise = null;
}