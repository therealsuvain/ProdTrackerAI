// src/utils/modelFactories.ts
import { Task } from '../types/task';
import { CalendarEvent } from '../types/calendar';
import { TimerLog } from '../types/timer';
import { Habit } from '../types/habits';
import {randomUUID } from 'expo-crypto';

// Helper for date parsing
const parseDate = (dateStr: any): Date | undefined => {
  if (!dateStr) return undefined;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    if (dateStr.toLowerCase() === 'today') return new Date();
    if (dateStr.toLowerCase() === 'tomorrow') return new Date(Date.now() + 86400000);
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  throw new Error('Invalid date format');
};

// Task factory
export const createTask = (params: Record<string, any>): Task => {
  try {
    if(!params.title || params.title.trim() === '' ){
        throw new Error('Title missing')
    }
    if(!params.dueDate){
        throw new Error('DueDate is missing')
    }
    const dueDate = parseDate(params.dueDate);
    
    return {
      id: params.id || randomUUID(),
      title: params.title || '',
      description: params.description || '',
      dueDate,
      priority: ['low', 'medium', 'high'].includes(params.priority) ? params.priority : 'medium',
      completed: params.completed ?? false,
      tags: params.tags || [],
    };
  } catch (err : any) {
    throw new Error(`Invalid Task params: ${err.message}`);
  }
};

// Event factory (similar)
export const createEvent = (params: Record<string, any>): CalendarEvent => {
  try {
    if(!params.title || params.title.trim() === '' ){
        throw new Error('Title missing')
    }
    if(!params.startTime || !params.endTime){
        throw new Error("Time is missing")
    }
    const startTime = parseDate(params.startTime);
    const endTime = parseDate(params.endTime);
    if (startTime && endTime && startTime > endTime) throw new Error('End time before start');
    return {
      id: params.id || randomUUID(),
      title: params.title || '',
      startTime: startTime? startTime: new Date(),
      endTime,
      description: params.description || '',
      reminder: params.reminder ?? false,
      recurrence: ['none', 'daily', 'weekly'].includes(params.recurrence) ? params.recurrence : 'none',
      category: params.category || '',
      notificationId: undefined,
    };
  } catch (err : any) {
    throw new Error(`Invalid Event params: ${err.message}`);
  }
};

// Habit factory
export const createHabit = (params: Record<string, any>): Habit => {
  try {
      if(!params.title || params.title.trim() === '' ){
        throw new Error('Title missing')
    }
    if(!params.goal){
        throw new Error("End Goal is missing")
    }
    const goal = params.goal ? parseInt(params.goal) : undefined;
    if (goal && isNaN(goal)) throw new Error('Goal must be a number');
    return {
      id: params.id || randomUUID(),
      title: params.title || '',
      frequency: ['daily', 'weekly'].includes(params.frequency) ? params.frequency : 'daily',
      streak: params.streak ?? 0,
      goal,
    };
  } catch (err : any ) {
    throw new Error(`Invalid Habit params: ${err.message}`);
  }
};

// TimerLog factory
export const createTimerLog = (params: Record<string, any>): TimerLog => {
  try {
      if(!params.title || params.title.trim() === '' ){
        throw new Error('Title missing')
    }
    if(!params.startTime || !params.endTime){
        throw new Error("Time is missing")
    }
    const startTime = parseDate(params.startTime);
    const endTime = parseDate(params.endTime);
    const duration = params.duration ? parseInt(params.duration) : undefined;
    if (duration && isNaN(duration)) throw new Error('Duration must be a number');
    return {
      id: params.id || randomUUID(),
      title: params.title || '',
      startTime: startTime? startTime: new Date(),
      endTime,
      duration,
    };
  } catch (err: any ) {
    throw new Error(`Invalid TimerLog params: ${err.message}`);
  }
};