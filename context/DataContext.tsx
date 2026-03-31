import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";

import { Task } from "@/types/task";
import { CalendarEvent } from "@/types/calendar";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";
import { Message } from "@/types/chat";
import { AppMetrics, MetricKey, GlobalMetricKey } from "@/types/metrics";
import { AchievementBadge } from "@/types/achievements";

import {
  loadTasks,
  saveTasks,
  loadEvents,
  saveEvents,
  loadTimerLogs,
  saveTimerLogs,
  loadHabits,
  saveHabits,
  loadAIChatHistory,
  saveAIChatHistory,
  loadAppMetrics,
  mutateMetric,
} from "@/utils/storage-utils";
import {
  getAllTasks,
  insertTask,
  updateTask,
  deleteTask,
  toggleTaskCompleted,
  bulkInsertTasks,
} from "@/db/repositories/task-repository";
import { migrateTasksFromAsyncStorage } from "@/db/migrations/async-storage-migrations";
import { sqlite } from "@/db/index";
import { processAchievements } from "@/utils/achievements-util";
import {
  applyMissedDayLogic,
  restartHabitAfterGoalForeground,
} from "@/utils/habit-utils";
import { cancelReminder } from "@/hooks/use-notifications";

import {
  dummyTasks,
  dummyEvents,
  dummyTimerLogs,
  dummyHabits,
} from "@/data/dummyData";

import { AchievementToast } from "@/components/ui/achievements/achievement-toast";
import { usePlaySound } from "@/hooks/use-play-sound";
import { initDatabase } from "@/db";

interface DataContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  timerLogs: TimerLog[];
  setTimerLogs: React.Dispatch<React.SetStateAction<TimerLog[]>>;
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  error: {
    message: string;
    type?: "warning" | "fatal";
  } | null;
  dispatchError: (err: Error | string, type: "warning" | "fatal") => void;
  clearError: () => void;
  deleteEventOccurrence: (
    eventId: string,
    date: string,
    all: boolean,
  ) => Promise<void>;
  appMetrics: AppMetrics | null;
  trackMetric: (key: GlobalMetricKey[], amount: number) => Promise<void>;
}

export const DataContext = createContext<DataContextType | undefined>(
  undefined,
);

// Feature flag for using dummy data - can be moved to environment variables or config
const USE_DUMMY_DATA = false;

export default function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [appMetrics, setAppMetrics] = useState<AppMetrics | null>(null);
  const [activeBadge, setActiveBadge] = useState<AchievementBadge | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<{
    message: string;
    type?: "warning" | "fatal";
  } | null>(null);
  useDrizzleStudio(sqlite);
  const dispatchError = useCallback(
    (err: Error | string, type: "warning" | "fatal" = "warning") => {
      const message = typeof err === "string" ? err : err.message;
      console.error("Dispatched Error:", message, err);
      setError({ message, type });
      if (type !== "fatal") {
        setTimeout(() => clearError(), 5000); // Auto-clear non-fatal
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  const audioSource = require("@/assets/audio/achievement-unlocked.mp3");
  const audioPlayer = usePlaySound(audioSource);

  const optimisticTaskMutation = useCallback(
    async (
      optimisticUpdate: (prev: Task[]) => Task[],
      dbWrite: () => Promise<void> | Promise<Task>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: Task[] = [];
      setTasks((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setTasks(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error("[DataContext] Task DB write failed, rolling back:", err);
        setTasks(snapshot);
        throw err; // caller catches this and shows DbErrorToast
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

  /**
   * Compatibility shim for code not yet migrated to the new methods.
   * Syncs the new state AND attempts to persist to SQLite.
   * Not optimistic — just a best-effort write.
   * Remove after Phase 7.
   */
  /* const setTasks: React.Dispatch<React.SetStateAction<Task[]>> = useCallback(
    (action) => {
      setTasksState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        // Fire-and-forget SQLite sync for legacy callers
        // New callers should use addTask/editTask/removeTask/toggleTask
        bulkInsertTasks(next).catch((e) =>
          console.warn("[DataContext] Legacy setTasks SQLite sync failed:", e),
        );
        return next;
      });
    },
    [],
  ); */
  const deleteEventOccurrence = async (
    eventId: string,
    date: string,
    all: boolean,
  ) => {
    setEvents((prev) => {
      const updated = prev.map((event) => {
        if (event.id !== eventId) return event;

        if (all) {
          // cancel all notifications
          event.notificationIds?.forEach((n) => cancelReminder(n.id));
          return null; // mark for deletion
        }

        // cancel only the notification for that date
        const notifId = event.notificationIds?.find((n) => n.date === date)?.id;
        if (notifId) cancelReminder(notifId);

        return {
          ...event,
          deletedOccurrences: [...(event.deletedOccurrences || []), date],
          notificationIds: event.notificationIds?.filter(
            (n) => n.date !== date,
          ),
        };
      });

      // remove nulls if "all" deleted
      return updated.filter((e): e is CalendarEvent => e !== null);
    });
  };

  const trackMetric = useCallback(
    async (keys: GlobalMetricKey[], amount: number) => {
      // 1. Mutate storage atomically
      const updatedMetrics = await mutateMetric(keys, amount);
      // 2. Update React Context so UI (Heatmaps, Progress Bars) re-renders instantly
      setAppMetrics((prevMetrics) => ({ ...prevMetrics, ...updatedMetrics }));

      // 3. If the user advanced a metric (not undid it), check for achievements!
      if (amount > 0) {
        let newlyUnlocked: AchievementBadge[] = [];

        try {
          for (const key of keys) {
            newlyUnlocked = await processAchievements(
              updatedMetrics.global[key],
              key,
            );
          }

          // Phase 6.3 Prep: If we got badges, we will trigger a global toast here later!
          if (newlyUnlocked.length > 0) {
            const achievementToastQueue = [...newlyUnlocked];
            function showNext() {
              const badge = achievementToastQueue.shift();
              if (!badge) return;
              setActiveBadge(badge);
              audioPlayer.seekTo(0);
              audioPlayer.play();
              setTimeout(() => {
                setActiveBadge(null);
                setTimeout(showNext, 500); // small gap between badges
              }, 6000);
            }
            showNext();
          }
        } catch (err) {
          console.error("Error evaluating achievements:", err);
        }
      }
    },
    [],
  );

  // Initialize and load data
  useEffect(() => {
    const loadData = async () => {
      try {
        await initDatabase();

        //await migrateTasksFromAsyncStorage();
        let loadedTasks = await getAllTasks();
        let loadedEvents = await loadEvents();
        let loadedLogs = await loadTimerLogs();
        let loadedHabits = await loadHabits();
        let loadedMessages = await loadAIChatHistory();
        let loadedMetrics = await loadAppMetrics();

        // Initialize with dummy data if enabled and no data exists
        if (USE_DUMMY_DATA) {
          if (loadedTasks.length === 0) loadedTasks = dummyTasks;
          if (loadedEvents.length === 0) loadedEvents = dummyEvents;
          if (loadedLogs.length === 0) loadedLogs = dummyTimerLogs;
          if (loadedHabits.length === 0) loadedHabits = dummyHabits;
        }

        loadedHabits = loadedHabits.map((habit) => {
          const { status, habit: updatedHabit } = applyMissedDayLogic(habit);
          if (status === "missed_check_in") {
            trackMetric(["habitCheckInsMissed"], 1);
          } else if (status === "auto_frozen") {
            trackMetric(["habitsAutoFrozen"], 1);
          }
          if (habit.pendingStreakResetAfter) {
            return restartHabitAfterGoalForeground(updatedHabit);
          }
          return updatedHabit;
        });
        //loadedTasks = loadedTasks.filter((t)=>!t.title.includes("testing") && !t.title.includes("Testing"))
        setTasks(loadedTasks);
        setEvents(loadedEvents);
        setTimerLogs(loadedLogs);
        setHabits(loadedHabits);
        setMessages(loadedMessages);
        setAppMetrics(loadedMetrics);
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

  /*   useEffect(() => {
    if (!loaded) return;
    saveTasks(tasks);
     console.log(
      "DATA TASKS",
      tasks.map((e) => {
        return { ...e, embedding: e.embedding?.[0] };
      }),
    ); 
  }, [tasks, loaded]); */

  useEffect(() => {
    if (!loaded) return;
    saveEvents(events);
    console.log(
      "DATA EVENTS",
      events.map((e) => {
        return { ...e, embedding: e.embedding?.[0] };
      }),
    );
  }, [events, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveTimerLogs(timerLogs);
    //console.log("DATA LOGS", timerLogs);
  }, [timerLogs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveHabits(habits);
    /*  console.log(
      "DATA HABITS",
      habits.map((e) => {
        return { title: e.title, freezeHistory: typeof e.freezeHistory?.[0] };
      }),
    ); */
  }, [habits, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveAIChatHistory(messages);
    //messages.map((m) => console.log(new Date(m.timestamp).toLocaleString()));
    //console.log("DATA MESSAGES", messages[0]);
  }, [messages, loaded]);

  return (
    <DataContext.Provider
      value={{
        tasks,
        setTasks,
        addTask,
        editTask,
        removeTask,
        toggleTask,
        events,
        setEvents,
        timerLogs,
        setTimerLogs,
        habits,
        setHabits,
        messages,
        setMessages,
        error,
        dispatchError,
        clearError,
        deleteEventOccurrence,
        appMetrics,
        trackMetric,
      }}
    >
      {children}
      <AchievementToast badge={activeBadge} />
    </DataContext.Provider>
  );
}
