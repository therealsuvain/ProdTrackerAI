import { AIHandler } from "@/types/ai-handler";
import { createHabit } from "../model-factory-utils";
import { scheduleReminderHabits } from "../../hooks/use-notifications";
import { checkInHabit } from "../habit-utils"
import { Habit } from "@/types/habits";

//TODO Add feedback for bboth if habit not found or check in failed,maybe add feedback for all handlers
export const AddHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const newHabit = await createHabit(params);
    if (newHabit.reminder) {
      try {
        newHabit.notificationId = await scheduleReminderHabits(newHabit);
      } catch (error) {
        console.warn("Failed to schedule habit notifications:", error);
      }
    }

    //context.setHabits((prev) => [...prev, newHabit]);
    context.addHabit(newHabit);
    console.log(`AI Action: Added Habit "${newHabit.title}"`);
  }

}

export const DeleteHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const oldHabit = context.tasks.find((t) => t.id.slice(0, 8) === params.id);
    if (!oldHabit) {
      throw new Error("Task not found");
    }
    await context.removeHabit(oldHabit.id);
  }
};

export const CheckInHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const habit = context.habits.find((h) => h.id.slice(0, 8) === params.id);
    if (!habit) return //TODO 
    const result = checkInHabit(habit);
    if (result.status === "denied") return //TODO;
    await context.editHabit(result.habit);
    /* context.setHabits((prev) =>
      prev.map((h) => (h.id.slice(0, 8) === params.id ? checkInHabit(h) : h))
    ); */
  }
};

const isToday = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
};

// --- 1. HABITS HANDLER ---
export const QueryHabitsHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { frequency = "all", stateFilter = "all", sortBy = "none", specificHabitId } = args;

    // DEEP DIVE: Specific Habit
    if (specificHabitId) {
      const targetHabit = context.habits.find((h: Habit) => h.id.slice(0, 8) === specificHabitId);
      if (!targetHabit) return { error: "Habit not found in database." };

      return {
        id: targetHabit.id,
        title: targetHabit.title,
        frequency: targetHabit.frequency,
        currentStreak: targetHabit.streak,
        longestStreak: targetHabit.longestStreak,
        goal: targetHabit.goal || "None",
        availableFreezes: targetHabit.streakFreezes,
        totalCheckIns: targetHabit.history?.length || 0,
        lastCheckedIn: targetHabit.history?.length ? targetHabit.history[targetHabit.history.length - 1] : "Never",
        freezeHistory: targetHabit.freezeHistory || [] // AI can look at this to see exactly when it was frozen
      };
    }

    let filtered = [...(context.habits || [])];

    // 1. Frequency Filter
    if (frequency !== "all") {
      filtered = filtered.filter(h => h.frequency === frequency);
    }

    // 2. Complex State Filters (History & Freezes)
    if (stateFilter === "needs_checkin") {
      // Habit has NO check-in today
      filtered = filtered.filter(h => h.history.length === 0 || !isToday(h.history[h.history.length - 1]));
    } else if (stateFilter === "streak_lost") {
      // Streak is 0, but they have history (meaning they used to have a streak and lost it)
      filtered = filtered.filter(h => h.streak === 0 && h.history.length > 0);
    } else if (stateFilter === "currently_frozen") {
      // Check if the latest freeze date is today
      filtered = filtered.filter(h => h.freezeHistory && h.freezeHistory.length > 0 && isToday(h.freezeHistory[h.freezeHistory.length - 1]));
    }

    // 3. Sorting Logic
    filtered.sort((a, b) => {
      if (sortBy === "highest_streak") return b.streak - a.streak;
      if (sortBy === "lowest_streak") return a.streak - b.streak;
      if (sortBy === "longest_streak_ever") return b.longestStreak - a.longestStreak;
      if (sortBy === "highest_goal") return (b.goal || 0) - (a.goal || 0);

      const lastCheckInA = a.history.length ? new Date(a.history[a.history.length - 1]).getTime() : 0;
      const lastCheckInB = b.history.length ? new Date(b.history[b.history.length - 1]).getTime() : 0;

      if (sortBy === "newest_checkin") return lastCheckInB - lastCheckInA;
      if (sortBy === "oldest_checkin") return lastCheckInA - lastCheckInB;

      return 0;
    });

    return {
      results: filtered.map(h => ({
        id: h.id.slice(0, 8),
        title: h.title,
        currentStreak: h.streak,
        longestStreak: h.longestStreak,
        goal: h.goal,
        lastCheckedIn: h.history.length > 0 ? h.history[h.history.length - 1] : "Never",
        currentlyFrozen: h.freezeHistory?.length ? isToday(h.freezeHistory[h.freezeHistory.length - 1]) : false
      }))
    };
  }
};