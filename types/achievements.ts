export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface AchievementBadge {
  id: string;          // e.g., 'first_10_tasks'
  title: string;       // e.g., 'Getting Started'
  description: string; // e.g., 'Complete your first 10 tasks.'
  tier: AchievementTier;
  target: number;      // e.g., 10
  unlockedAt: string;  // ISO Date string
}