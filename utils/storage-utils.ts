// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsConfig, defaultSettings } from '@/types/settings';

const SETTINGS_KEY = '@prodtracker_settings';
/* const ACHIEVEMENTS_KEY = '@prodtracker_achievements';
const METRICS_KEY = '@prodtracker_metrics';

// Helper to handle JSON serialization (Dates need conversion)
const stringify = (data: any) => JSON.stringify(data, (_key, value) =>
  value instanceof Date ? value.toISOString() : value
);

//TODO 49 useless func below, returning same value, was being used when dates were being rehydrated
const parse = (json: string) => JSON.parse(json, (_key, value) =>
  typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/) ? value : value
); */

export const loadSettings = async (): Promise<SettingsConfig> => {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultSettings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = async (settings: SettingsConfig): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

/* // Tasks
export const saveTasks = async (tasks: Task[]) => {
  try {
    await AsyncStorage.setItem('tasks', stringify(tasks));
  } catch (e) {
    console.error('Error saving tasks:', e);
  }
};

export const loadTasks = async (): Promise<Task[]> => {
  try {
    const json = await AsyncStorage.getItem('tasks');
    return json ? parse(json) : [];
  } catch (e) {
    console.error('Error loading tasks:', e);
    return [];
  }
};

// Calendar Events (repeat pattern for others)
export const saveEvents = async (events: CalendarEvent[]) => {
  try {
    await AsyncStorage.setItem('events', stringify(events));
  } catch (e) {
    console.error('Error saving events:', e);
  }
};

export const loadEvents = async (): Promise<CalendarEvent[]> => {
  try {
    const json = await AsyncStorage.getItem('events');
    return json ? parse(json) : [];
  } catch (e) {
    console.error('Error loading events:', e);
    return [];
  }
};

// Timer Logs
export const saveTimerLogs = async (logs: TimerLog[]) => {
  try {
    await AsyncStorage.setItem('timerLogs', stringify(logs));
  } catch (e) {
    console.error('Error saving timer logs:', e);
  }
};

export const loadTimerLogs = async (): Promise<TimerLog[]> => {
  try {
    const json = await AsyncStorage.getItem('timerLogs');
    return json ? parse(json) : [];
  } catch (e) {
    console.error('Error loading timer logs:', e);
    return [];
  }
};

// Habits
export const saveHabits = async (habits: Habit[]) => {
  try {
    await AsyncStorage.setItem('habits', stringify(habits));
  } catch (e) {
    console.error('Error saving habits:', e);
  }
};

export const loadHabits = async (): Promise<Habit[]> => {
  try {
    const json = await AsyncStorage.getItem('habits');
    return json ? parse(json) : [];
  } catch (e) {
    console.error('Error loading habits:', e);
    return [];
  }
};

export const saveAIChatHistory = async (messages: Message[]) => {
  try {
    const limitedHistory = messages.slice(0, 100)
    await AsyncStorage.setItem("ai_chat_history", stringify(limitedHistory));
  } catch (e) {
    console.error("Failed to save history", e);
  }
};

export const loadAIChatHistory = async () => {
  try {
    const savedHistory = await AsyncStorage.getItem("ai_chat_history");
    const limitedHistory = savedHistory ? parse(savedHistory) : []
    return limitedHistory;
  }
  catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};


export const loadUnlockedAchievements = async (): Promise<AchievementBadge[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return [];
  }
};

export const saveUnlockedAchievement = async (badge: AchievementBadge): Promise<void> => {
  try {
    const currentBadges = await loadUnlockedAchievements();
    // Prevent duplicate unlocks
    if (!currentBadges.some(b => b.id === badge.id)) {
      currentBadges.push(badge);
      await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(currentBadges));
    }
  } catch (error) {
    console.error('Error saving achievement:', error);
  }
};

export const loadAppMetrics = async (): Promise<AppMetrics> => {
  try {
    const jsonValue = await AsyncStorage.getItem(METRICS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : DefaultMetrics;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return DefaultMetrics;
  }
};

export const saveAppMetrics = async (metrics: AppMetrics): Promise<void> => {
  try {
    await AsyncStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.error('Error saving metrics:', error);
  }
};


  // Atomic mutation function for metrics. 
  // Handles both Daily and Global updates simultaneously for absolute consistency.
 
export const mutateMetric = async (
  keys: MetricKey[],
  amount: number, // Use 1 to increment, -1 to decrement
  dateOverride?: string
): Promise<AppMetrics> => {
  const metrics = await loadAppMetrics();
  const dateString = dateOverride || new Date().toISOString().split('T')[0];
  if (!metrics.daily[dateString]) {
    metrics.daily[dateString] = {
      tasksCompleted: 0, habitsCheckedIn: 0, habitsGoalsCompleted: 0, habitsStreakMax: 0,
      habitsFrozen: 0, timeTracked: 0, chatMessagesSent: 0, chatActionsConfirmed: 0, chatActionsExpired: 0,
      chatActionsCancelled: 0
    };
  }

  // Apply mutations with a floor of 0 to prevent negative stats
  for (const key of keys) {
    if (key in metrics.global) {
      const gKey = key as GlobalMetricKey;
      metrics.global[gKey] = Math.max(0, metrics.global[gKey] + amount);
    }
    if (key in metrics.daily[dateString]) {
      const dKey = key as DailyMetricKey;
      metrics.daily[dateString][dKey] = Math.max(0, metrics.daily[dateString][dKey] + amount);
    }
  }
  console.log("Global metrics:", metrics.global);
  await saveAppMetrics(metrics);
  return metrics;
}; */

// Optional: Clear all data for testing

export const clearStorageByKey = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log("Cleared key:", key);
  } catch (e) {
    console.error('Error clearing metrics:', e);
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
};