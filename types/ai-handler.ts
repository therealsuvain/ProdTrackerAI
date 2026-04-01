import { Task } from '@/types/task';
import { Habit } from '@/types/habits';
import { CalendarEvent } from '@/types/calendar';
import { NavigationProp, NavigationState } from '@react-navigation/native';

// This interface defines what every "Action" in your app needs to work.
// By passing the 'context', we allow the handler to modify the app's state.
export interface AIActionContext {
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task | null>;
  getTasks: () => Promise<Task[]>;
  events: CalendarEvent[];
  setEvents: (events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  getEvent: (id: string) => Promise<CalendarEvent | null>;
  getEvents: () => Promise<CalendarEvent[]>;
  habits: Habit[];
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  getHabit: (id: string) => Promise<Habit | null>;
  getHabits: () => Promise<Habit[]>;
  resolveItemId: <T extends { id: string }>(
    shortOrFullId: string,
    items: T[],
  ) => string | null
  setTitle: (title: string) => void;
  start: () => void;
  stop: () => void;
  navigation: any
  // Add other state setters as needed (Timer, Navigation, etc.)
}

export interface AIHandler {
  // Each handler will implement this 'execute' logic
  execute: (params: any, context: AIActionContext) => Promise<any>;
}