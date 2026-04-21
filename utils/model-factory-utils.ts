// src/utils/modelFactories.ts
import { generateEmbedding } from "@/utils/embedding-engine";
import { randomUUID } from "expo-crypto";
import { Task } from "../types/task";
import { TimerLog } from "../types/timer";

// TODOX All date fields from AI have to checked and verified before being returned

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
  if (!date) return false;
  date = new Date(date);
  return date instanceof Date && !isNaN(date.getTime());
};
// Task factory
export const createTask = async (
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
    if (!params.dueDate) {
      throw new Error("DueDate is missing");
    }
    let dueDate;
    if (!validDate(params.dueDate)) {
      dueDate = parseDate(params.dueDate)?.toISOString();
    }
    else {
      dueDate = params.dueDate
    }

    let reminderDate;
    if (params.reminderDate) {
      if (!validDate(params.reminderDate)) {
        reminderDate = parseDate(
          dueDate?.split("T")[0] + "T" + params.reminderDate
        );
      }
      else {
        reminderDate = params.reminderDate
      }
    }

    const embeddingVector = await generateEmbedding(params.title, false);
    return {
      id,
      title: params.title,
      ...(params.description && { description: params.description }),
      dueDate,
      reminder: params.reminder ?? false,
      ...(reminderDate && { reminderDate }),
      ...(params.notificationId && { notificationId: params.notificationId }),
      priority: ["low", "medium", "high"].includes(params.priority)
        ? params.priority
        : "medium",
      completed: params.completed ?? false,
      ...(params.category && { category: params.category }),
      ...(params.tags && { tags: params.tags }),
      createdAt: params.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(params.completedAt && { completedAt: params.completedAt }),
      embedding: params.embedding || embeddingVector,
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
    let startDate, endDate, startTime, endTime;
    if (!validDate(params.startDate)) {
      startDate = parseDate(params.startDate)?.toISOString();
    }
    else {
      startDate = params.startDate
    }
    if (!validDate(params.endDate)) {
      endDate = parseDate(params.endDate)?.toISOString();
    }
    else {
      endDate = params.endDate
    }
    if (!validDate(params.startTime))
      startTime = parseDate(
        startDate?.toISOString().split("T")[0] + "T" + params.startTime
      )?.toISOString();
    else
      startTime = params.startTime

    if (!validDate(params.endTime))
      endTime = parseDate(
        startDate?.toISOString().split("T")[0] + "T" + params.endTime
      )?.toISOString();
    else
      endTime = params.endTime

    if (startTime && endTime && startTime > endTime)
      throw new Error("End time before start");

    if (!startTime)
      throw new Error("Start time is missing");
    if (!endTime)
      throw new Error("End time is missing");
    if (!startDate)
      throw new Error("Start date is missing");

    const embeddingVector = await generateEmbedding(params.title, false);
    return {
      id,
      title: params.title,
      startDate,
      ...(endDate && { endDate }),
      startTime,
      endTime,
      ...(params.description && { description: params.description }),
      reminder: params.reminder ?? false,
      recurrence: ["none", "daily", "weekly"].includes(params.recurrence)
        ? params.recurrence
        : "none",
      ...(params.notificationIds && { notificationIds: params.notificationIds }),
      ...(params.category && { category: params.category }),
      ...(params.tags && { tags: params.tags }),
      ...(params.deletedOccurrences && { deletedOccurrences: params.deletedOccurrences }),
      embedding: params.embedding || embeddingVector,
      createdAt: params.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        reminderDate = parseDate(new Date().toISOString().split("T")[0] + "T" + params.reminderDate)?.toISOString();
      }
      else {
        reminderDate = params.reminderDate
      }
    }
    const goal = parseInt(params.goal);
    if (goal && isNaN(goal)) throw new Error("Goal must be a number");
    if (goal && goal <= 0) throw new Error("Goal must be greater than 0");
    const embeddingVector = await generateEmbedding(params.title, false);
    return {
      id,
      title: params.title,
      frequency: ["daily", "weekly"].includes(params.frequency)
        ? params.frequency
        : "daily",
      reminder: params.reminder ?? false,
      ...(params.reminderDate && { reminderDate }),
      ...(params.targetDays && { targetDays: params.targetDays, }),
      streak: params.streak || 0,
      history: params.history || [],
      streakFreezes: params.streakFreezes || 1,
      longestStreak: params.longestStreak || 0,
      goal,
      goalCompletions: params.goalCompletions || [],
      ...(params.pendingStreakResetAfter && { pendingStreakResetAfter: params.pendingStreakResetAfter }),
      ...(params.notificationId && { notificationId: params.notificationId }),
      ...(params.category && { category: params.category }),
      ...(params.tags && { tags: params.tags }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      embedding: params.embedding || embeddingVector,
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
