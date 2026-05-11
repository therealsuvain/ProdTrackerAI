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
} from "@/db/repositories/task-repository";

import { initDatabase } from "@/db";
import { useData } from "@/hooks/use-data";

interface TaskContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addTask: (task: Task, tagIds: string[]) => Promise<void>;
  editTask: (task: Task, tagIds: string[]) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  removeTasks: () => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  taskCount: () => Promise<number>;
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
    async (task: Task, tagIds: string[]): Promise<void> => {
      await optimisticTaskMutation(
        (prev) => [...prev, task],
        () => insertTask(task, tagIds),
      );
    },
    [optimisticTaskMutation],
  );

  const editTask = useCallback(
    async (task: Task, tagIds: string[]): Promise<void> => {
      await optimisticTaskMutation(
        (prev) => prev.map((t) => (t.id === task.id ? task : t)),
        () => updateTask(task, tagIds),
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
        taskCount,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}
