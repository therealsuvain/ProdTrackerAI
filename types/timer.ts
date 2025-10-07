export interface TimerLog {
  id: string;
  activity: string; // e.g., "Workout"
  startTime: Date;
  endTime?: Date;
  duration?: number; // In seconds
}