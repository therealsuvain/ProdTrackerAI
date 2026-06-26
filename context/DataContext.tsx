import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AchievementBadge } from "@/types/achievements";
import { AppMetrics, DefaultMetrics, GlobalMetricKey } from "@/types/metrics";

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
  trackMetric: (key: GlobalMetricKey[], amount: number) => Promise<void>;
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
    async (tagsPayload: { id: string; name: string }[]): Promise<string[]> => {
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
              // It's new: Append it
              tagIds.push(newTag.id);
              nextState.push(newTag);
            }
          }
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
    async (id: string, fallbackId?: string | null): Promise<void> => {
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

  const addCategory = useCallback(
    async (categoryPayload: {
      id: string;
      name: string;
      color: string;
      icon: string;
    }): Promise<string> => {
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
              updatedMetrics.global[key] - achievementMetrics[key],
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
      }}
    >
      {children}
      <AchievementToast badge={activeBadge} />
    </DataContext.Provider>
  );
}
