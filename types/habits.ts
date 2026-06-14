export interface Habit {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  reminder: boolean;
  reminderDate?: string;
  targetDays?: number[];
  streak: number;
  history: string[];
  streakFreezes: number; // Number of "skips" available
  longestStreak: number;
  freezeHistory?: string[];
  goal: number; // e.g., 7 days in a row
  goalCompletions: GoalCompletion[]; // Track when goals are completed
  pendingStreakResetAfter?: string;
  notificationId?: string;
  createdAt: string;                 // ISO 8601 — set once, never mutated
  updatedAt: string;                 // ISO 8601 — updated on every save 
  category?: string;
  tags?: string[];
  embedding?: number[]; // For Semantic Search
}
export interface GoalCompletion {
  completedAt: string; // ISO timestamp of when goal was reached
  goal: number;        // the goal value at time of completion (user may edit goal later)
}