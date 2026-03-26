export interface TimerLog {
  id: string;
  title: string; // e.g., "Workout"
  startTime: string;
  endTime?: string;
  duration?: number; // In seconds
  category?:string;
  laps?: number[];
  isPartial?: boolean;
}