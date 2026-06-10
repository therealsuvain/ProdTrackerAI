import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { Alert, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";

import { TimerLog } from "@/types/timer";
import { useData } from "@/hooks/context-hooks/use-data";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  showNotification,
  stopNativeTimer,
  addTimerActionListener,
} from "../modules/notifications-timer";
import { useLogs } from "@/hooks/context-hooks/use-logs";

export type TimerMode = "stopwatch" | "countdown";
interface TimerContextType {
  time: number;
  isRunning: boolean;
  title: string;
  category: string;
  laps: number[];
  mode: TimerMode;
  countdownTarget: number; // seconds — what the picker set
  toggleMode: () => void; // triggers coin flip + mode switch
  setCountdownTarget: (seconds: number) => void;
  start: () => void;
  pause: () => void;
  stop: () => Promise<TimerLog | null>;
  reset: () => void;
  lap: () => void;
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;
}

export const TimerContext = createContext<TimerContextType | undefined>(
  undefined,
);

const TIMER_KEY = "timer_data";
const NOTIFICATION_ID = "timer-notification"; // Use consistent ID

export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
};

/**
 * Formats a Date or ISO string to a relative time string for display.
 * Under 24h → relative ("2 hours ago", "just now").
 * Over 24h → short date ("Mar 19, 10:30 AM").
 */
export const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

interface TimerData {
  startTimestamp: number | null;
  pausedSeconds: number;
  title: string;
  category: string;
  laps: number[];
  isRunning: boolean;
  mode: TimerMode;
  countdownTarget: number;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// TODOOptim Clean-up and document this bloated poo
export default function TimerProvider({ children }: { children: ReactNode }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [laps, setLaps] = useState<number[]>([]);
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [countdownTarget, setCountdownTarget] = useState(300); // default 5 min
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const { trackMetric } = useData();
  const { addLog } = useLogs();
  const updateIntervalRef = useRef<number | null>(null);
  //const notificationUpdateRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const zeroHitRef = useRef(false);
  const timerStateRef = useRef<TimerData>({
    startTimestamp: null,
    pausedSeconds: 0,
    title: "",
    category: "",
    laps: [],
    mode: "stopwatch",
    countdownTarget: 300,
    isRunning: false,
  });

  useEffect(() => {
    timerStateRef.current = {
      startTimestamp,
      pausedSeconds,
      title,
      category,
      laps,
      mode,
      countdownTarget,
      isRunning,
    };
  }, [
    startTimestamp,
    pausedSeconds,
    title,
    category,
    laps,
    mode,
    countdownTarget,
    isRunning,
  ]);

  useEffect(() => {
    const listeners = addTimerActionListener(
      () => {
        console.log("Notification: Pause Clicked");
        pause(); // Call your existing pause logic
      },
      () => {
        console.log("Notification: Resume Clicked");
        start(); // Call your existing resume logic
      },
      () => {
        console.log("Notification: Saved");
        stop(); // Call your existing resume logic
      },
    );

    return () => {
      listeners.forEach((listener) => listener.remove());
    };
  }, [time, isRunning, startTimestamp]);
  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Notification permissions not granted");
      }
      /* 
      // Setup notification action buttons
      await Notifications.setNotificationCategoryAsync('timer', [
        {
          identifier: 'pause',
          buttonTitle: '⏸ Pause',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'resume',
          buttonTitle: '▶ Resume',
          options: { opensAppToForeground: false },
        },
        {
          identifier: 'stop',
          buttonTitle: '⏹ Stop',
          options: { opensAppToForeground: true, isDestructive: true },
        },
      ]); */

      // Load saved timer state
      await loadTimerData();
      isInitializedRef.current = true;
    };

    init();
    /* 
    // Listen for notification button presses
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Add notif response")
        const action = response.actionIdentifier;
        if (action === 'pause') pause();
        else if (action === 'resume') resume();
        else if (action === 'stop') stop();
      }
    );
*/
    // Listen for app state changes (foreground/background)
    const appStateSubscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (nextAppState === "active") {
          // App came to foreground - recalculate time
          await loadTimerData();
        } else if (
          nextAppState === "background" ||
          nextAppState === "inactive"
        ) {
          // App went to background - save state
          await saveTimerData();
        }
      },
    );

    return () => {
      /*     notificationSubscription.remove();*/
      appStateSubscription.remove();
      cleanupIntervals();
    };
  }, []);

  // Save timer state to AsyncStorage
  const saveTimerData = async () => {
    try {
      const data: TimerData = {
        ...timerStateRef.current,
      };
      await AsyncStorage.setItem(TIMER_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save timer data:", error);
    }
  };

  // Load timer state from AsyncStorage
  const loadTimerData = async () => {
    try {
      const json = await AsyncStorage.getItem(TIMER_KEY);
      if (!json) return;

      const data: TimerData = JSON.parse(json);

      setCategory(data.category ?? "");
      setLaps(data.laps ?? []);
      setMode(data.mode ?? "stopwatch");
      setCountdownTarget(data.countdownTarget ?? 300);

      // If timer was running, recalculate elapsed time (including background time)
      if (data.isRunning && data.startTimestamp) {
        const elapsed =
          data.pausedSeconds +
          Math.floor((Date.now() - data.startTimestamp) / 1000);

        /*  console.log(
          "Recalculating time - pausedSeconds:",
          data.pausedSeconds,
          "elapsed:",
          elapsed,
        ); */

        setTime(elapsed);
        setPausedSeconds(data.pausedSeconds);
        setStartTimestamp(data.startTimestamp); // Keep original start timestamp
        setIsRunning(true);
        setTitle(data.title);
      } else if (!data.isRunning) {
        // Timer is paused, restore paused state
        setTime(data.pausedSeconds);
        setPausedSeconds(data.pausedSeconds);
        setStartTimestamp(Date.now());
        setIsRunning(false);
        setTitle(data.title);
      }
    } catch (error) {
      console.error("Failed to load timer data:", error);
    }
  };

  // Auto-save when state changes (but not on initial load)
  useEffect(() => {
    if (isInitializedRef.current) {
      saveTimerData();
    }
  }, [
    startTimestamp,
    pausedSeconds,
    title,
    category,
    laps,
    mode,
    countdownTarget,
    isRunning,
  ]);

  // Update timer display and notification when running
  useEffect(() => {
    cleanupIntervals();
    if (isRunning && startTimestamp) {
      // Update UI every 100ms for smooth display
      updateIntervalRef.current = setInterval(() => {
        const elapsed =
          pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000);
        if (mode === "countdown") {
          const remaining = countdownTarget - elapsed;

          if (remaining <= 0 && !zeroHitRef.current) {
            // Hit zero — fire alert once
            zeroHitRef.current = true;
            cleanupIntervals();
            setIsRunning(false);
            setTime(0);
            handleCountdownZero(elapsed);
          } else {
            setTime(Math.max(0, remaining));
          }
        } else {
          setTime(elapsed);
        }
      }, 100);

      // Update notification every second
      // updateNotificationNow();
      /*       notificationUpdateRef.current = setInterval(() => {
        updateNotificationNow();
      }, 1000); */
    } else if (!isRunning) {
      if (mode === "countdown") {
        const elapsed = pausedSeconds;
        setTime(Math.max(0, countdownTarget - elapsed));
      } else {
        setTime(pausedSeconds);
      }
      // cancelAllNotifications();
    }

    return cleanupIntervals;
  }, [isRunning, startTimestamp, pausedSeconds, mode, countdownTarget]);

  const cleanupIntervals = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    /*     if (notificationUpdateRef.current) {
      clearInterval(notificationUpdateRef.current);
      notificationUpdateRef.current = null;
    } */
  };

  // ── Countdown Zero Handler ────────────────────────────────────────────────

  /**
   * Called exactly once when countdown reaches 0. Shows alert asking the user
   * whether to save the completed session. Does not auto-save — user decides.
   */
  const handleCountdownZero = (finalTime: number) => {
    Alert.alert(
      "⏱ Time's Up!",
      `"${title || "Timer"}" has ended. Would you like to save this session?`,
      [
        {
          text: "Save Session",
          onPress: async () => {
            const log: TimerLog = {
              id: randomUUID(),
              title: title || "Untitled Activity",
              category: category.trim() || undefined,
              startTime: new Date(Date.now() - finalTime * 1000).toISOString(),
              endTime: new Date().toISOString(),
              duration: finalTime,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              laps: laps.length > 0 ? laps : undefined,
            };
            await addLog(log);
            trackMetric(["timeTracked"], finalTime);
            stopNativeTimer();
            resetState();
          },
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            stopNativeTimer();
            resetState();
          },
        },
      ],
      { cancelable: false }, // force a choice — no tapping outside to dismiss
    );
  };

  // ── Mode Toggle ───────────────────────────────────────────────────────────

  /**
   * Switches between stopwatch and countdown. Only allowed when not running —
   * the circle tap handler in TimerDisplay checks isRunning before calling this.
   * Resets time state so the new mode starts clean.
   */
  const toggleMode = () => {
    if (isRunning) return; // safety guard — shouldn't be callable while running
    zeroHitRef.current = false;
    setMode((prev) => (prev === "stopwatch" ? "countdown" : "stopwatch"));
    setTime(0);
    setPausedSeconds(0);
    setStartTimestamp(null);
    setLaps([]);
  };

  // Start timer
  const start = () => {
    zeroHitRef.current = false;
    const now = Date.now();
    setStartTimestamp(now);
    setPausedSeconds(
      mode === "countdown"
        ? countdownTarget - time // track elapsed, not remaining
        : time,
    );
    setIsRunning(true);

    //!FIXME
    /* showNotification(
      title || "Timer",
      now - pausedSeconds * 1000,
      true,
      pausedSeconds,
    ); */
    showNotification(
      title || "Timer",
      now - (mode === "countdown" ? countdownTarget - time : time) * 1000,
      true,
      time,
    );
  };

  /*   // Resume timer
  const resume = () => {
    const now = Date.now();
    setStartTimestamp(now); 
    setPausedSeconds(time);
    setIsRunning(true);
  };
 */
  // Pause timer
  const pause = () => {
    if (startTimestamp) {
      const elapsed =
        pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000);
      setPausedSeconds(() => elapsed);
      const displayTime =
        mode === "countdown" ? Math.max(0, countdownTarget - elapsed) : elapsed;
      setTime(displayTime);
      const now = Date.now();
      showNotification(
        title || "Timer",
        Date.now() - elapsed * 1000,
        false,
        displayTime,
      );
      //!FIXME
      /* showNotification(
        title || "Timer",
        now - pausedSeconds * 1000,
        false,
        elapsed,
      ); */
    }
    //setStartTimestamp(null);
    setIsRunning(false);
    //stopNativeTimer();
  };

  // Stop timer and save log
  const stop = async () => {
    const finalTime =
      isRunning && startTimestamp
        ? pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000)
        : pausedSeconds;
    var log: TimerLog | null = null;
    const workedTime = mode === "countdown" ? finalTime : finalTime;
    if (workedTime > 0) {
      log = {
        id: randomUUID(),
        title: title || "Untitled Activity",
        category: category.trim() || undefined,
        startTime: new Date(Date.now() - workedTime * 1000).toISOString(),
        endTime: new Date().toISOString(),
        duration: workedTime,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        laps: laps.length > 0 ? laps : undefined,
      };
      await addLog(log);
      trackMetric(["timeTracked"], workedTime);
      stopNativeTimer();
    }

    resetState();
    return log;
  };
  const resetWithConfirmation = () => {
    if (time === 0) {
      // Nothing running — silent reset is fine
      resetState();
      return;
    }

    Alert.alert(
      "Reset Timer",
      "What would you like to do with the current session?",
      [
        {
          text: "Save & Reset",
          onPress: async () => {
            // Save as partial log so the time isn't lost
            const finalTime =
              isRunning && startTimestamp
                ? pausedSeconds +
                  Math.floor((Date.now() - startTimestamp) / 1000)
                : pausedSeconds;

            if (finalTime > 0) {
              const log: TimerLog = {
                id: randomUUID(),
                title: title || "Untitled Activity",
                category: category.trim() || undefined,
                startTime: new Date(
                  Date.now() - finalTime * 1000,
                ).toISOString(),
                endTime: new Date().toISOString(),
                duration: finalTime,
                laps: laps.length > 0 ? laps : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isPartial: true, // flagged so the log item can show "(partial)"
              };
              await addLog(log);
              trackMetric(["timeTracked"], finalTime);
            }
            stopNativeTimer();
            resetState();
          },
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            stopNativeTimer();
            resetState();
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // Internal: zero out all timer state. Called by both stop() and reset paths.
  const resetState = () => {
    setTime(0);
    setTitle("");
    setCategory("");
    setLaps([]);
    setStartTimestamp(null);
    setPausedSeconds(0);
    setIsRunning(false);
    zeroHitRef.current = false;
  };

  const lap = () => {
    if (!isRunning || mode === "countdown") return;
    setLaps((prev) => [...prev, time]);
  };

  // Reset timer to zero
  /*   const reset = () => {
    setTime(0);
    setTitle("");
    setStartTimestamp(null);
    setPausedSeconds(0);
    setIsRunning(false);
    stopNativeTimer();
    //cancelAllNotifications();
  }; */

  const value: TimerContextType = {
    time,
    isRunning,
    title,
    category,
    laps,
    mode,
    countdownTarget,
    toggleMode,
    setCountdownTarget,
    start,
    pause,
    stop,
    reset: resetWithConfirmation,
    lap,
    setTitle,
    setCategory,
  };
  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
