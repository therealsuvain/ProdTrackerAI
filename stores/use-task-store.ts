// stores/use-task-store.ts
import { create } from "zustand";

import {
  batchRestore,
  batchUpdateTasks,
  countTasks,
  deleteAllTasks,
  deleteTask,
  getAllTasks,
  insertTask,
  toggleTaskCompleted,
  updateTask,
} from "@/db/repositories/task-repository";
import { Task } from "@/types/task";

type TaskValues = Partial<Task>;

type TaskStoreState = {
  tasksById: Record<string, Task>;
  loaded: boolean;
  refreshing: boolean;

  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  removeTasks: () => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  replaceTasksLocally: (tasks: string[]) => void;

  reassignTaskCategoryLocal: (
    oldCategoryId: string,
    newCategoryId: string,
  ) => void;

  reassignTaskTagLocal: (
    oldTagId: string,
    newTagId: string | null,
  ) => void;

  taskCount: () => Promise<number>;

  batchMutateTasks: (
    tasksToMutate: Task[],
    newValues: TaskValues,
  ) => Promise<void>;

  batchRestoreTasks: (originalTasks: Task[]) => Promise<void>;

  refreshTasks: () => Promise<Record<string, Task>>;
};

const emptyTasksById = (): Record<string, Task> => ({});

function normalizeTasks(tasks: Task[]): Record<string, Task> {
  const tasksById: Record<string, Task> = {};
  for (const task of tasks) {
    tasksById[task.id] = task;
  }
  return tasksById;
}

function reorderTasks(taskIds: string[], tasksByIdOld: Record<string, Task>): Record<string, Task> {
  const tasksById: Record<string, Task> = {};
  for (const taskId of taskIds) {
    tasksById[taskId] = tasksByIdOld[taskId];
  }
  return tasksById;
}
function updateTaskById(
  tasksById: Record<string, Task>,
  id: string,
  updater: (task: Task) => Task,
): Record<string, Task> {
  const current = tasksById[id];
  if (!current) return tasksById;

  const next = updater(current);
  if (next === current) return tasksById;

  return { ...tasksById, [id]: next };
}

export const selectedDateTaskIds = (
  state: TaskStoreState,
  today: string,
): string[] => {
  return Object.values(state.tasksById)
    .filter((task) => task.dueDate?.split("T")[0] === today)
    .map((task) => task.id);
};

export const useTaskStore = create<TaskStoreState>((set, get) => {
  // Tracks the most recent in-flight mutation id per task id, so a failed
  // rollback never stomps a newer, already-succeeded write to the same task.
  const pendingOpByTaskId = new Map<string, symbol>();

  const applyOptimisticMutation = async (
    affectedIds: string[],
    optimisticUpdate: (
      tasksById: Record<string, Task>,
    ) => Record<string, Task>,
    dbWrite: () => Promise<unknown>,
  ): Promise<void> => {
    const opId = Symbol();
    for (const id of affectedIds) {
      pendingOpByTaskId.set(id, opId);
    }

    const previousById = get().tasksById;
    set((state) => ({ tasksById: optimisticUpdate(state.tasksById) }));

    try {
      await dbWrite();
    } catch (error) {
      set((state) => {
        const nextTasksById = { ...state.tasksById };
        let rolledBackAny = false;

        for (const id of affectedIds) {
          if (pendingOpByTaskId.get(id) !== opId) continue; // superseded — leave the newer write alone
          if (previousById[id]) {
            nextTasksById[id] = previousById[id];
          } else {
            delete nextTasksById[id];
          }
          rolledBackAny = true;
        }

        return rolledBackAny ? { tasksById: nextTasksById } : state;
      });
      throw error;
    } finally {
      for (const id of affectedIds) {
        if (pendingOpByTaskId.get(id) === opId) {
          pendingOpByTaskId.delete(id);
        }
      }
    }
  };

  return {
    tasksById: emptyTasksById(),
    loaded: false,
    refreshing: false,

    addTask: async (task) => {
      await applyOptimisticMutation(
        [task.id],
        (tasksById) =>
          tasksById[task.id]
            ? tasksById
            : { ...tasksById, [task.id]: task },
        () => insertTask(task),
      );
    },

    editTask: async (task) => {
      await applyOptimisticMutation(
        [task.id],
        (tasksById) =>
          tasksById[task.id]
            ? { ...tasksById, [task.id]: task }
            : tasksById,
        () => updateTask(task),
      );
    },

    removeTask: async (id) => {
      await applyOptimisticMutation(
        [id],
        (tasksById) => {
          if (!tasksById[id]) return tasksById;
          const next = { ...tasksById };
          delete next[id];
          return next;
        },
        () => deleteTask(id),
      );
    },

    removeTasks: async () => {
      await deleteAllTasks();
      set({ tasksById: emptyTasksById() });
    },

    toggleTask: async (id) => {
      const currentTask = get().tasksById[id];
      if (!currentTask) {
        throw new Error(`Task ${id} not found`);
      }

      const now = new Date().toISOString();
      const completed = !currentTask.completed;

      await applyOptimisticMutation(
        [id],
        (tasksById) =>
          updateTaskById(tasksById, id, (task) => ({
            ...task,
            completed,
            completedAt: completed ? now : undefined,
            updatedAt: now,
          })),
        () => toggleTaskCompleted(id, currentTask.completed),
      );
    },

replaceTasksLocally: (taskIds) => {
  set({
    tasksById: reorderTasks(taskIds, get().tasksById),
  });
},
    reassignTaskCategoryLocal: (oldCategoryId, newCategoryId) => {
      set((state) => {
        let changed = false;
        const next = { ...state.tasksById };

        for (const id in next) {
          const task = next[id];
          if (task.category !== oldCategoryId) continue;
          changed = true;
          next[id] = { ...task, category: newCategoryId };
        }

        return changed ? { tasksById: next } : state;
      });
    },

    reassignTaskTagLocal: (oldTagId, newTagId) => {
      set((state) => {
        let changed = false;
        const next = { ...state.tasksById };

        for (const id in next) {
          const task = next[id];
          if (!task.tags?.includes(oldTagId)) continue;

          const nextTags = task.tags.filter((tagId) => tagId !== oldTagId);
          if (newTagId && !nextTags.includes(newTagId)) {
            nextTags.push(newTagId);
          }

          changed = true;
          next[id] = { ...task, tags: nextTags };
        }

        return changed ? { tasksById: next } : state;
      });
    },

    taskCount: async () => (await countTasks()) ?? 0,

    batchMutateTasks: async (tasksToMutate, newValues) => {
      if (tasksToMutate.length === 0) return;

      const idsToMutate = tasksToMutate.map((t) => t.id);
      const updatedAt = new Date().toISOString();

      await applyOptimisticMutation(
        idsToMutate,
        (tasksById) => {
          const next = { ...tasksById };
          for (const id of idsToMutate) {
            const task = next[id];
            if (!task) continue;
            next[id] = { ...task, ...newValues, updatedAt };
          }
          return next;
        },
        () => batchUpdateTasks(tasksToMutate, newValues),
      );
    },

    batchRestoreTasks: async (originalTasks) => {
      if (originalTasks.length === 0) return;

      const idsToRestore = originalTasks.map((t) => t.id);
      const updatedAt = new Date().toISOString();

      await applyOptimisticMutation(
        idsToRestore,
        (tasksById) => {
          const next = { ...tasksById };
          for (const task of originalTasks) {
            if (!next[task.id]) continue;
            next[task.id] = { ...task, updatedAt };
          }
          return next;
        },
        () => batchRestore(originalTasks),
      );
    },

    refreshTasks: async () => {
  set({ refreshing: true });
  try {
    const loadedTasks = await getAllTasks();
    set({ tasksById: normalizeTasks(loadedTasks), loaded: true });
    return get().tasksById; // ← new
  } finally {
    set({ refreshing: false });
  }
},

  };
});