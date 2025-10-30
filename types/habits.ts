export interface Habit {
  id: string;
  title: string;
  frequency: string;
  streak: number;
  lastCompleted?: Date;
  goal?: number; // e.g., 7 days in a row
}