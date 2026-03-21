export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  reminder : boolean;
  reminderDate? : Date;
  targetDays?: number[]; 
  streak: number;
  history: string[]; 
  streakFreezes: number; // Number of "skips" available
  longestStreak: number; 
  freezeHistory?: string[];
  isArchived: boolean;
  goal: number; // e.g., 7 days in a row
  goalCompletions: GoalCompletion[]; // Track when goals are completed
  pendingStreakResetAfter?: string;
  notificationId?: string;
  embedding?:number[]; // For Semantic Search
}
export interface GoalCompletion {
  completedAt: string; // ISO timestamp of when goal was reached
  goal: number;        // the goal value at time of completion (user may edit goal later)
}