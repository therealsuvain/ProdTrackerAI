import { Habit } from "./habits";
import { Task } from "./task";
import { CalendarEvent } from "./calendar";

export type InverseAction =
    | { type: 'DELETE_TASK'; payload: { task: Task } }
    | { type: 'ADD_DELETED_TASK'; payload: { task: Task } }
    | { type: 'REVERT_UPDATE_TASK'; payload: { task: Task } }
    | { type: 'BATCH_REVERT_TASKS'; payload: { originalTasks: Task[] } }
    | { type: 'DELETE_HABIT'; payload: { habit: Habit } }
    | { type: 'ADD_DELETED_HABIT'; payload: { habit: Habit } }
    | { type: 'REVERT_UPDATE_HABIT'; payload: { habit: Habit } }
    | { type: 'BATCH_REVERT_HABITS'; payload: { originalHabits: Habit[] } }
    | { type: 'DELETE_EVENT'; payload: { event: CalendarEvent } }
    | { type: 'ADD_DELETED_EVENT'; payload: { event: CalendarEvent } }
    | { type: 'REVERT_UPDATE_EVENT'; payload: { event: CalendarEvent } }
    | { type: 'BATCH_REVERT_EVENTS'; payload: { originalEvents: CalendarEvent[] } };
// Extend as we add more tools
