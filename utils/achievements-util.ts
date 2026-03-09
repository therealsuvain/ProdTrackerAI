import {
  TASK_ACHIEVEMENTS, HABIT_ACHIEVEMENTS,
  TIMER_ACHIEVEMENTS,
  ACHIEVEMENTS_ACHIEVEMENTS, AchievementDefinition
} from '@/types/achievements-ui';
import { getUnlockedAchievements, saveUnlockedAchievement } from '@/utils/storage-utils';
import { AchievementBadge } from '../types/achievements';

/**
 * Evaluates if new achievements have been met based on the total completed metric.
 * @param totalCompleted The current count of completed items (e.g., tasks).
 * @returns An array of newly unlocked achievements to be fed to a toast/notification.
 */
// utils/achievement-engine.ts


/**
 * CORE ENGINE: The single source of truth for evaluating any metric against any config.
 * By keeping this generic, we strictly adhere to DRY principles.
 */
const evaluateCategory = async (
  metric: number,
  definitions: AchievementDefinition[],
  unlockedIds: Set<string>
): Promise<AchievementBadge[]> => {
  const newlyUnlocked: AchievementBadge[] = [];

  for (const achievement of definitions) {
    if (metric >= achievement.target && !unlockedIds.has(achievement.id)) {
      const newBadge: AchievementBadge = {
        ...achievement,
        unlockedAt: new Date().toISOString(),
      };

      await saveUnlockedAchievement(newBadge);
      unlockedIds.add(newBadge.id); // Update the Set immediately to prevent duplicate reads
      newlyUnlocked.push(newBadge);
    }
  }

  return newlyUnlocked;
};

/**
 * META ENGINE: Checks if the user has unlocked enough badges to earn a meta-badge.
 */
const evaluateMetaAchievements = async (unlockedIds: Set<string>): Promise<AchievementBadge[]> => {
  // The "metric" for meta-achievements is simply the size of the unlocked IDs set
  return evaluateCategory(unlockedIds.size, ACHIEVEMENTS_ACHIEVEMENTS, unlockedIds);
};

// --- PUBLIC WRAPPERS ---
// These are the functions you will actually call from your DataContext or UI components.

export const processTaskAchievements = async (totalTasks: number): Promise<AchievementBadge[]> => {
  const unlocked = await getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(b => b.id));

  const newBadges = await evaluateCategory(totalTasks, TASK_ACHIEVEMENTS, unlockedIds);

  // If we unlocked a task badge, we must check if that triggered a meta-badge
  if (newBadges.length > 0) {
    const metaBadges = await evaluateMetaAchievements(unlockedIds);
    return [...newBadges, ...metaBadges];
  }

  return [];
};

export const processHabitAchievements = async (totalHabitCompletions: number): Promise<AchievementBadge[]> => {
  const unlocked = await getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(b => b.id));

  const newBadges = await evaluateCategory(totalHabitCompletions, HABIT_ACHIEVEMENTS, unlockedIds);

  if (newBadges.length > 0) {
    const metaBadges = await evaluateMetaAchievements(unlockedIds);
    return [...newBadges, ...metaBadges];
  }

  return [];
};

export const processTimerAchievements = async (totalMinutesLogged: number): Promise<AchievementBadge[]> => {
  const unlocked = await getUnlockedAchievements();
  const unlockedIds = new Set(unlocked.map(b => b.id));

  const newBadges = await evaluateCategory(totalMinutesLogged, TIMER_ACHIEVEMENTS, unlockedIds);

  if (newBadges.length > 0) {
    const metaBadges = await evaluateMetaAchievements(unlockedIds);
    return [...newBadges, ...metaBadges];
  }

  return [];
};