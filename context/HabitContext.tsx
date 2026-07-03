import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import {
  getAllHabits,
  insertHabit,
  updateHabit,
  deleteHabit,
  deleteAllHabits,
  countHabits,
  batchUpdateHabits,
  batchRestore,
} from "@/db/repositories/habit-repository";

import { Habit } from "@/types/habits";
import {
  applyMissedDayLogic,
  restartHabitAfterGoalForeground,
} from "@/utils/habit-utils";
import { useData } from "@/hooks/context-hooks/use-data";

interface HabitContextType {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  removeHabits: () => Promise<void>;
  reassignHabitCategoryLocal: (oldId: string, newId: string) => void;
  reassignHabitTagLocal: (oldId: string, newId: string) => void;
  habitCount: () => Promise<number>;
  batchMutateHabits: (habitsToMutate: Habit[], newValues: any) => Promise<void>;
  batchRestoreHabits: (originalHabits: Habit[]) => Promise<void>;
  refreshHabits: () => void;
}

export const HabitContext = createContext<HabitContextType | undefined>(
  undefined,
);

export default function HabitProvider({ children }: { children: ReactNode }) {
  const { dispatchError, trackMetric } = useData();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const optimisticHabitMutation = useCallback(
    async (
      optimisticUpdate: (prev: Habit[]) => Habit[],
      dbWrite: () => Promise<void> | Promise<Habit>,
    ): Promise<void> => {
      let snapshot: Habit[] = [];
      setHabits((prev) => {
        snapshot = prev;
        return prev;
      });
      setHabits(optimisticUpdate);
      try {
        await dbWrite();
      } catch (err) {
        console.error(
          "[DataContext] Habit DB write failed, rolling back:",
          err,
        );
        setHabits(snapshot);
        throw err;
      }
    },
    [],
  );

  const addHabit = useCallback(
    async (habit: Habit): Promise<void> => {
      await optimisticHabitMutation(
        (prev) => [...prev, habit],
        () => insertHabit(habit),
      );
    },
    [optimisticHabitMutation],
  );

  const editHabit = useCallback(
    async (habit: Habit): Promise<void> => {
      await optimisticHabitMutation(
        (prev) => prev.map((h) => (h.id === habit.id ? habit : h)),
        () => updateHabit(habit),
      );
    },
    [optimisticHabitMutation],
  );

  const removeHabit = useCallback(
    async (id: string): Promise<void> => {
      await optimisticHabitMutation(
        (prev) => prev.filter((h) => h.id !== id),
        () => deleteHabit(id),
      );
    },
    [optimisticHabitMutation],
  );

  const removeHabits = useCallback(async (): Promise<void> => {
    await deleteAllHabits();
    setHabits([]);
  }, []);

  const habitCount = useCallback(async (): Promise<number> => {
    const result = await countHabits();
    return result ?? 0;
  }, []);

  const reassignHabitCategoryLocal = useCallback(
    (oldCategoryId: string, newCategoryId: string): void => {
      setHabits((prev) =>
        prev.map((h) =>
          h.category === oldCategoryId
            ? {
                ...h,
                category: newCategoryId,
              }
            : h,
        ),
      );
    },
    [],
  );

  const reassignHabitTagLocal = useCallback(
    (oldTagId: string, newTagId: string | null): void => {
      setHabits((prev) =>
        prev.map((h) => {
          // If the habit doesn't have the old tag, return it untouched
          if (!h.tags?.includes(oldTagId)) return h;

          // Remove the old tag
          const filteredTags = h.tags.filter((id) => id !== oldTagId);

          // Add new tag securely
          if (newTagId && !filteredTags.includes(newTagId)) {
            filteredTags.push(newTagId);
          }

          return { ...h, tags: filteredTags };
        }),
      );
    },
    [],
  );

  const batchMutateHabits = useCallback(
    async (habitsToMutate: Habit[], newValues: any) => {
      // 1. Optimistic UI Update (0ms latency for the user)
      // usehabitStore.getState().updateMany(habitIds, newValues);
      const habitIds = habitsToMutate.map((t) => t.id);
      await optimisticHabitMutation(
        (prev) =>
          prev.map((e) => {
            if (!habitIds.includes(e.id)) return e;
            return {
              ...e,
              ...newValues,
              updatedAt: new Date().toISOString(),
            };
          }),
        () => batchUpdateHabits(habitsToMutate, newValues),
      );
    },
    [],
  );

  const batchRestoreHabits = useCallback(async (originalHabits: Habit[]) => {
    optimisticHabitMutation(
      (prev) =>
        prev.map((t) => ({ ...t, updatedAt: new Date().toISOString() })),
      () => batchRestore(originalHabits),
    );
  }, []);

  const refreshHabits = useCallback(async () => {
    try {
      let loadedHabits = await getAllHabits();
      let missedCount = 0;
      let autoFrozenCount = 0;
      const processedHabits = [];
      for (const habit of loadedHabits) {
        const { status, habit: updatedHabit } = applyMissedDayLogic(habit);
        let finalHabit = updatedHabit;

        if (status === "missed_check_in") {
          // Accumulate instead of writing to DB immediately
          missedCount++;
        } else if (status === "auto_frozen") {
          // Safely wait for the DB to update this specific habit
          await editHabit(updatedHabit);
          autoFrozenCount++;
        }

        if (habit.pendingStreakResetAfter) {
          const resettedHabit = restartHabitAfterGoalForeground(updatedHabit);
          if (!resettedHabit.pendingStreakResetAfter) {
            await editHabit(resettedHabit);
          }
          finalHabit = resettedHabit;
        }

        processedHabits.push(finalHabit);
      }

      // 3. Batch execute the metrics safely.
      // Now, the DB is only read/written ONCE per metric type.
      if (missedCount > 0) {
        await trackMetric(["habitCheckInsMissed"], missedCount);
      }
      if (autoFrozenCount > 0) {
        await trackMetric(["habitsAutoFrozen"], autoFrozenCount);
      }

      loadedHabits = processedHabits;
      /* loadedHabits = loadedHabits.map((habit) => {
          const { status, habit: updatedHabit } = applyMissedDayLogic(habit);
          if (status === "missed_check_in") {
            trackMetric(["habitCheckInsMissed"], 1);
          } else if (status === "auto_frozen") {
            editHabit(updatedHabit);
            trackMetric(["habitsAutoFrozen"], 1);
          }
          if (habit.pendingStreakResetAfter) {
            const resettedHabit = restartHabitAfterGoalForeground(updatedHabit);
            if (!resettedHabit.pendingStreakResetAfter) {
              editHabit(resettedHabit);
            }
            return resettedHabit;
          }
          return updatedHabit;
        }); */

      setHabits(loadedHabits);
    } catch (err) {
      console.error("[DataContext] Failed to initialise database:", err);
      dispatchError(
        `Failed to initialise database: ${err instanceof Error ? err.message : String(err)}`,
        "fatal",
      );
    } finally {
      // mark that initial load finished so save effects don't overwrite storage during startup
      setLoaded(true);
    }
  }, [
    trackMetric,
    editHabit,
    dispatchError,
    restartHabitAfterGoalForeground,
    applyMissedDayLogic,
  ]);

  useEffect(() => {
    refreshHabits();
  }, []);
  return (
    <HabitContext.Provider
      value={{
        habits,
        setHabits,
        addHabit,
        editHabit,
        removeHabit,
        removeHabits,
        reassignHabitCategoryLocal,
        reassignHabitTagLocal,
        habitCount,
        batchMutateHabits,
        batchRestoreHabits,
        refreshHabits,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}
