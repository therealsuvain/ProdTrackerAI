import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AchievementBadge } from "@/types/achievements";
import {
  AppMetrics,
  DailyMetricKey,
  DailyMetrics,
  DailyMetricsWithAI,
  DefaultDailyMetrics,
  DefaultMetrics,
  GlobalMetricKey,
  GlobalMetricNums,
} from "@/types/metrics";

import {
  deleteAllMetrics,
  loadAppMetricsFromDb,
  mutateMetricInDb,
} from "@/db/repositories/metrics-repository";

import {
  countUnlockedAchievements,
  deleteAllUnlockedAchievements,
  getAllUnlockedAchievements,
  insertUnlockedAchievements,
} from "@/db/repositories/unlocked-achievement-repository";

import {
  loadAchievementMetrics,
  mutateAchievementMetricsOnReset,
} from "@/db/repositories/unlocked-achievement-metrics-repository";

import {
  getAllTags,
  deleteTag,
  deleteAllTags,
  deleteTagSafely,
  insertTags,
  updateTag,
  incrementTagCount,
  countTags,
  getTagUsageStats,
  getAllCategories,
  deleteCategorySafely,
  deleteAllCategories,
  insertCategory,
  updateCategory,
  incrementCategoryCount,
  countCategories,
  getCategoryUsage,
  seedCategoriesIfEmpty,
  reassignAndAddBackCategory,
  reassignAndAddBackTag,
  getItemIdsForTag,
} from "@/db/repositories/tags-and-category-repository";

import { AIActionMemory } from "@/utils/AI-utils/agentic-handlers/ai-action-undo-handlers";
import { sqlite } from "@/db/index";
import { processAchievements } from "@/utils/achievements-util";

import { AchievementToast } from "@/components/ui/achievements/achievement-toast";
import { initDatabase } from "@/db";
import { usePlaySound } from "@/hooks/use-play-sound";
import { AchievementMetrics } from "@/types/achievement-metrics";
import { Tag } from "@/types/tag";
import { Category } from "@/types/category";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

// TODOX if achievemnt unlokec while a modal is open eg. goalCompletionModal , the achievement toast is behind overlay, bring to the top instead
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
  achievementMetrics: AchievementMetrics;
  trackMetric: (key: GlobalMetricKey[], amount: number) => void;
  resetMetrics: () => Promise<void>;
  resetAchievements: () => Promise<void>;
  tags: Tag[];
  addTags: (tagsPayload: { id: string; name: string }[]) => Promise<string[]>;
  incrementTagUsage: (id: string) => Promise<void>;
  updateUserTag: (tag: Tag) => Promise<void>;
  deleteUserTag: (id: string, fallbackId?: string | null) => Promise<void>;
  getTagUsageForAll: (id: string) => Promise<any>;
  categories: Category[];
  addCategory: (categoryPayload: {
    id: string;
    name: string;
    color: string;
    icon: string;
  }) => Promise<string>;
  incrementCategoryUsage: (id: string) => Promise<void>;
  updateUserCategory: (category: Category) => Promise<void>;
  deleteUserCategory: (id: string, fallbackId?: string | null) => Promise<void>;
  getCategoryUsageForAll: (id: string) => Promise<any>;
  reassignDeletedTag: (
    tag: Tag,
    fallbackId: string | null,
    originalItems: Record<string, string[]>,
  ) => Promise<void>;
  reassignDeletedCategory: (
    category: Category,
    fallbackId: string | null,
    originalItems: Record<string, string[]>,
  ) => Promise<void>;
  getItemIdsForTagLocal: (id: string) => Promise<Record<string, string[]>>;
  refreshTagsCatsAchievements: () => void;
}

export const DataContext = createContext<DataContextType | undefined>(
  undefined,
);

// Feature flag for using dummy data - can be moved to environment variables or config
const USE_DUMMY_DATA = false;

export default function DataProvider({ children }: { children: ReactNode }) {
  const [appMetrics, setAppMetrics] = useState<AppMetrics>(DefaultMetrics);
  const [achievementMetrics, setAchievementMetrics] =
    useState<AchievementMetrics>(DefaultMetrics["global"]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    AchievementBadge[]
  >([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Ref for appMetric snapshot during Optimistic update
  const appMetricsRef = useRef(appMetrics);
  const unlockedAchievementsRef = useRef<AchievementBadge[]>([]);
  const [activeBadge, setActiveBadge] = useState<AchievementBadge | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<{
    message: string;
    type?: "warning" | "fatal";
  } | null>(null);
  const toastQueueRef = useRef<AchievementBadge[]>([]);
  const isToastingRef = useRef(false);
  /*   const { refreshTasks } = useTasks();
  const { refreshEvents } = useEvents();
  const { refreshHabits } = useHabits();
  const { refreshLogs } = useLogs(); */
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

  const optimisticTagMutation = useCallback(
    async (
      optimisticUpdate: (prev: Tag[]) => Tag[],
      dbWrite: () => Promise<void> | Promise<Tag>,
    ): Promise<void> => {
      let snapshot: Tag[] = [];
      setTags((prev) => {
        snapshot = prev;
        return prev;
      });
      setTags(optimisticUpdate);

      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error("[DataContext] Tag DB write failed, rolling back:", err);
        setTags(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const optimisticCategoryMutation = useCallback(
    async (
      optimisticUpdate: (prev: Category[]) => Category[],
      dbWrite: () => Promise<void> | Promise<Category>,
    ): Promise<void> => {
      let snapshot: Category[] = [];
      setCategories((prev) => {
        snapshot = prev;
        return prev;
      });
      setCategories(optimisticUpdate);

      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] Category DB write failed, rolling back:",
          err,
        );
        setCategories(snapshot);
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
    (await deleteAllUnlockedAchievements(),
      await mutateAchievementMetricsOnReset(),
      setUnlockedAchievements([]),
      setAchievementMetrics(appMetricsRef.current["global"]));
  }, []);

  const resetMetrics = useCallback(async (): Promise<void> => {
    (await deleteAllMetrics(), setAppMetrics(DefaultMetrics));
  }, []);

  const unlockedAchievementCount = useCallback(async (): Promise<number> => {
    const result = await countUnlockedAchievements();
    return result ?? 0;
  }, []);

  const addTags = useCallback(
    async (
      tagsPayload: { id: string; name: string }[],
      isFromAI?: boolean,
    ): Promise<string[]> => {
      const now = new Date().toISOString();
      const tagIds: string[] = [];
      const newTagsPayload: Tag[] = tagsPayload.map(({ id, name }) => ({
        id,
        name,
        count: 1, // Default starting count for a new tag
        createdAt: now,
        updatedAt: now,
      }));
      await optimisticTagMutation(
        (prevTags) => {
          const nextState = [...prevTags];
          const updateMetrics: GlobalMetricKey[] = [];
          for (const newTag of newTagsPayload) {
            // Check if the tag name already exists in our local state
            const existingIndex = nextState.findIndex(
              (t) => t.name === newTag.name,
            );

            if (existingIndex >= 0) {
              // It exists: Increment the local count

              tagIds.push(nextState[existingIndex].id);
              nextState[existingIndex] = {
                ...nextState[existingIndex],
                count: nextState[existingIndex].count + 1,
                updatedAt: now,
              };
            } else {
              updateMetrics.push("tagsAdded");
              // It's new: Append it
              tagIds.push(newTag.id);
              nextState.push(newTag);
            }
            updateMetrics.push("tagsAssigned");
          }
          trackMetric(updateMetrics, 1);
          if (isFromAI) trackMetric(updateMetrics, 1, "ai");
          return nextState;
        },
        () => insertTags(newTagsPayload),
      );
      return tagIds;
    },
    [optimisticTagMutation],
  );

  const incrementTagUsage = useCallback(
    async (id: string): Promise<void> => {
      await optimisticTagMutation(
        (prev) =>
          prev.map((tag) =>
            tag.id === id ? { ...tag, count: tag.count + 1 } : tag,
          ),
        () => incrementTagCount(id),
      );
    },
    [optimisticTagMutation],
  );

  const updateUserTag = useCallback(
    async (tag: Tag): Promise<void> => {
      await optimisticTagMutation(
        (prev) => prev.map((t) => (t.id === tag.id ? { ...t, ...tag } : t)),
        () => updateTag(tag),
      );
    },
    [optimisticTagMutation],
  );

  const deleteUserTag = useCallback(
    async (
      id: string,
      fallbackId?: string | null,
      isFromAI?: boolean,
    ): Promise<void> => {
      trackMetric(["tagsDeleted"], 1);
      if (isFromAI) trackMetric(["tagsDeleted"], 1, "ai");
      await optimisticTagMutation(
        (prev) => {
          const deletedTag = prev.find((t) => t.id === id);
          const deletedCount = deletedTag?.count || 0;

          return prev
            .filter((t) => t.id !== id)
            .map((t) =>
              t.id === fallbackId ? { ...t, count: t.count + deletedCount } : t,
            );
        },
        () => deleteTagSafely(id, fallbackId),
      );
    },
    [optimisticTagMutation],
  );

  const getTagUsageForAll = useCallback(async (tagId: string): Promise<any> => {
    const result = await getTagUsageStats(tagId);
    return (
      result ?? {
        tasks: 0,
        habits: 0,
        events: 0,
        logs: 0,
        total: 0,
      }
    );
  }, []);

  const getItemIdsForTagLocal = useCallback(
    async (tagId: string): Promise<Record<string, string[]>> => {
      const result = await getItemIdsForTag(tagId);
      return (
        result ?? {
          tasks: [],
          habits: [],
          events: [],
          logs: [],
        }
      );
    },
    [],
  );

  const addCategory = useCallback(
    async (
      categoryPayload: {
        id: string;
        name: string;
        color: string;
        icon: string;
      },
      isFromAI?: boolean,
    ): Promise<string> => {
      const now = new Date().toISOString();
      const { id, name, color, icon } = categoryPayload;
      const category: Category = {
        id,
        name,
        color,
        icon,
        count: 0,
        createdAt: now,
        updatedAt: now,
      };
      trackMetric(["categoriesAdded"], 1);
      if (isFromAI) trackMetric(["categoriesAdded"], 1, "ai");
      await optimisticCategoryMutation(
        (prev) => [...prev, category],
        () => insertCategory(category),
      );
      return id;
    },
    [optimisticCategoryMutation],
  );
  const incrementCategoryUsage = useCallback(
    async (id: string): Promise<void> => {
      await optimisticCategoryMutation(
        (prev) =>
          prev.map((category) =>
            category.id === id
              ? {
                  ...category,
                  count: category.count + 1,
                  updatedAt: new Date().toISOString(),
                }
              : category,
          ),
        () => incrementCategoryCount(id),
      );
    },
    [optimisticCategoryMutation],
  );

  const updateUserCategory = useCallback(
    async (category: Category): Promise<void> => {
      await optimisticCategoryMutation(
        (prev) =>
          prev.map((cat) =>
            cat.id === category.id ? { ...cat, ...category } : cat,
          ),
        () => updateCategory(category),
      );
    },
    [optimisticCategoryMutation],
  );

  const deleteUserCategory = useCallback(
    async (id: string, fallbackId?: string | null): Promise<void> => {
      await optimisticCategoryMutation(
        (prev) => {
          const deletedCat = prev.find((c) => c.id === id);
          const deletedCount = deletedCat?.count || 0;

          return prev
            .filter((c) => c.id !== id) // Remove the old
            .map((c) =>
              c.id === fallbackId
                ? { ...c, count: c.count + deletedCount } // Add the counts safely
                : c,
            );
          /* prev.filter((category) => category.id !== id) */
        },
        () => deleteCategorySafely(id, fallbackId),
      );
    },
    [optimisticCategoryMutation],
  );

  const getCategoryUsageForAll = useCallback(
    async (categoryId: string): Promise<any> => {
      const result = await getCategoryUsage(categoryId);
      return (
        result ?? {
          tasks: 0,
          habits: 0,
          events: 0,
          logs: 0,
          total: 0,
        }
      );
    },
    [],
  );

  const processToastQueue = useCallback(() => {
    // If already playing a badge, or queue is empty, do nothing.
    if (isToastingRef.current || toastQueueRef.current.length === 0) return;

    isToastingRef.current = true;
    const badge = toastQueueRef.current.shift(); // Dequeue

    if (badge) {
      setActiveBadge(badge);
      audioPlayer.seekTo(0);
      audioPlayer.play();

      setTimeout(() => {
        setActiveBadge(null);
        setTimeout(() => {
          isToastingRef.current = false; // Release the lock
          processToastQueue(); // Recursively check for next badge in queue
        }, 500); // 500ms gap between consecutive badges
      }, 6000); // 6s display duration
    }
  }, []);

  useEffect(() => {
    const handleMetricTrack = async ({
      keys,
      amount,
      actor = "user",
    }: {
      keys: GlobalMetricKey[];
      amount: number;
      actor?: "user" | "ai";
    }) => {
      console.log(
        `[EventBus] Caught metric:track -> Keys: ${keys}, Amount: ${amount}`,
      );
      // ── 1. Optimistic UI Update (Using your robust deep-copy logic) ──
      setAppMetrics((prevMetrics) => {
        const today = new Date().toISOString().split("T")[0];

        const nextGlobal = { ...prevMetrics.global };
        const nextTodayEntry: DailyMetricsWithAI = prevMetrics.daily[today]
          ? { ...prevMetrics.daily[today] }
          : { ...DefaultDailyMetrics };

        for (const key of keys) {
          // Global
          const globalKey = key as GlobalMetricKey;
          if (actor === "ai") {
            if (
              globalKey in nextGlobal.aiMetrics &&
              globalKey !== "syncedAt" &&
              globalKey !== "aiMetrics"
            ) {
              nextGlobal.aiMetrics[globalKey] = Math.max(
                0,
                (nextGlobal.aiMetrics[globalKey] as number) + amount,
              );
            }
          } else {
            if (
              globalKey in nextGlobal &&
              globalKey !== "syncedAt" &&
              globalKey !== "aiMetrics"
            ) {
              nextGlobal[globalKey] = Math.max(
                0,
                (nextGlobal[globalKey] as number) + amount,
              );
            }
          }

          // Daily
          const dailyKey = key as DailyMetricKey;
          if (actor === "ai") {
            if (dailyKey in nextTodayEntry.aiMetrics) {
              nextTodayEntry[dailyKey] = Math.max(
                0,
                (nextTodayEntry[dailyKey] as number) + amount,
              );
            }
          } else {
            if (dailyKey in nextTodayEntry) {
              nextTodayEntry[dailyKey] = Math.max(
                0,
                (nextTodayEntry[dailyKey] as number) + amount,
              );
            }
          }
        }

        return {
          ...prevMetrics,
          global: nextGlobal,
          daily: {
            ...prevMetrics.daily,
            [today]: nextTodayEntry,
          },
        };
      });

      // ── 2. Achievement Evaluation ──
      // If it's a negative amount (undo action), we don't grant achievements
      if (amount <= 0) return;

      let localUnlocked = [...unlockedAchievementsRef.current];
      let newlyUnlocked: AchievementBadge[] = [];
      const currentGlobal = appMetricsRef.current.global;

      try {
        for (const key of keys) {
          if (key === "syncedAt" || key === "aiMetrics") {
            continue;
          }
          const optimisticNewValue = currentGlobal[key] + amount;
          const newlyUnlockedForKey = await processAchievements(
            localUnlocked,
            optimisticNewValue - achievementMetrics[key],
            key,
          );

          for (const badge of newlyUnlockedForKey) {
            await addUnlockedAchievement(badge);
            localUnlocked.push(badge);
          }
          newlyUnlocked = newlyUnlocked.concat(newlyUnlockedForKey);
        }

        // ── 3. Queue the Toasts safely ──
        if (newlyUnlocked.length > 0) {
          unlockedAchievementsRef.current = localUnlocked;
          toastQueueRef.current.push(...newlyUnlocked);
          processToastQueue(); // Kickstart the queue
        }
      } catch (err) {
        console.error("Error evaluating achievements:", err);
      }
    };

    // Subscribe directly to the precise UI actions
    metricsEventBus.on("metric:track", handleMetricTrack);

    return () => {
      metricsEventBus.off("metric:track", handleMetricTrack);
    };
  }, [processToastQueue]);

  // Your trackMetric function becomes just a mitt emit!
  const trackMetric = useCallback(
    (keys: GlobalMetricKey[], amount: number, actor?: "user" | "ai") => {
      metricsEventBus.emit("metric:track", { keys, amount, actor });
    },
    [],
  );

  // Initialize and load data
  const refreshTagsCatsAchievements = useCallback(async () => {
    try {
      await initDatabase();
      await seedCategoriesIfEmpty();
      let loadedMetrics = await loadAppMetricsFromDb();
      let loadedAchievementMetrics = await loadAchievementMetrics();
      let loadedUnlockedAchievements = await getAllUnlockedAchievements();
      let loadedTags = await getAllTags();
      let loadedCategories = await getAllCategories();
      await AIActionMemory.init();
      setAppMetrics(loadedMetrics);
      setAchievementMetrics(loadedAchievementMetrics);
      setUnlockedAchievements(loadedUnlockedAchievements);
      setTags(loadedTags);
      setCategories(loadedCategories);
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
  }, [dispatchError]);

  const transactionalAppMutation = useCallback(
    async (dbWrite: () => Promise<void>): Promise<void> => {
      try {
        await dbWrite();
        await Promise.all([
          /* refreshTasks(),
          refreshHabits(),
          refreshEvents(),
          refreshLogs(), */
          refreshTagsCatsAchievements(),
        ]);
      } catch (err) {
        // 4. Rollback
        console.error("[DataContext] Tag DB write failed, rolling back:", err);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [
      /* refreshTasks,
      refreshHabits,
      refreshEvents,
      refreshLogs, */
      refreshTagsCatsAchievements,
    ],
  );

  const reassignDeletedCategory = useCallback(
    async (
      category: Category,
      fallbackId: string | null,
      originalItems: Record<string, string[]>,
    ): Promise<void> => {
      await transactionalAppMutation(() =>
        reassignAndAddBackCategory(category, fallbackId, originalItems),
      );
    },
    [transactionalAppMutation],
  );

  const reassignDeletedTag = useCallback(
    async (
      tag: Tag,
      fallbackId: string | null,
      originalItems: Record<string, string[]>,
    ): Promise<void> => {
      await transactionalAppMutation(() =>
        reassignAndAddBackTag(tag, fallbackId, originalItems),
      );
    },
    [transactionalAppMutation],
  );

  const getDateRangeArray = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const densifyDailyMetrics = (
    sparse: Record<string, DailyMetricsWithAI>,
    earliestDate: string,
    latestDate: string,
  ): Record<string, DailyMetricsWithAI> => {
    const allDates = getDateRangeArray(earliestDate, latestDate);
    const dense: Record<string, DailyMetricsWithAI> = {};
    for (const date of allDates) {
      dense[date] = sparse[date] ?? { ...DefaultDailyMetrics, date };
    }
    return dense;
  };

  const denseDaily = useMemo(() => {
    const dates = Object.keys(appMetrics.daily);
    if (dates.length === 0) return {};
    const earliest = dates.sort()[0];
    const today = new Date().toISOString().split("T")[0];
    return densifyDailyMetrics(appMetrics.daily, earliest, today);
  }, [appMetrics.daily]);
  // useEffect for maintaining optimistic updates for appMetrics
  useEffect(() => {
    refreshTagsCatsAchievements();
  }, []);

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
        achievementMetrics,
        trackMetric,
        resetMetrics,
        resetAchievements,
        tags,
        addTags,
        incrementTagUsage,
        updateUserTag,
        deleteUserTag,
        getTagUsageForAll,
        categories,
        addCategory,
        incrementCategoryUsage,
        updateUserCategory,
        deleteUserCategory,
        getCategoryUsageForAll,
        reassignDeletedTag,
        reassignDeletedCategory,
        getItemIdsForTagLocal,
        refreshTagsCatsAchievements,
      }}
    >
      {children}
      <AchievementToast badge={activeBadge} />
    </DataContext.Provider>
  );
}
