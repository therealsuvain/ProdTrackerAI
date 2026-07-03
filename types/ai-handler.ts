import { CalendarEvent } from '@/types/calendar';
import { Habit } from '@/types/habits';
import { Task } from '@/types/task';
import { Category } from './category';
import { Tag } from './tag';
import { GlobalMetricKey } from './metrics';
import { TimerLog } from './timer';

// This interface defines what every "Action" in your app needs to work.
// By passing the 'context', we allow the handler to modify the app's state.
export interface AIActionContext {
  tasks: Task[];
  addTask: (task: Task) => Promise<void>;
  editTask: (task: Task) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  batchMutateTasks: (tasksToMutate: Task[], newValues: any) => Promise<void>;
  batchRestoreTasks: (originalTasks: Task[]) => Promise<void>;
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  deleteEventOccurrence: (id: string, date: string, all: boolean) => Promise<void>;
  batchMutateEvents: (eventsToMutate: CalendarEvent[], newValues: any) => Promise<void>;
  batchRestoreEvents: (originalEvents: CalendarEvent[]) => Promise<void>;
  habits: Habit[];
  addHabit: (habit: Habit) => Promise<void>;
  editHabit: (habit: Habit) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  batchMutateHabits: (habitsToMutate: Habit[], newValues: any) => Promise<void>;
  batchRestoreHabits: (originalHabits: Habit[]) => Promise<void>;
  categories: Category[];
  addCategory: (categoryPayload: { id: string, name: string, color: string, icon: string }) => Promise<string>;
  incrementCategoryUsage: (id: string) => Promise<void>;
  updateUserCategory: (category: Category) => Promise<void>;
  deleteUserCategory: (id: string, fallbackId?: string | null) => Promise<void>;
  getCategoryUsageForAll: (id: string) => Promise<any>;
  reassignDeletedCategory : (category: Category, fallbackId:string|null, originalItems:Record<string,string[]>)=>Promise<void>;
  tags: Tag[];
  addTags: (tagsPayload: { id: string; name: string }[]) => Promise<string[]>;
  incrementTagUsage: (id: string) => Promise<void>;
  updateUserTag: (tag: Tag) => Promise<void>;
  deleteUserTag: (id: string, fallbackId?: string | null) => Promise<void>;
  getTagUsageForAll: (id: string) => Promise<any>;
  reassignDeletedTag : (tag:Tag, fallbackId:string|null, originalItems:Record<string,string[]>)=>Promise<void>;
  getItemIdsForTagLocal:(tagId:string)=>Promise<Record<string,string[]>>;
  getImmediateContext: () => Promise<any>;
  getMoreContext: (args: any) => Promise<any>;
  timerLogs: TimerLog[];
  setTitle: (title: string) => void;
  start: () => void;
  stop: () => void;
  navigation: any;
  trackMetric: (key: GlobalMetricKey[], amount: number) => void;
  // Add other state setters as needed (Timer, Navigation, etc.)
}

export interface AIHandler {
  // Each handler will implement this 'execute' logic
  execute: (params: any, context: AIActionContext) => Promise<any>;
}