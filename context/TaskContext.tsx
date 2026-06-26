import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import { Task } from "@/types/task";

import {
  getAllTasks,
  insertTask,
  updateTask,
  deleteTask,
  deleteAllTasks,
  toggleTaskCompleted,
  countTasks,
  batchUpdateTasks,
  batchRestore,
} from "@/db/repositories/task-repository";

import { initDatabase } from "@/db";
import { useData } from "@/hooks/context-hooks/use-data";

interface TaskContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  removeTasks: () => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  reassignTaskCategoryLocal: (oldId: string, newId: string) => void;
  reassignTaskTagLocal: (oldId: string, newId: string) => void;
  taskCount: () => Promise<number>;
  batchMutateTasks: (tasksToMutate: Task[], newValues: any) => Promise<void>;
  batchRestoreTasks: (originalTasks: Task[]) => Promise<void>;
}

export const TaskContext = createContext<TaskContextType | undefined>(
  undefined,
);

export default function TaskProvider({ children }: { children: ReactNode }) {
  const { dispatchError } = useData();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  const optimisticTaskMutation = useCallback(
    async (
      optimisticUpdate: (prev: Task[]) => Task[],
      dbWrite: () => Promise<void> | Promise<Task>,
    ): Promise<void> => {
      let snapshot: Task[] = [];
      setTasks((prev) => {
        snapshot = prev;
        return prev;
      });

      setTasks(optimisticUpdate);

      try {
        await dbWrite();
      } catch (err) {
        console.error("[TaskContext] Task DB write failed, rolling back:", err);
        setTasks(snapshot);
        throw err;
      }
    },
    [],
  );

  const addTask = useCallback(
    async (task: Task): Promise<void> => {
      await optimisticTaskMutation(
        (prev) => [...prev, task],
        () => insertTask(task),
      );
    },
    [optimisticTaskMutation],
  );

  const editTask = useCallback(
    async (task: Task): Promise<void> => {
      await optimisticTaskMutation(
        (prev) => prev.map((t) => (t.id === task.id ? task : t)),
        () => updateTask(task),
      );
    },
    [optimisticTaskMutation],
  );

  const removeTask = useCallback(
    async (id: string): Promise<void> => {
      await optimisticTaskMutation(
        (prev) => prev.filter((t) => t.id !== id),
        () => deleteTask(id),
      );
    },
    [optimisticTaskMutation],
  );

  const removeTasks = useCallback(async (): Promise<void> => {
    await deleteAllTasks();
    setTasks([]);
  }, []);

  const reassignTaskCategoryLocal = useCallback(
    (oldCategoryId: string, newCategoryId: string): void => {
      setTasks((prev) =>
        prev.map((t) =>
          t.category === oldCategoryId
            ? {
                ...t,
                category: newCategoryId,
              }
            : t,
        ),
      );
    },
    [],
  );

  // Example for TaskContext:
  const reassignTaskTagLocal = useCallback(
    (oldTagId: string, newTagId: string | null): void => {
      setTasks((prev) =>
        prev.map((t) => {
          // If the task doesn't have the old tag, return it untouched
          if (!t.tags?.includes(oldTagId)) return t;

          // Remove the old tag
          const filteredTags = t.tags.filter((id) => id !== oldTagId);

          // Add new tag securely
          if (newTagId && !filteredTags.includes(newTagId)) {
            filteredTags.push(newTagId);
          }

          return { ...t, tags: filteredTags };
        }),
      );
    },
    [],
  );

  const toggleTask = useCallback(
    async (id: string): Promise<void> => {
      await optimisticTaskMutation(
        (prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            const newCompleted = !t.completed;
            return {
              ...t,
              completed: newCompleted,
              completedAt: newCompleted ? new Date().toISOString() : undefined,
              updatedAt: new Date().toISOString(),
            };
          }),
        async () => {
          const task = tasks.find((t) => t.id === id);
          if (!task) throw new Error(`Task ${id} not found`);
          await toggleTaskCompleted(id, task.completed);
        },
      );
    },
    [optimisticTaskMutation, tasks],
  );

  const taskCount = useCallback(async (): Promise<number> => {
    const result = await countTasks();
    return result ?? 0;
  }, []);

  const batchMutateTasks = useCallback(
    async (tasksToMutate: Task[], newValues: any) => {
      // 1. Optimistic UI Update (0ms latency for the user)
      // useTaskStore.getState().updateMany(taskIds, newValues);
      const taskIds = tasksToMutate.map((t) => t.id);
      await optimisticTaskMutation(
        (prev) =>
          prev.map((t) => {
            if (!taskIds.includes(t.id)) return t;
            return {
              ...t,
              ...newValues,
              updatedAt: new Date().toISOString(),
            };
          }),
        () => batchUpdateTasks(tasksToMutate, newValues),
      );
    },
    [],
  );

  const batchRestoreTasks = useCallback(async (originalTasks: Task[]) => {
    optimisticTaskMutation(
      (prev) =>
        prev.map((t) => ({ ...t, updatedAt: new Date().toISOString() })),
      () => batchRestore(originalTasks),
    );
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        await initDatabase();
        let loadedTasks = await getAllTasks();
        setTasks(loadedTasks);
      } catch (err) {
        console.error("[TaskContext] Failed to initialise database:", err);
        dispatchError(
          `Failed to initialise database: ${err instanceof Error ? err.message : String(err)}`,
          "fatal",
        );
      } finally {
        setLoaded(true);
      }
    };
    loadTasks();
  }, []);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        setTasks,
        addTask,
        editTask,
        removeTask,
        removeTasks,
        toggleTask,
        reassignTaskCategoryLocal,
        reassignTaskTagLocal,
        taskCount,
        batchMutateTasks,
        batchRestoreTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}
