import { Habit } from "@/types/habits";

const STREAK_MILESTONE = 7; 
const MAX_FREEZES = 3;

export const getTodayISO = () => new Date().toISOString().split('T')[0];

export const isCompletedToday = (habit: Habit): boolean => {
  const today = getTodayISO();
  return habit.history.includes(today);
};

export const applyMissedDayLogic = (habit: Habit): Habit => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];
  const todayISO = today.toISOString().split('T')[0];

  // If already done today or yesterday, we are safe.
  if (habit.history.includes(todayISO) || habit.history.includes(yesterdayISO)) {
    return habit;
  }
  
  // If yesterday was FROZEN, we are also safe (recursive check, simplified here)
  if (habit.freezeHistory?.includes(yesterdayISO)) {
    return habit;
  }

  // If we are here, user MISSED yesterday.
  // Check if they have a Freeze available.
  if (habit.streakFreezes > 0) {
    // BURN A FREEZE
    return {
      ...habit,
      streakFreezes: habit.streakFreezes - 1,
      freezeHistory: [...(habit.freezeHistory || []), yesterdayISO],
      // Streak is preserved (maintained at current value)
    };
  } else {
    // NO FREEZES - RESET STREAK
    return {
      ...habit,
      streak: 0
    };
  }
};

export const calculateStreak = (habit: Habit): number => {
  const sortedHistory = [...habit.history].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if (sortedHistory.length === 0) return 0;

  let currentStreak = 0;
  let today = new Date();
  // Normalize today to midnight to avoid time conflicts
  today.setHours(0,0,0,0);

  // If the last completion was BEFORE yesterday (and not today), the streak might be broken.
  // We iterate backwards checking validity.
  // Note: This is a simplified robust streak calc. For complex "Target Days" (e.g., Mon/Wed only),
  // we need to check if the gap between dates is "valid".
  
  // Simple version: check consecutive days present in history
  // For production 'Target Days' logic, we check if the 'missed' days were actually required.
  
  // ... (For now, let's implement the standard consecutive logic which covers 90% of cases)
  // ... We will enhance this helper when we implement the UI for specific days.
  
  // Fallback to simple counter for now if history is complex, 
  // but strictly, we should trust the stored 'streak' property if we update it correctly on check-in.
  return habit.streak; 
};

/**
 * Handles the logic when a user checks in a habit.
 * 1. Adds date to history.
 * 2. Updates Streak.
 * 3. Consumes Freeze if needed (future implementation).
 */
export const checkInHabit = (habit: Habit): Habit => {
  const todayISO = getTodayISO();

  // Prevent double check-in
  if (habit.history.includes(todayISO)) return habit;

  const newHistory = [...habit.history, todayISO];
  const newStreak = habit.streak + 1;

  let newFreezes = habit.streakFreezes;
  
  if (newStreak % STREAK_MILESTONE === 0) {
    if (newFreezes < MAX_FREEZES) {
      newFreezes += 1;
      // Optional: Return a flag here to trigger a "You earned a freeze!" modal in UI
    }
  }
  // Calculate new streak
  // If logic: Was it completed yesterday? Or is it a scheduled day?
  // For MVP refactor: increment if last completion was recent enough.
  
  const lastDateStr = habit.history[habit.history.length - 1]; // Get last actual completion
  let isStreakContinuous = false;

  if (!lastDateStr) {
    isStreakContinuous = true; // First ever checkin
  } else {
    const lastDate = new Date(lastDateStr);
    const todayDate = new Date();
    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (habit.frequency === 'daily') {
        // Allow 1 day gap (yesterday)
        if (diffDays <= 1) isStreakContinuous = true;
    } else if (habit.frequency === 'weekly') {
        // Allow 7 day gap
        if (diffDays <= 7) isStreakContinuous = true;
    }
  }

  // Handle Streak Freeze logic here in future
  
  
  return {
    ...habit,
    history: newHistory,
    streak: isStreakContinuous ? newStreak : 1,
    longestStreak: Math.max(habit.longestStreak || 0, isStreakContinuous ? newStreak : 1)
  };
};