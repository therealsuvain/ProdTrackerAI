// src/utils/modelFactories.ts
import { Task } from "../types/task";
import { CalendarEvent } from "../types/calendar";
import { TimerLog } from "../types/timer";
import { Habit } from "../types/habits";
import { randomUUID } from "expo-crypto";
import {generateEmbedding} from "@/utils/embedding-engine"



// Helper for date parsing
const parseDate = (dateStr: any): Date | undefined => {
  if (!dateStr) return undefined;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === "string") {
    if (dateStr.toLowerCase() === "today") return new Date();
    if (dateStr.toLowerCase() === "tomorrow")
      return new Date(Date.now() + 86400000);
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  throw new Error("Invalid date format");
};

const validDate = (date: any): boolean => {
  date = new Date(date);
  return date instanceof Date && !isNaN(date.getTime());
};
// Task factory
export const createTask =  async (
  params: Record<string, any>,
)=> {
  try {
    let id;
    if (params.id) {
      id = params.id;
    } else {
      id = randomUUID();
    }
    if (!params.title || params.title.trim() === "") {
      throw new Error("Title missing");
    }
    if (!params.dueDate) {
      throw new Error("DueDate is missing");
    }

    const dueDate = parseDate(params.dueDate)?.toISOString();

    let reminderDate;
    if (params.reminderDate) {
      if (!validDate(params.reminderDate)) {
        reminderDate = parseDate(
          dueDate?.split("T")[0] + "T" + params.reminderDate
        );
      }
    }

    const embeddingVector = await generateEmbedding(params.title, false);
    return {
      id,
      title: params.title || "",
      description: params.description || "",
      dueDate,
      reminder: params.reminder,
      reminderDate,
      notificationId: params.notificationId || undefined,
      priority: ["low", "medium", "high"].includes(params.priority)
        ? params.priority
        : "medium",
      completed: params.completed ?? false,
      tags: params.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
      embedding : params.embedding || embeddingVector,
    } as Task;
  } catch (err: any) {
    throw new Error(`Invalid Task params: ${err.message}`);
  }
};

export const createEvent = async (
  params: Record<string, any>,
 ) => {
  try {
    let id;
    if (params.id) {
      id = params.id;
    } else {
      id = randomUUID();
    }
    if (!params.title || params.title.trim() === "") {
      throw new Error("Title missing");
    }
    if (!params.startTime || !params.endTime) {
      throw new Error("Time is missing");
    }

    const startDate = parseDate(params.startDate);
    const endDate = parseDate(params.endDate);
    let startTime, endTime;
    if (!validDate(params.startTime))
      startTime = parseDate(
        startDate?.toISOString().split("T")[0] + "T" + params.startTime
      );
    if (!validDate(params.endTime))
      endTime = parseDate(
        startDate?.toISOString().split("T")[0] + "T" + params.endTime
      );
    if (startTime && endTime && startTime > endTime)
      throw new Error("End time before start");
    const embeddingVector = await generateEmbedding(params.title, false);
    return {
      id,
      title: params.title || "",
      startDate: startDate ? startDate : new Date(),
      endDate: endDate ? endDate : new Date(),
      startTime: startTime ? startTime : new Date(),
      endTime: endTime ? endTime : new Date(),
      description: params.description || "",
      reminder: params.reminder,
      recurrence: ["none", "daily", "weekly"].includes(params.recurrence)
        ? params.recurrence
        : "none",
      category: params.category || "",
      deletedOccurrences:params.deletedOccurrences||[],
      notificationIds: params.notificationIds || undefined,
      embedding : params.embedding ||embeddingVector,
    };
  } catch (err: any) {
    throw new Error(`Invalid Event params: ${err.message}`);
  }
};

export const createHabit = async (
  params: Record<string, any>
) => {
  try {
    let id;
    if (params.id) {
      id = params.id;
    } else {
      id = randomUUID();
    }
    if (!params.title || params.title.trim() === "") {
      throw new Error("Title missing");
    }
    if (!params.goal) {
      throw new Error("End Goal is missing");
    }
    let reminderDate;
    if (params.reminderDate) {
      if (!validDate(params.reminderDate)) {
        reminderDate = parseDate(
          new Date().toISOString().split("T")[0] + "T" + params.reminderDate
        );
      }
    }
    const goal = params.goal ? parseInt(params.goal) : undefined;
    if (goal && isNaN(goal)) throw new Error("Goal must be a number");
    const embeddingVector = await generateEmbedding(params.title,false);
    return {
      id,
      title: params.title || "",
      frequency: ["daily", "weekly"].includes(params.frequency)
        ? params.frequency
        : "daily",
      streak: params.streak ?? 0,
      longestStreak:0,
      history:[],
      freezeHistory:[],
     // targetDays : params.targetDays,
      streakFreezes : 1,
      isArchived : false,
      goal,
      reminder: params.reminder,
      reminderDate,
      notificationId: params.notificationId || undefined,
      embedding : params.embedding ||embeddingVector,
    };
  } catch (err: any) {
    throw new Error(`Invalid Habit params: ${err.message}`);
  }
};

export const createTimerLog = (params: Record<string, any>): TimerLog => {
  try {
    let id;
    if (params.id) {
      id = params.id;
    } else {
      id = randomUUID();
    }
    if (!params.title || params.title.trim() === "") {
      throw new Error("Title missing");
    }
    if (!params.startTime || !params.endTime) {
      throw new Error("Time is missing");
    }
    const startTime = parseDate(params.startTime)?.toISOString();
    const endTime = parseDate(params.endTime)?.toISOString();
    const duration = params.duration ? parseInt(params.duration) : undefined;
    if (duration && isNaN(duration))
      throw new Error("Duration must be a number");
    return {
      id,
      title: params.title || "",
      startTime: startTime ? startTime : new Date().toISOString(),
      endTime,
      duration,
      category: params.category || undefined,
      laps: params.laps || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    throw new Error(`Invalid TimerLog params: ${err.message}`);
  }
};
