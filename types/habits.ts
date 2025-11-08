export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  reminder : boolean;
  reminderDate? : Date;
  lastCompleted?: Date;
  goal?: number; // e.g., 7 days in a row
  notificationId?: string;
}