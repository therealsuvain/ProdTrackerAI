//TODO feeback for habits goal reach and restart option via the Chat
export interface DailyMetrics {
  tasksAdded: number;
  tasksCompleted: number;
  tasksAbandoned: number; //Deleted before completion
  tasksMissed: number; //Tasks that went overdue //TODO
  tasksDeleted: number; // Counts task deleted in any state
  habitsAdded: number;
  habitsWithWeeklyGoals: number;
  habitsWithDailyGoals: number;
  habitsAbandoned: number;
  habitsCheckedIn: number;
  habitsCheckedInBefore8am: number;
  habitsCheckedInAfter10pm : number;
  habitsGoalsCompleted: number;
  habitGoalsRestarted: number; //Habits restarted after completion
  habitCheckInsMissed: number;
  habitsStreakMaxDaily: number; // Current longest streak for checking in  in any habit a day 
  habitsStreakMaxWeekly: number; // Current longest streak for checking in  in any habit a week
  habitsFrozen: number;
  habitsAutoFrozen: number;
  habitsDeleted: number;
  eventsAdded: number;
  eventsDeleted: number;
  eventsEarlymorning: number; // Count of events with time btw 5am and 9am 
  eventsLatenight: number; // Count of events with time btw 8pm and 12am
  eventsOvernight: number; // Count of events with time that includes or after 12am
  eventsDaily: number;
  eventsWeekly: number;
  eventsSingleton: number; //Event with just one date
  eventsInfinite: number; //Event with recurrence 'daily' or 'weekly' without endDate
  timeTracked: number; // in minutes
  chatMessagesSent: number;
  chatActionsConfirmed: number;
  chatActionsExpired: number;
  chatActionsCancelled: number;
  tagsAdded: number;
  tagsAssigned: number;
  tagsDeleted: number;
  categoriesAdded: number;
  categoriesAssigned: number;
  categoriesDeleted: number;
  logsAdded: number;
  logsDeleted: number;
  tasksEdited: number;
  habitsEdited: number;
  eventsEdited: number;
  logsEdited: number;
  tagsEdited: number;
  categoriesEdited: number;
  //tag related metrics
  //category related metrics
  //timer logs related metrics
  //other metrics
}

export interface DailyMetricsWithAI extends DailyMetrics {
  aiMetrics: DailyMetrics;
}
export interface AppMetrics {
  // O(1) lookup for Achievements (Engine uses this)
  global: {
    tasksAdded: number;
    tasksCompleted: number;
    tasksAbandoned: number;
    tasksMissed: number;
    tasksDeleted: number;
    habitsAdded: number;
    habitsWithWeeklyGoals: number;
    habitsWithDailyGoals: number;
    habitsAbandoned: number;
    habitsCheckedIn: number;
    habitsCheckedInBefore8am: number;
    habitsCheckedInAfter10pm : number;
    habitsGoalsCompleted: number;
    habitGoalsRestarted: number;
    habitCheckInsMissed: number;
    habitsStreakMaxDaily: number;  // Longest Streak ever for checking in  in any habit //TODOX 48
    habitsStreakMaxWeekly: number;
    habitsFrozen: number;
    habitsAutoFrozen: number;
    habitsDeleted: number;
    eventsAdded: number;
    eventsDeleted: number;
    eventsEarlymorning: number; // Count of events with time btw 5am and 9am 
    eventsLatenight: number; // Count of events with time btw 8pm and 12am
    eventsOvernight: number; // Count of events with time that includes or after 12am
    eventsDaily: number;
    eventsWeekly: number;
    eventsSingleton: number; //Event with just one date
    eventsInfinite: number; //Event with recurrence 'daily' or 'weekly' without endDate
    timeTracked: number;
    chatMessagesSent: number;
    chatActionsConfirmed: number;
    chatActionsExpired: number;
    chatActionsCancelled: number;
    tagsAdded: number;
    tagsAssigned: number;
    tagsDeleted: number;
    categoriesAdded: number;
    categoriesAssigned: number;
    categoriesDeleted: number;
    logsAdded: number;
    logsDeleted: number;
    tasksEdited: number;
    habitsEdited: number;
    eventsEdited: number;
    logsEdited: number;
    tagsEdited: number;
    categoriesEdited: number;
    aiMetrics: DailyMetrics;
    lastSyncedAt?: string;
  };
  // O(1) lookup for Heatmaps (UI uses this)
  daily: {
    [daily: string]: DailyMetricsWithAI; // Keyed by 'YYYY-MM-DD'
  };
}

export const DefaultMetrics: AppMetrics = {
  global: {
    tasksAdded: 0, tasksCompleted: 0, tasksAbandoned: 0, tasksMissed: 0, tasksDeleted: 0,
    habitsAdded: 0, habitsWithWeeklyGoals: 0, habitsWithDailyGoals: 0, habitsAbandoned: 0, 
    habitsCheckedIn: 0, habitsCheckedInBefore8am: 0, habitsCheckedInAfter10pm : 0, habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0, habitCheckInsMissed: 0, habitsStreakMaxDaily: 0, habitsStreakMaxWeekly: 0, habitsFrozen: 0, habitsAutoFrozen: 0, habitsDeleted: 0,
    eventsAdded: 0, eventsDeleted: 0, eventsEarlymorning: 0, eventsLatenight: 0, eventsOvernight: 0,
    eventsDaily: 0, eventsWeekly: 0, eventsSingleton: 0, eventsInfinite: 0,
    timeTracked: 0,
    chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0, chatActionsCancelled: 0,
    tagsAdded: 0, tagsAssigned: 0, tagsDeleted: 0,
    categoriesAdded: 0, categoriesAssigned: 0, categoriesDeleted: 0,
    logsAdded: 0, logsDeleted: 0,
    tasksEdited: 0, habitsEdited: 0, eventsEdited: 0, logsEdited: 0, tagsEdited: 0, categoriesEdited: 0,

    aiMetrics: {
      tasksAdded: 0, tasksCompleted: 0, tasksAbandoned: 0, tasksMissed: 0, tasksDeleted: 0,
    habitsAdded: 0, habitsWithWeeklyGoals: 0, habitsWithDailyGoals: 0, habitsAbandoned: 0, 
    habitsCheckedIn: 0, habitsCheckedInBefore8am: 0, habitsCheckedInAfter10pm : 0, habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0, habitCheckInsMissed: 0, habitsStreakMaxDaily: 0, habitsStreakMaxWeekly: 0, habitsFrozen: 0, habitsAutoFrozen: 0, habitsDeleted: 0,
    eventsAdded: 0, eventsDeleted: 0, eventsEarlymorning: 0, eventsLatenight: 0, eventsOvernight: 0,
    eventsDaily: 0, eventsWeekly: 0, eventsSingleton: 0, eventsInfinite: 0,
    timeTracked: 0,
    chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0, chatActionsCancelled: 0,
    tagsAdded: 0, tagsAssigned: 0, tagsDeleted: 0,
    categoriesAdded: 0, categoriesAssigned: 0, categoriesDeleted: 0,
    logsAdded: 0, logsDeleted: 0,
    tasksEdited: 0, habitsEdited: 0, eventsEdited: 0, logsEdited: 0, tagsEdited: 0, categoriesEdited: 0,
  }
  },
  daily: {}
};
export const DefaultDailyMetrics: DailyMetricsWithAI = {
  tasksAdded: 0, tasksCompleted: 0, tasksAbandoned: 0, tasksMissed: 0, tasksDeleted: 0,
  habitsAdded: 0, habitsWithWeeklyGoals: 0, habitsWithDailyGoals: 0, habitsAbandoned: 0,
  habitsCheckedIn: 0, habitsCheckedInAfter10pm : 0, habitsCheckedInBefore8am: 0, habitsGoalsCompleted: 0, habitGoalsRestarted: 0, habitCheckInsMissed: 0,
  habitsStreakMaxDaily: 0, habitsStreakMaxWeekly: 0, habitsFrozen: 0, habitsAutoFrozen: 0, habitsDeleted: 0,
  eventsAdded: 0, eventsDeleted: 0, eventsEarlymorning: 0, eventsLatenight: 0,
  eventsOvernight: 0, eventsDaily: 0, eventsWeekly: 0, eventsSingleton: 0, eventsInfinite: 0,
  timeTracked: 0,
  chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0, chatActionsCancelled: 0,
  tagsAdded: 0, tagsAssigned: 0, tagsDeleted: 0,
  categoriesAdded: 0, categoriesAssigned: 0, categoriesDeleted: 0,
  logsAdded: 0, logsDeleted: 0,
  tasksEdited: 0, habitsEdited: 0, eventsEdited: 0, logsEdited: 0, tagsEdited: 0, categoriesEdited: 0
  ,
  aiMetrics: {
      tasksAdded: 0, tasksCompleted: 0, tasksAbandoned: 0, tasksMissed: 0, tasksDeleted: 0,
    habitsAdded: 0, habitsWithWeeklyGoals: 0, habitsWithDailyGoals: 0, habitsAbandoned: 0, 
    habitsCheckedIn: 0, habitsCheckedInBefore8am: 0, habitsCheckedInAfter10pm : 0, habitsGoalsCompleted: 0,
    habitGoalsRestarted: 0, habitCheckInsMissed: 0, habitsStreakMaxDaily: 0, habitsStreakMaxWeekly: 0, habitsFrozen: 0, habitsAutoFrozen: 0, habitsDeleted: 0,
    eventsAdded: 0, eventsDeleted: 0, eventsEarlymorning: 0, eventsLatenight: 0, eventsOvernight: 0,
    eventsDaily: 0, eventsWeekly: 0, eventsSingleton: 0, eventsInfinite: 0,
    timeTracked: 0,
    chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0, chatActionsCancelled: 0,
    tagsAdded: 0, tagsAssigned: 0, tagsDeleted: 0,
    categoriesAdded: 0, categoriesAssigned: 0, categoriesDeleted: 0,
    logsAdded: 0, logsDeleted: 0,
    tasksEdited: 0, habitsEdited: 0, eventsEdited: 0, logsEdited: 0, tagsEdited: 0, categoriesEdited: 0,
  }
};
export type MetricKey = keyof DailyMetrics | keyof AppMetrics['global'];
export type GlobalMetricKey = keyof AppMetrics['global'];
export type GlobalMetricKeyWithoutAI = keyof Omit<AppMetrics['global'], 'aiMetrics'>;
export type GlobalMetricNums = keyof Omit<AppMetrics['global'], 'lastSyncedAt'| 'aiMetrics'>;
export type DailyMetricKey = keyof DailyMetrics;