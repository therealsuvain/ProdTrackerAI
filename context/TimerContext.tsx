import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { randomUUID } from "expo-crypto";

import { TimerLog } from "@/types/timer";
import { useData } from "@/hooks/use-data";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  showNotification,
  stopNativeTimer,
  addTimerActionListener,
} from "../modules/notifications-timer";

interface TimerContextType {
  time: number;
  isRunning: boolean;
  title: string;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  setTitle: (title: string) => void;
}

export const TimerContext = createContext<TimerContextType | undefined>(
  undefined,
);

const TIMER_KEY = "timer_data";
const NOTIFICATION_ID = "timer-notification"; // Use consistent ID

interface TimerData {
  startTimestamp: number | null;
  pausedSeconds: number;
  title: string;
  isRunning: boolean;
}

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export default function TimerProvider({ children }: { children: ReactNode }) {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [title, setTitle] = useState("");
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const { timerLogs, setTimerLogs, trackMetric } = useData();
  const updateIntervalRef = useRef<number | null>(null);
  //const notificationUpdateRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const timerStateRef = useRef<TimerData>({
    startTimestamp: null,
    pausedSeconds: 0,
    title: "",
    isRunning: false,
  });

  useEffect(() => {
    timerStateRef.current = {
      startTimestamp,
      pausedSeconds,
      title,
      isRunning,
    };
  }, [startTimestamp, pausedSeconds, title, isRunning]);

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

      // If timer was running, recalculate elapsed time (including background time)
      if (data.isRunning && data.startTimestamp) {
        const elapsed =
          data.pausedSeconds +
          Math.floor((Date.now() - data.startTimestamp) / 1000);

        console.log(
          "Recalculating time - pausedSeconds:",
          data.pausedSeconds,
          "elapsed:",
          elapsed,
        );

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
  }, [startTimestamp, pausedSeconds, title, isRunning]);

  // Update timer display and notification when running
  useEffect(() => {
    cleanupIntervals();
    if (isRunning && startTimestamp) {
      // Update UI every 100ms for smooth display
      updateIntervalRef.current = setInterval(() => {
        const elapsed =
          pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000);
        setTime(elapsed);
      }, 100);

      // Update notification every second
      // updateNotificationNow();
      /*       notificationUpdateRef.current = setInterval(() => {
        updateNotificationNow();
      }, 1000); */
    } else if (!isRunning) {
      setTime(pausedSeconds);
      // cancelAllNotifications();
    }

    return cleanupIntervals;
  }, [isRunning, startTimestamp, pausedSeconds, title]);

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

  // Format seconds to HH:MM:SS
  /*   const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Update notification with current time (reuses same notification)
  const updateNotificationNow = async () => {
    try {
      const currentTime = startTimestamp
        ? pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000)
        : pausedSeconds;

      // Use setNotificationChannelAsync to update existing notification on Android
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'Timer Running',
          body: formatTime(currentTime),
          data: { type: 'timer', elapsed: currentTime },
          sticky: true,
          categoryIdentifier: 'timer',
          priority: Notifications.AndroidNotificationPriority.MAX,
          sound: undefined,
        },
        trigger: null,
        identifier: NOTIFICATION_ID, // Use same identifier to update, not create new
      });
    } catch (error) {
      console.error('Failed to update notification:', error);
    }
  };

  // Cancel all timer notifications
  const cancelAllNotifications = async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
      await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }; */

  // Start timer
  const start = () => {
    const now = Date.now();
    setStartTimestamp(now);
    setPausedSeconds(time);
    setIsRunning(true);
    showNotification(
      title || "Timer",
      now - pausedSeconds * 1000,
      true,
      pausedSeconds,
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
      setTime(elapsed);
      const now = Date.now();
      showNotification(
        title || "Timer",
        now - pausedSeconds * 1000,
        false,
        elapsed,
      );
    }
    //setStartTimestamp(null);
    setIsRunning(false);
    //stopNativeTimer();
  };

  // Stop timer and save log
  const stop = () => {
    const finalTime =
      isRunning && startTimestamp
        ? pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000)
        : pausedSeconds;

    if (finalTime > 0) {
      const log: TimerLog = {
        id: randomUUID(),
        title: title || "Untitled Activity",
        startTime: new Date(Date.now() - finalTime * 1000),
        endTime: new Date(),
        duration: finalTime,
      };
      setTimerLogs([...timerLogs, log]);
      trackMetric(["timeTracked"], finalTime);
      stopNativeTimer();
    }

    reset();
  };

  // Reset timer to zero
  const reset = () => {
    setTime(0);
    setTitle("");
    setStartTimestamp(null);
    setPausedSeconds(0);
    setIsRunning(false);
    stopNativeTimer();
    //cancelAllNotifications();
  };

  const value: TimerContextType = {
    time,
    isRunning,
    title,
    start,
    pause,
    stop,
    reset,
    setTitle,
  };
  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
