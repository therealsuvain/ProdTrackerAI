export interface TimerLog {
  id: string;
  title: string; // e.g., "Workout"
  startTime: Date;
  endTime?: Date;
  duration?: number; // In seconds
}