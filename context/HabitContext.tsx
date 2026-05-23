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
} from "@/db/repositories/habit-repository";

import { Habit } from "@/types/habits";
import {
  applyMissedDayLogic,
  restartHabitAfterGoalForeground,
} from "@/utils/habit-utils";
import { useData } from "@/hooks/use-data";
import { tag } from "@expo/ui/swift-ui/modifiers";

interface HabitContextType {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  addHabit: (habit: Habit, tagIds: string[]) => Promise<void>;
  editHabit: (habit: Habit, tagIds: string[]) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  removeHabits: () => Promise<void>;
  reassignHabitCategoryLocal: (oldId: string, newId: string) => void;
  reassignHabitTagLocal: (oldId: string, newId: string) => void;
  habitCount: () => Promise<number>;
}

export const HabitContext = createContext<HabitContextType | undefined>(
  undefined,
);

export default function HabitProvider({ children }: { children: ReactNode }) {
  const { dispatchError, trackMetric } = useData();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);

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
    async (habit: Habit, tagIds: string[]): Promise<void> => {
      await optimisticHabitMutation(
        (prev) => [...prev, habit],
        () => insertHabit(habit, tagIds),
      );
    },
    [optimisticHabitMutation],
  );

  const editHabit = useCallback(
    async (habit: Habit, tagIds: string[]): Promise<void> => {
      await optimisticHabitMutation(
        (prev) => prev.map((h) => (h.id === habit.id ? habit : h)),
        () => updateHabit(habit, tagIds),
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
          // If the task doesn't have the old tag, return it untouched
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
  useEffect(() => {
    const loadData = async () => {
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
            await editHabit(updatedHabit, updatedHabit.tags || []);
            autoFrozenCount++;
          }

          if (habit.pendingStreakResetAfter) {
            const resettedHabit = restartHabitAfterGoalForeground(updatedHabit);
            if (!resettedHabit.pendingStreakResetAfter) {
              await editHabit(resettedHabit, resettedHabit.tags || []);
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
    };
    loadData();
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
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}
