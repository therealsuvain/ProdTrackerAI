import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Task } from "../types/task";
import { CalendarEvent } from "../types/calendar";
import { TimerLog } from "../types/timer";
import { Habit } from "../types/habits";
import {
  loadTasks,
  saveTasks,
  loadEvents,
  saveEvents,
  loadTimerLogs,
  saveTimerLogs,
  loadHabits,
  saveHabits,
} from "../utils/storrage-utils";
import {
  dummyTasks,
  dummyEvents,
  dummyTimerLogs,
  dummyHabits,
} from "../data/dummyData";

interface DataContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  events: CalendarEvent[];
  setEvents:  React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  timerLogs: TimerLog[];
  setTimerLogs: (timerLogs: TimerLog[]) => void;
  habits: Habit[];
  setHabits: (habits: Habit[]) => void;
  error:{
    message: string;
    type?: "warning" | "fatal";
  } | null;
  dispatchError:(err: Error | string, type: "warning" | "fatal") => void
  clearError: () => void
}

export const DataContext = createContext<DataContextType | undefined>(
  undefined
);

// Feature flag for using dummy data - can be moved to environment variables or config
const USE_DUMMY_DATA = false;

export default function DataProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
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
    []
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const loadData = async () => {
      let loadedTasks = await loadTasks();
      let loadedEvents = await loadEvents();
      let loadedLogs = await loadTimerLogs();
      let loadedHabits = await loadHabits();

      // Initialize with dummy data if enabled and no data exists
      if (USE_DUMMY_DATA) {
        if (loadedTasks.length === 0) loadedTasks = dummyTasks;
        if (loadedEvents.length === 0) loadedEvents = dummyEvents;
        if (loadedLogs.length === 0) loadedLogs = dummyTimerLogs;
        if (loadedHabits.length === 0) loadedHabits = dummyHabits;
      }

      setTasks(loadedTasks);
      setEvents(loadedEvents);
      setTimerLogs(loadedLogs);
      setHabits(loadedHabits);
      // mark that initial load finished so save effects don't overwrite storage during startup
      setLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveTasks(tasks);
  }, [tasks, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveEvents(events);
  }, [events, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveTimerLogs(timerLogs);
  }, [timerLogs, loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveHabits(habits);
  }, [habits, loaded]);

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
        error,
        dispatchError,
        clearError,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
