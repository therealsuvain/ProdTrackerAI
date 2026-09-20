// utils/habit/habit-maintenance-service.ts
import { useHabitStore } from "@/stores/use-habit-store";
import { applyMissedDayLogic, restartHabitAfterGoalForeground } from "@/utils/habit-utils";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";
import storageMMKV from "@/utils/Storage-Utils/mmkv-instance";
import { STORAGE_KEYS } from "@/utils/Storage-Utils/storage-keys";
import { getTodayISO } from "@/utils/common-utils";
import { Habit } from "@/types/habits";

function maintenanceKey(userId: string | null): string {
  return `${STORAGE_KEYS.HABIT_MAINTENANCE_LAST_RUN}:${userId ?? "anonymous"}`;
}

export async function runHabitMaintenanceOncePerDay(
  habitsById: Record<string, Habit>,
  userId: string | null,
): Promise<void> {
  const today = getTodayISO();
  const key = maintenanceKey(userId);
  if (storageMMKV.getString(key) === today) return;

  let missedCount = 0;
  let autoFrozenCount = 0;

  for (const habit of Object.values(habitsById)) {
    const { status, habit: updatedHabit } = applyMissedDayLogic(habit);

    if (status === "missed_check_in") {
      missedCount++;
      await useHabitStore.getState().editHabit(updatedHabit);
    } else if (status === "auto_frozen") {
      autoFrozenCount++;
      await useHabitStore.getState().editHabit(updatedHabit);
    }

    if (habit.pendingStreakResetAfter) {
      const resetHabit = restartHabitAfterGoalForeground(updatedHabit);
      if (!resetHabit.pendingStreakResetAfter) {
        await useHabitStore.getState().editHabit(resetHabit);
      }
    }
  }

  if (missedCount > 0) {
    metricsEventBus.emit("metric:track", { keys: ["habitCheckInsMissed"], amount: missedCount });
  }
  if (autoFrozenCount > 0) {
    metricsEventBus.emit("metric:track", { keys: ["habitsAutoFrozen"], amount: autoFrozenCount });
  }

  storageMMKV.set(key, today);
}