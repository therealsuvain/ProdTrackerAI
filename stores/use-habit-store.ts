import { create } from "zustand";

import {
  batchRestore,
  batchUpdateHabits,
  countHabits,
  deleteAllHabits,
  deleteHabit,
  getAllHabits,
  insertHabit,
  updateHabit,
} from "@/db/repositories/habit-repository";
import { Habit } from "@/types/habits";

type HabitValues = Partial<Habit>;

type HabitStoreState = {
  habitsById: Record<string, Habit>;
  /**
   * Manual display order for drag-reorder. Local-only — never persisted to
   * SQLite, never sent to sync. Rebuilt from habitsById on every refresh.
   * If a habit in this array no longer exists in habitsById (deleted,
   * removed by sync), consumers must filter it out — see selectHabitOrder.
   */
  habitOrder: string[];
  loaded: boolean;
  refreshing: boolean;

  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  removeHabits: () => Promise<void>;

  reassignHabitCategoryLocal: (oldCategoryId: string, newCategoryId: string) => void;
  reassignHabitTagLocal: (oldTagId: string, newTagId: string | null) => void;

  habitCount: () => Promise<number>;

  batchMutateHabits: (habitsToMutate: Habit[], newValues: HabitValues) => Promise<void>;
  batchRestoreHabits: (originalHabits: Habit[]) => Promise<void>;

  /** Local-only reorder — does not touch SQLite. */
  setHabitOrder: (orderedIds: string[]) => void;

  refreshHabits: () => Promise<Record<string, Habit>>;
};

const emptyHabitsById = (): Record<string, Habit> => ({});

function normalizeHabits(habits: Habit[]): {
  habitsById: Record<string, Habit>;
  habitOrder: string[];
} {
  const habitsById: Record<string, Habit> = {};
  const habitOrder: string[] = [];
  for (const habit of habits) {
    habitsById[habit.id] = habit;
    habitOrder.push(habit.id);
  }
  return { habitsById, habitOrder };
}

function updateHabitById(
  habitsById: Record<string, Habit>,
  id: string,
  updater: (habit: Habit) => Habit,
): Record<string, Habit> {
  const current = habitsById[id];
  if (!current) return habitsById;
  const next = updater(current);
  if (next === current) return habitsById;
  return { ...habitsById, [id]: next };
}

export const useHabitStore = create<HabitStoreState>((set, get) => {
  const pendingOpByHabitId = new Map<string, symbol>();

  const applyOptimisticMutation = async (
    affectedIds: string[],
    optimisticUpdate: (habitsById: Record<string, Habit>) => Record<string, Habit>,
    dbWrite: () => Promise<unknown>,
  ): Promise<void> => {
    const opId = Symbol();
    for (const id of affectedIds) pendingOpByHabitId.set(id, opId);

    const previousById = get().habitsById;
    set((state) => ({ habitsById: optimisticUpdate(state.habitsById) }));

    try {
      await dbWrite();
    } catch (error) {
      set((state) => {
        const next = { ...state.habitsById };
        let rolledBackAny = false;
        for (const id of affectedIds) {
          if (pendingOpByHabitId.get(id) !== opId) continue;
          if (previousById[id]) next[id] = previousById[id];
          else delete next[id];
          rolledBackAny = true;
        }
        return rolledBackAny ? { habitsById: next } : state;
      });
      throw error;
    } finally {
      for (const id of affectedIds) {
        if (pendingOpByHabitId.get(id) === opId) pendingOpByHabitId.delete(id);
      }
    }
  };

  return {
    habitsById: emptyHabitsById(),
    habitOrder: [],
    loaded: false,
    refreshing: false,

    addHabit: async (habit) => {
      await applyOptimisticMutation(
        [habit.id],
        (habitsById) =>
          habitsById[habit.id] ? habitsById : { ...habitsById, [habit.id]: habit },
        () => insertHabit(habit),
      );
      // New habit appended to display order — local only.
      set((state) =>
        state.habitOrder.includes(habit.id)
          ? state
          : { habitOrder: [...state.habitOrder, habit.id] },
      );
    },

    editHabit: async (habit) => {
      await applyOptimisticMutation(
        [habit.id],
        (habitsById) =>
          habitsById[habit.id] ? { ...habitsById, [habit.id]: habit } : habitsById,
        () => updateHabit(habit),
      );
    },

    removeHabit: async (id) => {
      await applyOptimisticMutation(
        [id],
        (habitsById) => {
          if (!habitsById[id]) return habitsById;
          const next = { ...habitsById };
          delete next[id];
          return next;
        },
        () => deleteHabit(id),
      );
      set((state) => ({ habitOrder: state.habitOrder.filter((hid) => hid !== id) }));
    },

    removeHabits: async () => {
      await deleteAllHabits();
      set({ habitsById: emptyHabitsById(), habitOrder: [] });
    },

    reassignHabitCategoryLocal: (oldCategoryId, newCategoryId) => {
      set((state) => {
        let changed = false;
        const next = { ...state.habitsById };
        for (const id in next) {
          const habit = next[id];
          if (habit.category !== oldCategoryId) continue;
          changed = true;
          next[id] = { ...habit, category: newCategoryId };
        }
        return changed ? { habitsById: next } : state;
      });
    },

    reassignHabitTagLocal: (oldTagId, newTagId) => {
      set((state) => {
        let changed = false;
        const next = { ...state.habitsById };
        for (const id in next) {
          const habit = next[id];
          if (!habit.tags?.includes(oldTagId)) continue;
          const nextTags = habit.tags.filter((t) => t !== oldTagId);
          if (newTagId && !nextTags.includes(newTagId)) nextTags.push(newTagId);
          changed = true;
          next[id] = { ...habit, tags: nextTags };
        }
        return changed ? { habitsById: next } : state;
      });
    },

    habitCount: async () => (await countHabits()) ?? 0,

    batchMutateHabits: async (habitsToMutate, newValues) => {
      if (habitsToMutate.length === 0) return;
      const idsToMutate = habitsToMutate.map((h) => h.id);
      const updatedAt = new Date().toISOString();

      await applyOptimisticMutation(
        idsToMutate,
        (habitsById) => {
          const next = { ...habitsById };
          for (const id of idsToMutate) {
            const habit = next[id];
            if (!habit) continue;
            next[id] = { ...habit, ...newValues, updatedAt };
          }
          return next;
        },
        () => batchUpdateHabits(habitsToMutate, newValues),
      );
    },

    batchRestoreHabits: async (originalHabits) => {
      if (originalHabits.length === 0) return;
      const idsToRestore = originalHabits.map((h) => h.id);
      const updatedAt = new Date().toISOString();

      await applyOptimisticMutation(
        idsToRestore,
        (habitsById) => {
          const next = { ...habitsById };
          for (const habit of originalHabits) {
            if (!next[habit.id]) continue;
            next[habit.id] = { ...habit, updatedAt };
          }
          return next;
        },
        () => batchRestore(originalHabits),
      );
    },

    setHabitOrder: (orderedIds) => {
      // Defensive: never allow the order array to contain ids that don't
      // exist in habitsById — a stale drag payload or race with a delete
      // could otherwise leave a "ghost" id in the order.
      const validIds = orderedIds.filter((id) => Boolean(get().habitsById[id]));
      set({ habitOrder: validIds });
    },

    refreshHabits: async () => {
      set({ refreshing: true });
      try {
        const loadedHabits = await getAllHabits();
        const { habitsById, habitOrder } = normalizeHabits(loadedHabits);
        set({ habitsById, habitOrder, loaded: true });
        return get().habitsById;
      } finally {
        set({ refreshing: false });
      }
    },
  };
});

// ─── selectors ──────────────────────────────────────────────────────────────
// Exported so every consumer uses the identical filter/order logic — never
// let a screen write its own inline Object.values(...).filter(...).

export function selectHabitIds(state: HabitStoreState): string[] {
  return Object.keys(state.habitsById);
}

export function selectHabitOrderIds(state: HabitStoreState): string[] {
  // Falls back to insertion order for any habit not yet in habitOrder
  // (e.g. freshly synced-in habit before the next refresh rebuilds order).
  const known = new Set(state.habitOrder);
  const extras = Object.keys(state.habitsById).filter((id) => !known.has(id));
  return [...state.habitOrder.filter((id) => state.habitsById[id]), ...extras];
}