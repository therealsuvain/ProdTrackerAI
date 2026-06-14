import { AIHandler } from "@/types/ai-handler";
import { Habit } from "@/types/habits";
import { cancelReminder, scheduleReminderHabits } from "@/hooks/use-notifications";
import { checkInHabit, freezeHabit } from "../../habit-utils";
import { createHabit } from "../../model-factory-utils";
import { resolveIdsFromNames } from "./tags-and-categories-handlers";

export const AddHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const newHabit = await createHabit(params);
    if (newHabit.reminder) {
      try {
        newHabit.notificationId = await scheduleReminderHabits(newHabit);
      } catch (error) {
        console.warn("Failed to schedule habit notifications:", error);
        return { status: "partial_success", reason: "Failed to schedule notification", task: newHabit };
      }
    }

    context.addHabit(newHabit);
    console.log(`AI Action: Added Habit "${newHabit.title}"`);
    const { id, embedding, ...rest } = newHabit;
    return { status: "success", habit: { id: id.slice(0, 8), ...rest } };
  }

}

export const EditHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const oldHabit = context.habits.find((t) => t.id.slice(0, 8) === params.id);
    if (!oldHabit) {
      throw new Error("Habit not found");
    }
    let currentTags = Array.isArray(oldHabit.tags) ? [...oldHabit.tags] : [];

    if (params.addTagIds && Array.isArray(params.addTagIds)) {
      currentTags = [...new Set([...currentTags, ...params.addTagIds])];
    }

    if (params.removeTagIds && Array.isArray(params.removeTagIds)) {
      currentTags = currentTags.filter(id => !params.removeTagIds.includes(id));
    }
    const newHabit = await createHabit({ ...oldHabit, ...params, tags: currentTags, id: oldHabit.id });
    if (newHabit.reminder) {
      try {
        if (newHabit.notificationId) await cancelReminder(newHabit.notificationId);
        newHabit.notificationId = await scheduleReminderHabits(newHabit);
      } catch (error) {
        console.warn("Failed to schedule habit notifications:", error);
        return { status: "partial_success", reason: "Failed to schedule notification", task: newHabit };
      }
    }
    await context.editHabit(newHabit);
    const { id, embedding, ...rest } = newHabit;
    return { status: "success", habit: { id: id.slice(0, 8), ...rest } };
  }
}

export const DeleteHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const oldHabit = context.tasks.find((t) => t.id.slice(0, 8) === params.id);
    if (!oldHabit) {
      throw new Error("Task not found");
    }
    if (oldHabit.notificationId) {
      await cancelReminder(oldHabit.notificationId);
    }
    await context.removeHabit(oldHabit.id);
    const { id, title } = oldHabit;
    return { status: "success", habit: { id: id.slice(0, 8), title } };
  }
};

export const CheckInHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const habit = context.habits.find((h) => h.id.slice(0, 8) === params.id);
    if (!habit) throw new Error("Habit not found");
    const result = checkInHabit(habit);
    if (result.status === "denied")
      return { status: "denied", reason: result.reason }
    await context.editHabit(result.habit);
    const { id, title } = result.habit;
    return { status: "success", habit: { id: id.slice(0, 8), title } };
  }
};

export const FreezeHabitHandler: AIHandler = {
  execute: async (params, context) => {
    const habit = context.habits.find((h) => h.id.slice(0, 8) === params.id);
    if (!habit) throw new Error("Habit not found");
    const result = freezeHabit(habit);
    if (result.status === "denied")
      return { status: "denied", reason: result.reason }
    await context.editHabit(result.habit);
    const { id, title } = result.habit;
    return { status: "success", habit: { id: id.slice(0, 8), title } };
  }
}
const isToday = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
};

// --- 1. HABITS HANDLER ---
export const QueryHabitsHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { frequency = "all", stateFilter = "all", sortBy = "none", specificHabitId, categoryName,
      tagNames } = args;

    // DEEP DIVE: Specific Habit
    if (specificHabitId) {
      const targetHabit = context.habits.find((h: Habit) => h.id.slice(0, 8) === specificHabitId);
      if (!targetHabit) return { error: "Habit not found in database." };

      return {
        output: {
          id: targetHabit.id,
          t: targetHabit.title,
          d: targetHabit.description,
          fq: targetHabit.frequency,
          cs: targetHabit.streak,
          ls: targetHabit.longestStreak,
          g: targetHabit.goal || "None",
          f: targetHabit.streakFreezes,
          totalCheckIns: targetHabit.history?.length || 0,
          ldc: targetHabit.history?.length ? targetHabit.history[targetHabit.history.length - 1] : "Never",
          fh: targetHabit.freezeHistory || [], // AI can look at this to see exactly when it was frozen
          cat: targetHabit.category,
          tg: targetHabit.tags,
          rem: targetHabit.reminder,
          rd: targetHabit.reminderDate,
          psrar: targetHabit.pendingStreakResetAfter || '',
          gc: targetHabit.goalCompletions ? targetHabit.goalCompletions.map((gc: any) => JSON.stringify(gc)) : [],
          ct: targetHabit.createdAt,
          ut: targetHabit.updatedAt,
        }
      };
    }
    const targetCategoryId = categoryName ? resolveIdsFromNames(categoryName, context.categories)[0] : undefined;
    const targetTagIds = tagNames ? resolveIdsFromNames(tagNames, context.tags) : [];
    let filtered = [...(context.habits || [])];

    if (targetCategoryId) {
      filtered = filtered.filter(h => h.category === targetCategoryId);
    }

    if (targetTagIds.length > 0) {
      filtered = filtered.filter(h =>
        targetTagIds.every((tagId: string) => h.tags?.includes(tagId))
      );
    }
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
      output: filtered.map(h => ({
        id: h.id.slice(0, 8),
        t: h.title,
        d: h.description,
        fq: h.frequency,
        csk: h.streak,
        ls: h.longestStreak,
        g: h.goal,
        f: h.streakFreezes,
        fh: h.freezeHistory,
        totalCheckIns: h.history.length,
        ldc: h.history.length > 0 ? h.history[h.history.length - 1] : "Never",
        currentlyFrozen: h.freezeHistory?.length ? isToday(h.freezeHistory[h.freezeHistory.length - 1]) : false,
        cat: h.category || '',// ? h.category.slice(0, 8) : '-',
        tg: h.tags || [],//?.length ? h.tags.map((id:string) => id.slice(0, 8)).join('|') : '-',
        rem: h.reminder,
        psrar: h.pendingStreakResetAfter || '',
        gc: h.goalCompletions ? h.goalCompletions.map((gc: any) => JSON.stringify(gc)) : [],
        rd: h.reminderDate,
        ct: h.createdAt,
        ut: h.updatedAt
      }))
    };
  }
};