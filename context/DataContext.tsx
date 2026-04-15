import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";

import {
  AppMetrics,
  MetricKey,
  GlobalMetricKey,
  DefaultMetrics,
} from "@/types/metrics";
import { AchievementBadge } from "@/types/achievements";

import {
  loadAppMetricsFromDb,
  loadDailyMetricsRange,
  mutateMetricInDb,
  deleteAllMetrics,
} from "@/db/repositories/metrics-repository";

import {
  getAllUnlockedAchievements,
  insertUnlockedAchievements,
  countUnlockedAchievements,
  deleteAllUnlockedAchievements,
} from "@/db/repositories/unlocked-achievement-repository";

import { sqlite } from "@/db/index";
import { processAchievements } from "@/utils/achievements-util";

import { AchievementToast } from "@/components/ui/achievements/achievement-toast";
import { usePlaySound } from "@/hooks/use-play-sound";
import { initDatabase } from "@/db";

// TODOY if achievemnt unlokec while a modal is open eg. goalCompletionModal , the achievement toast is behind overlay, bring to the top instead
interface DataContextType {
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
  appMetrics: AppMetrics;
  trackMetric: (key: GlobalMetricKey[], amount: number) => Promise<void>;
  resetMetrics: () => Promise<void>;
  resetAchievements: () => Promise<void>;
}

export const DataContext = createContext<DataContextType | undefined>(
  undefined,
);

// Feature flag for using dummy data - can be moved to environment variables or config
const USE_DUMMY_DATA = false;

export default function DataProvider({ children }: { children: ReactNode }) {
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

  const resetAchievements = useCallback(async (): Promise<void> => {
    unlockedAchievementsRef.current = [];
    (await deleteAllUnlockedAchievements(), setUnlockedAchievements([]));
  }, []);

  const resetMetrics = useCallback(async (): Promise<void> => {
    (await deleteAllMetrics(), setAppMetrics(DefaultMetrics));
  }, []);

  const unlockedAchievementCount = useCallback(async (): Promise<number> => {
    const result = await countUnlockedAchievements();
    return result ?? 0;
  }, []);


  const trackMetric = useCallback(
    
    async (keys: GlobalMetricKey[], amount: number) => {
      // 1. Mutate storage atomically
      // note: For now if lastSyncedAt is passed in it works like trackMetric(["lastSyncedAt"], 0)
      const updatedMetrics = await mutateMetricInDb(keys, amount);
      console.log("TRACK");
      // 2. Update React Context so UI (Heatmaps, Progress Bars) re-renders instantly
      setAppMetrics((prevMetrics) => ({ ...prevMetrics, ...updatedMetrics }));

      // 3. If the user advanced a metric (not undid it), check for achievements!
      if (amount > 0) {
        let localUnlocked = [...unlockedAchievementsRef.current];
        let newlyUnlocked: AchievementBadge[] = [];
        try {
          for (const key of keys) {
            if (key === "lastSyncedAt") {
              continue;
            }
            const newlyUnlockedForKey = await processAchievements(
              localUnlocked,
              updatedMetrics.global[key],
              key,
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
        /*         let loadedTasks = await getAllTasks();
        let loadedEvents = await getAllCalendarEvents();
        let loadedLogs = await getAllTimerLogs();
        let loadedHabits = await getAllHabits();
        let loadedMessages = await getAllMessages(); */
        let loadedMetrics = await loadAppMetricsFromDb();
        let loadedUnlockedAchievements = await getAllUnlockedAchievements();

        // Initialize with dummy data if enabled and no data exists
        /*         if (USE_DUMMY_DATA) {
          if (loadedTasks.length === 0) loadedTasks = dummyTasks;
          if (loadedEvents.length === 0) loadedEvents = dummyEvents;
          if (loadedLogs.length === 0) loadedLogs = dummyTimerLogs;
          if (loadedHabits.length === 0) loadedHabits = dummyHabits;
        } */

        /*         loadedHabits = loadedHabits.map((habit) => {
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
        }); */
        //loadedTasks = loadedTasks.filter((t)=>!t.title.includes("testing") && !t.title.includes("Testing"))
        /*         setTasks(loadedTasks);
        setEvents(loadedEvents);
        setTimerLogs(loadedLogs);
        setHabits(loadedHabits);
        setMessages(loadedMessages); */
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

  
  return (
    <DataContext.Provider
      value={{
        resolveItemId,
        unlockedAchievements,
        error,
        dispatchError,
        clearError,
        appMetrics,
        trackMetric,
        resetMetrics,
        resetAchievements,
      }}
    >
      {children}
      <AchievementToast badge={activeBadge} />
    </DataContext.Provider>
  );
}
