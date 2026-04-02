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
} from "@/db/repositories/habit-repository";

import { Habit } from "@/types/habits";
import {
  applyMissedDayLogic,
  restartHabitAfterGoalForeground,
} from "@/utils/habit-utils";
import { useData } from "@/hooks/use-data";

interface HabitContextType {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
}

export const HabitContext = createContext<HabitContextType | undefined>(
  undefined,
);

export default function HabitProvider({ children }: { children: ReactNode }) {
  const { dispatchError, trackMetric} = useData();
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


  useEffect(() => {
    const loadData = async () => {
      try {
        let loadedHabits = await getAllHabits();

        loadedHabits = loadedHabits.map((habit) => {
          const { status, habit: updatedHabit } = applyMissedDayLogic(habit);
          if (status === "missed_check_in") {
            trackMetric(["habitCheckInsMissed"], 1);
          } else if (status === "auto_frozen") {
            trackMetric(["habitsAutoFrozen"], 1);
          }
          if (habit.pendingStreakResetAfter) {
            editHabit(updatedHabit);
            return restartHabitAfterGoalForeground(updatedHabit);
          }
          return updatedHabit;
        });

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
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}
