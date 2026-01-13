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
  goal?: number; // e.g., 7 days in a row
  notificationId?: string;
}