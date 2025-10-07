export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'custom';
  streak: number;
  lastCompleted?: Date;
  goal?: number; // e.g., 7 days in a row
}