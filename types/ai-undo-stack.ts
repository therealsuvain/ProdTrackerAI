import { Habit } from "./habits";
import { Task } from "./task";
import { CalendarEvent } from "./calendar";
import { Tag } from "./tag";
import { Category } from "./category";

export type InverseAction =
    | { type: 'DELETE_TASK'; payload: { task: Task }; timestamp: number }
    | { type: 'ADD_DELETED_TASK'; payload: { task: Task }; timestamp: number }
    | { type: 'REVERT_UPDATE_TASK'; payload: { task: Task }; timestamp: number }
    | { type: 'BATCH_REVERT_TASKS'; payload: { originalTasks: Task[] }; timestamp: number }
    | { type: 'DELETE_HABIT'; payload: { habit: Habit }; timestamp: number }
    | { type: 'ADD_DELETED_HABIT'; payload: { habit: Habit }; timestamp: number }
    | { type: 'REVERT_UPDATE_HABIT'; payload: { habit: Habit }; timestamp: number }
    | { type: 'BATCH_REVERT_HABITS'; payload: { originalHabits: Habit[] }; timestamp: number }
    | { type: 'DELETE_EVENT'; payload: { event: CalendarEvent }; timestamp: number }
    | { type: 'ADD_DELETED_EVENT'; payload: { event: CalendarEvent }; timestamp: number }
    | { type: 'REVERT_UPDATE_EVENT'; payload: { event: CalendarEvent }; timestamp: number }
    | { type: 'BATCH_REVERT_EVENTS'; payload: { originalEvents: CalendarEvent[] }; timestamp: number }
    | { type: 'DELETE_TAG'; payload: { tags: Tag[] }; timestamp: number }
    | { type: 'ADD_DELETED_TAG'; payload: { tag: Tag, oldFallbackID: string,originalItems: Record<string,string[]> }; timestamp: number }
    | { type: 'REVERT_UPDATE_TAG'; payload: { tag: Tag }; timestamp: number }
    | { type: 'BATCH_REVERT_TAGS'; payload: { originalTags: Tag[] }; timestamp: number }
    | { type: 'DELETE_CATEGORY'; payload: { category: Category}; timestamp: number }
    | { type: 'ADD_DELETED_CATEGORY'; payload: { category: Category, oldFallbackID: string , originalItems: Record<string,string[]>  }; timestamp: number }
    | { type: 'REVERT_UPDATE_CATEGORY'; payload: { category: Category }; timestamp: number }
// Extend as we add more tools
