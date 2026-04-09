export interface DailyMetrics {
  tasksCompleted: number;
  habitsCheckedIn: number;
  habitsGoalsCompleted: number;
  habitsStreakMax: number; // Current longest streak for checking in  in any habit a day //!!! How to do if all habits are weekly
  habitsFrozen: number;
  timeTracked: number; // in minutes
  chatMessagesSent: number;
  chatActionsConfirmed: number;
  chatActionsExpired: number;
  chatActionsCancelled: number;
}

export interface AppMetrics {
  // O(1) lookup for Achievements (Engine uses this)
  global: {
    tasksCompleted: number;
    tasksMissed: number;
    habitsCheckedIn: number;
    habitsGoalsCompleted: number;
    habitCheckInsMissed: number; 
    habitsStreakMax: number;  // Longest Streak ever for checking in  in any habit //TODOX 48
    habitsFrozen: number;
    habitsAutoFrozen: number;
    timeTracked: number;
    chatMessagesSent: number;
    chatActionsConfirmed: number;
    chatActionsExpired: number;
    chatActionsCancelled: number;
    lastSyncedAt?: string;
  };
  // O(1) lookup for Heatmaps (UI uses this)
  daily: {
    [daily: string]: DailyMetrics; // Keyed by 'YYYY-MM-DD'
  };
}

export const DefaultMetrics: AppMetrics = {
  global: {
    tasksCompleted: 0, tasksMissed: 0, habitsCheckedIn: 0,
    habitsGoalsCompleted: 0, habitCheckInsMissed: 0, habitsStreakMax: 0, habitsFrozen: 0,
    habitsAutoFrozen: 0, timeTracked: 0, chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0,
    chatActionsCancelled: 0
  },
  daily: {}
};
export type MetricKey = keyof DailyMetrics | keyof AppMetrics['global'];
export type GlobalMetricKey = keyof AppMetrics['global'];
export type DailyMetricKey = keyof DailyMetrics;