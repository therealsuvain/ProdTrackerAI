import {
  ALL_ACHIEVEMENTS,
  ACHIEVEMENTS_ACHIEVEMENTS, AchievementDefinition
} from '@/types/achievements-ui';
import { AchievementBadge } from '../types/achievements';
import { MetricKey } from '@/types/metrics';

export const processAchievements = async (unlocked : AchievementBadge[], metric: number, metricKey: MetricKey): Promise<AchievementBadge[]> => {
  
  const unlockedIds = new Set(unlocked.map(b => b.id));
  const newlyUnlocked: AchievementBadge[] = [];

  // 1. Find only the definitions that listen to this exact metric
  const relevantDefinitions = ALL_ACHIEVEMENTS.filter(
    (def) => def.metricTrigger === metricKey
  );
  for (const achievement of relevantDefinitions) {
    if (metric >= achievement.target && !unlockedIds.has(achievement.id)) {
      const newBadge: AchievementBadge = {
        ...achievement,
        unlockedAt: new Date().toISOString(),
      };

      unlockedIds.add(newBadge.id);
      newlyUnlocked.push(newBadge);
    }
  }
  if (newlyUnlocked.length > 0) {
    for (const metaAch of ACHIEVEMENTS_ACHIEVEMENTS) {
      if (unlockedIds.size >= metaAch.target && !unlockedIds.has(metaAch.id)) {
        const metaBadge: AchievementBadge = {
          ...metaAch,
          unlockedAt: new Date().toISOString(),
        };
        unlockedIds.add(metaBadge.id);
        newlyUnlocked.push(metaBadge);
      }
    }
  }

  return newlyUnlocked;
};