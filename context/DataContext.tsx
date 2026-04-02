import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";

import { Task } from "@/types/task";
import { CalendarEvent } from "@/types/calendar";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";
import { Message } from "@/types/chat";
import {
  AppMetrics,
  MetricKey,
  GlobalMetricKey,
  DefaultMetrics,
} from "@/types/metrics";
import { AchievementBadge } from "@/types/achievements";

import {
  getAllTasks,
  getTaskById,
  insertTask,
  updateTask,
  deleteTask,
  toggleTaskCompleted,
  bulkInsertTasks,
} from "@/db/repositories/task-repository";

import {
  getAllHabits,
  getHabitById,
  insertHabit,
  updateHabit,
  deleteHabit,
  countHabits,
} from "@/db/repositories/habit-repository";

import {
  getAllCalendarEvents,
  getCalendarEventById,
  insertCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  countCalendarEvents,
} from "@/db/repositories/event-repository";

import {
  getAllTimerLogs,
  getTimerLogById,
  insertTimerLog,
  updateTimerLog,
  deleteTimerLog,
  countTimerLogs,
} from "@/db/repositories/timer-log-repository";

import {
  getAllMessages,
  insertMessage,
  updateMessage,
  countMessages,
} from "@/db/repositories/chat-message-repository";

import {
  loadAppMetricsFromDb,
  loadDailyMetricsRange,
  mutateMetricInDb,
} from "@/db/repositories/metrics-repository";

import {
  getAllUnlockedAchievements,
  insertUnlockedAchievements,
  countUnlockedAchievements,
} from "@/db/repositories/unlocked-achievement-repository";

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

//TODO Seperate this monolith itno item specific contexts
// TODO if achievemnt unlokec while a modal is open eg. goalCompletionModal , the achievement toast is behind overlay, bring to the top instead
interface DataContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task | null>;
  getTasks: () => Promise<Task[]>;
  taskCount: () => Promise<number>;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  getEvent: (id: string) => Promise<CalendarEvent | null>;
  getEvents: () => Promise<CalendarEvent[]>;
  eventCount: () => Promise<number>;
  timerLogs: TimerLog[];
  setTimerLogs: React.Dispatch<React.SetStateAction<TimerLog[]>>;
  addLog: (timerLog: TimerLog) => Promise<void>;
  editLog: (timerLog: TimerLog) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  getLogs: () => Promise<TimerLog[]>;
  logCount: () => Promise<number>;
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  getHabit: (id: string) => Promise<Habit | null>;
  getHabits: () => Promise<Habit[]>;
  habitCount: () => Promise<number>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (message: Message) => Promise<void>;
  editMessage: (message: Message) => Promise<void>;
  getMessages: () => Promise<Message[]>;
  messageCount: () => Promise<number>;
  resolveItemId: <T extends { id: string }>(
    shortOrFullId: string,
    items: T[],
  ) => string | null;
  unlockedAchievements: AchievementBadge[];
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
  appMetrics: AppMetrics;
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
  const [appMetrics, setAppMetrics] = useState<AppMetrics>(DefaultMetrics);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    AchievementBadge[]
  >([]);
  // Ref for appMetric snapshot during Optimistic update
  const appMetricsRef = useRef(appMetrics);
  const unlockedAchievementsRef = useRef<AchievementBadge[]>([]);
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

  const resolveItemId = useCallback(
    <T extends { id: string }>(
      shortOrFullId: string,
      items: T[],
    ): string | null => {
      if (shortOrFullId.length === 8) {
        return (
          items.find((item) => item.id.startsWith(shortOrFullId))?.id ?? null
        );
      }
      return shortOrFullId;
    },
    [],
  );

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

  const getTask = useCallback(async (id: string): Promise<Task> => {
    const task = await getTaskById(id);
    if (!task) throw new Error(`Event ${id} not found`);
    return task;
  }, []);

  const getTasks = useCallback(async (): Promise<Task[]> => {
    const tasks = await getAllTasks();
    return tasks ?? [];
  }, []);

  const taskCount = useCallback(async (): Promise<number> => {
    const result = await countCalendarEvents();
    return result ?? 0;
  }, []);

  const optimisticCalendarEventMutation = useCallback(
    async (
      optimisticUpdate: (prev: CalendarEvent[]) => CalendarEvent[],
      dbWrite: () => Promise<void> | Promise<CalendarEvent>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: CalendarEvent[] = [];
      setEvents((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setEvents(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] Event DB write failed, rolling back:",
          err,
        );
        setEvents(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addEvent = useCallback(
    async (event: CalendarEvent): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => [...prev, event],
        () => insertCalendarEvent(event),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const editEvent = useCallback(
    async (event: CalendarEvent): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => prev.map((e) => (e.id === event.id ? event : e)),
        () => updateCalendarEvent(event),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const removeEvent = useCallback(
    async (id: string): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => prev.filter((e) => e.id !== id),
        () => deleteCalendarEvent(id),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const getEvent = useCallback(async (id: string): Promise<CalendarEvent> => {
    const event = await getCalendarEventById(id);
    if (!event) throw new Error(`Event ${id} not found`);
    return event;
  }, []);

  const getEvents = useCallback(async (): Promise<CalendarEvent[]> => {
    const events = await getAllCalendarEvents();
    return events ?? [];
  }, []);

  const eventCount = useCallback(async (): Promise<number> => {
    const result = await countCalendarEvents();
    return result ?? 0;
  }, []);

  const optimisticHabitMutation = useCallback(
    async (
      optimisticUpdate: (prev: Habit[]) => Habit[],
      dbWrite: () => Promise<void> | Promise<Habit>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: Habit[] = [];
      setHabits((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setHabits(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] Habit DB write failed, rolling back:",
          err,
        );
        setHabits(snapshot);
        throw err; // caller catches this and shows DbErrorToast
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

  const getHabit = useCallback(async (id: string): Promise<Habit> => {
    const habit = await getHabitById(id);
    if (!habit) throw new Error(`Habit ${id} not found`);
    return habit;
  }, []);

  const getHabits = useCallback(async (): Promise<Habit[]> => {
    const habits = await getAllHabits();
    return habits ?? [];
  }, []);

  const habitCount = useCallback(async (): Promise<number> => {
    const result = await countHabits();
    return result ?? 0;
  }, []);

  const optimisticTimerLogMutation = useCallback(
    async (
      optimisticUpdate: (prev: TimerLog[]) => TimerLog[],
      dbWrite: () => Promise<void> | Promise<TimerLog>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: TimerLog[] = [];
      setTimerLogs((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setTimerLogs(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] TimerLog DB write failed, rolling back:",
          err,
        );
        setTimerLogs(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addLog = useCallback(
    async (log: TimerLog): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => [...prev, log],
        () => insertTimerLog(log),
      );
    },
    [optimisticTimerLogMutation],
  );

  const editLog = useCallback(
    async (log: TimerLog): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => prev.map((l) => (l.id === log.id ? log : l)),
        () => updateTimerLog(log),
      );
    },
    [optimisticTimerLogMutation],
  );

  const removeLog = useCallback(
    async (id: string): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => prev.filter((l) => l.id !== id),
        () => deleteTimerLog(id),
      );
    },
    [optimisticTimerLogMutation],
  );

  const getLogs = useCallback(async (): Promise<TimerLog[]> => {
    const logs = await getAllTimerLogs();
    return logs ?? [];
  }, []);

  const logCount = useCallback(async (): Promise<number> => {
    const result = await countTimerLogs();
    return result ?? 0;
  }, []);

  const optimisticMessageMutation = useCallback(
    async (
      optimisticUpdate: (prev: Message[]) => Message[],
      dbWrite: () => Promise<void> | Promise<Message>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: Message[] = [];
      setMessages((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setMessages(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] Message DB write failed, rolling back:",
          err,
        );
        setMessages(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addMessage = useCallback(
    async (message: Message): Promise<void> => {
      await optimisticMessageMutation(
        (prev) => [message, ...prev],
        () => insertMessage(message),
      );
    },
    [optimisticMessageMutation],
  );

  const editMessage = useCallback(
    async (message: Message): Promise<void> => {
      await optimisticMessageMutation(
        (prev) => prev.map((m) => (m.id === message.id ? message : m)),
        () => updateMessage(message),
      );
    },
    [optimisticMessageMutation],
  );

  const messageCount = useCallback(async (): Promise<number> => {
    const result = await countMessages();
    return result ?? 0;
  }, []);

  const getMessages = useCallback(async (): Promise<Message[]> => {
    const messages = await getAllMessages();
    return messages ?? [];
  }, []);

  const optimisticUnlockedAchievementMutation = useCallback(
    async (
      optimisticUpdate: (prev: AchievementBadge[]) => AchievementBadge[],
      dbWrite: () => Promise<void> | Promise<AchievementBadge>,
    ): Promise<void> => {
      let snapshot: AchievementBadge[] = [];
      setUnlockedAchievements((prev) => {
        snapshot = prev;
        return prev;
      });
      setUnlockedAchievements(optimisticUpdate);

      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] UnlockedAchievement DB write failed, rolling back:",
          err,
        );
        setUnlockedAchievements(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addUnlockedAchievement = useCallback(
    async (achievement: AchievementBadge): Promise<void> => {
      unlockedAchievementsRef.current = [
        ...unlockedAchievementsRef.current,
        achievement,
      ];
      await optimisticUnlockedAchievementMutation(
        (prev) => [...prev, achievement],
        () => insertUnlockedAchievements(achievement),
      );
    },
    [optimisticUnlockedAchievementMutation],
  );

  const unlockedAchievementCount = useCallback(async (): Promise<number> => {
    const result = await countUnlockedAchievements();
    return result ?? 0;
  }, []);

  // Remove Dont need optmistic app metrics mutator
/*   const optimisticAppMetricsMutation = useCallback(
    async (
      optimisticUpdate: (prev: AppMetrics) => AppMetrics,
      metricDbWrite: (keys: MetricKey[] , amount: number, dateOverride?: string) => Promise<AppMetrics>,
    ): AppMetrics => {
      // 1. Snapshot
      let snapshot: AppMetrics = DefaultMetrics;
      setAppMetrics((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setAppMetrics(optimisticUpdate);

      // 3. DB write
      try {
        const updatedMetrics = await metricDbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] AppMetrics DB write failed, rolling back:",
          err,
        );
        setAppMetrics(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }

      return updatedMetrics
    },
    [],
  );

  const mutateAppMetrics = useCallback(async (): Promise<void> => {
    await optimisticAppMetricsMutation(
      (prev) => [...prev, achievement],
      () => insertUnlockedAchievements(achievement),
    );
  }, [optimisticAppMetricsMutation]); */
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
    const event = events.find((e) => e.id === eventId);
    if (!event) return; //TODO add feedback?
    //TODO what if there is just one occurence and user doesnt choose delete all, UI doesnt show, but DB still has it
    if (all) {
      // cancel all notifications
      event.notificationIds?.forEach((n) => cancelReminder(n.id));
      await removeEvent(eventId);
    }

    // cancel only the notification for that date
    const notifId = event.notificationIds?.find((n) => n.date === date)?.id;
    if (notifId) cancelReminder(notifId);

    await editEvent({
      ...event,
      deletedOccurrences: [...(event.deletedOccurrences || []), date],
      notificationIds: event.notificationIds?.filter((n) => n.date !== date),
    });
  };

  const trackMetric = useCallback(
    async (keys: GlobalMetricKey[], amount: number) => {
      // 1. Mutate storage atomically
      const updatedMetrics = await mutateMetricInDb(keys, amount);
      // 2. Update React Context so UI (Heatmaps, Progress Bars) re-renders instantly
      setAppMetrics((prevMetrics) => ({ ...prevMetrics, ...updatedMetrics }));

      // 3. If the user advanced a metric (not undid it), check for achievements!
      if (amount > 0) {
        let localUnlocked = [...unlockedAchievementsRef.current];
        let newlyUnlocked: AchievementBadge[] = [];
        try {
          for (const key of keys) {
            const newlyUnlockedForKey = await processAchievements(
              localUnlocked,
              updatedMetrics.global[key],
              key,
            );
            console.log(
              `Newly unlocked ${key}:`,
              newlyUnlockedForKey.map((b) => b.title),
            );
            for (const badge of newlyUnlockedForKey) {
              await addUnlockedAchievement(badge);
              localUnlocked = [...localUnlocked, badge];
            }
            newlyUnlocked = newlyUnlocked.concat(newlyUnlockedForKey);
          }

          // Phase 6.3 Prep: If we got badges, we will trigger a global toast here later!
          if (newlyUnlocked.length > 0) {
            const achievementToastQueue = [...newlyUnlocked];
            function showNext() {
              console.log("showNext:", achievementToastQueue.length);
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
        let loadedEvents = await getAllCalendarEvents();
        let loadedLogs = await getAllTimerLogs();
        let loadedHabits = await getAllHabits();
        let loadedMessages = await getAllMessages();
        let loadedMetrics = await loadAppMetricsFromDb();
        let loadedUnlockedAchievements = await getAllUnlockedAchievements();

        // Initialize with dummy data if enabled and no data exists
        /*         if (USE_DUMMY_DATA) {
          if (loadedTasks.length === 0) loadedTasks = dummyTasks;
          if (loadedEvents.length === 0) loadedEvents = dummyEvents;
          if (loadedLogs.length === 0) loadedLogs = dummyTimerLogs;
          if (loadedHabits.length === 0) loadedHabits = dummyHabits;
        } */

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
        //loadedTasks = loadedTasks.filter((t)=>!t.title.includes("testing") && !t.title.includes("Testing"))
        setTasks(loadedTasks);
        setEvents(loadedEvents);
        setTimerLogs(loadedLogs);
        setHabits(loadedHabits);
        setMessages(loadedMessages);
        setAppMetrics(loadedMetrics);
        setUnlockedAchievements(loadedUnlockedAchievements);
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

  // useEffect for maintaining optimistic updates for appMetrics
  useEffect(() => {
    appMetricsRef.current = appMetrics;
  }, [appMetrics]);

  // Keep ref in sync whenever state changes
  useEffect(() => {
    unlockedAchievementsRef.current = unlockedAchievements;
  }, [unlockedAchievements]);

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

  /*   useEffect(() => {
    if (!loaded) return;
    saveEvents(events);
    console.log(
      "DATA EVENTS",
      events.map((e) => {
        return { ...e, embedding: e.embedding?.[0] };
      }),
    );
  }, [events, loaded]); */

  /*   useEffect(() => {
    if (!loaded) return;
    saveTimerLogs(timerLogs);
    console.log("DATA LOGS", timerLogs);
  }, [timerLogs, loaded]); */

  /*   useEffect(() => {
    if (!loaded) return;
    saveHabits(habits);
     console.log(
      "DATA HABITS",
      habits.map((e) => {
        return { title: e.title, freezeHistory: typeof e.freezeHistory?.[0] };
      }),
    );
  }, [habits, loaded]); */
  /* 
  useEffect(() => {
    if (!loaded) return;
    saveAIChatHistory(messages);
    messages.map((m) => console.log(new Date(m.timestamp).toLocaleString()));
    console.log("DATA MESSAGES", messages[0]);
  }, [messages, loaded]); */

  return (
    <DataContext.Provider
      value={{
        tasks,
        setTasks,
        addTask,
        editTask,
        removeTask,
        toggleTask,
        getTask,
        getTasks,
        taskCount,
        events,
        setEvents,
        addEvent,
        editEvent,
        removeEvent,
        getEvent,
        getEvents,
        eventCount,
        timerLogs,
        setTimerLogs,
        addLog,
        editLog,
        removeLog,
        getLogs,
        logCount,
        habits,
        setHabits,
        addHabit,
        editHabit,
        removeHabit,
        getHabit,
        getHabits,
        habitCount,
        messages,
        setMessages,
        addMessage,
        editMessage,
        getMessages,
        messageCount,
        resolveItemId,
        unlockedAchievements,
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
