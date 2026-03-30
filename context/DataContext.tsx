import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

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
import { processAchievements } from "@/utils/achievements-util";
import { applyMissedDayLogic, restartHabitAfterGoalForeground } from "@/utils/habit-utils";
import { cancelReminder } from "@/hooks/use-notifications";

import {
  dummyTasks,
  dummyEvents,
  dummyTimerLogs,
  dummyHabits,
} from "@/data/dummyData";

import { AchievementToast } from "@/components/ui/achievements/achievement-toast";
import { usePlaySound } from "@/hooks/use-play-sound";

interface DataContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  timerLogs: TimerLog[];
  setTimerLogs:  React.Dispatch<React.SetStateAction<TimerLog[]>>;
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
  const audioPlayer = usePlaySound(audioSource)
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

  useEffect(() => {
    const loadData = async () => {
      let loadedTasks = await loadTasks();
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
        const {status, habit:updatedHabit} = applyMissedDayLogic(habit);
        if (status === "missed_check_in") {
          trackMetric(["habitCheckInsMissed"], 1);
        }
        else if (status === "auto_frozen") {
          trackMetric(["habitsAutoFrozen"], 1);
        }
        if(habit.pendingStreakResetAfter){
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
      // mark that initial load finished so save effects don't overwrite storage during startup
      setLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveTasks(tasks);
    /* console.log(
      "DATA TASKS",
      tasks.map((e) => {
        return { ...e, embedding: e.embedding?.[0] };
      }),
    ); */
  }, [tasks, loaded]);

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
