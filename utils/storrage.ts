// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types/task';
import { CalendarEvent } from '../types/calendar';
import { TimerLog } from '../types/timer';
import { Habit } from '../types/habits';

// Helper to handle JSON serialization (Dates need conversion)
const stringify = (data: any) => JSON.stringify(data, (_key, value) => 
  value instanceof Date ? value.toISOString() : value
);

const parse = (json: string) => JSON.parse(json, (_key, value) => 
  typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/) ? new Date(value) : value
);

// Tasks
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

// Optional: Clear all data for testing
export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
};