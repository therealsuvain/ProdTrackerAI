import { Habit, GoalCompletion } from "@/types/habits";
import { getNowISO, getTodayISO } from "./common-utils";

const STREAK_MILESTONE = 5;
const MAX_FREEZES = 3;
export type CheckInResult =
  | { status: "success"; habit: Habit }
  | { status: "goal_reached"; habit: Habit }
  | { status: 'missed_check_in'; habit: Habit }
  | { status: "auto_frozen"; habit: Habit }
  | { status: "denied"; reason: "already_checked_in" | "frozen" | "not_a_target_day" };

export type AutoCheckInResult =
  | { status: "success"; habit: Habit }
  | { status: 'missed_check_in'; habit: Habit }
  | { status: "auto_frozen"; habit: Habit }

export type FreezeResult =
  | { status: "success"; habit: Habit }
  | { status: "denied"; reason: "already_frozen" | "no_freezes_left" | "not_a_target_day" | "already_checked_in" };

export type Difficulty = "easy" | "medium" | "hard" | "legendary";


export const isCompletedToday = (habit: Habit): boolean => new Set(habit.history).has(getTodayISO());
export const isCompletedInLast7Days = (habit: Habit): boolean => {
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const diff = today.getTime() - lastWeek.getTime();
  return diff < 7;
}
/**
 * Maps a habit's goal + frequency to a difficulty tier used by the goal
 * completion modal to scale confetti intensity and message copy.
 */
export const getDifficulty = (habit: Habit): Difficulty => {
  const { goal, frequency } = habit;
  if (frequency === "daily") {
    if (goal <= 5) return "easy";
    if (goal <= 14) return "medium";
    if (goal <= 30) return "hard";
    return "legendary";
  } else {
    if (goal <= 4) return "easy";
    if (goal <= 8) return "medium";
    return "hard";
  }
};

export const applyMissedDayLogic = (habit: Habit): AutoCheckInResult => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];
  // If already done today or yesterday, we are safe.
  if (habit.history.length == 0 || isCompletedToday(habit) || isCompletedInLast7Days(habit) || new Set(habit.history).has(yesterdayISO)) {
    return { status: "success", habit };
  }

  if (habit.targetDays && habit.targetDays.length > 0 && !isTargetDay(habit.targetDays, yesterday)) {
    return { status: "success", habit };
  }

  if (isFrozen(habit)) return { status: "success", habit };

  /*  if (habit.freezeHistory?.includes(yesterdayISO) || habit.freezeHistory?.includes(todayISO)) {
     return habit;
   } */

  // If we are here, user MISSED yesterday.
  // Check if they have a Freeze available.
  if (habit.streakFreezes > 0) {
    // BURN A FREEZE
    return {
      status: "auto_frozen",
      habit: {
        ...habit,
        streakFreezes: habit.streakFreezes - 1,
        freezeHistory: [...(habit.freezeHistory || []), getNowISO()],
        // Streak is preserved (maintained at current value)
      }
    };
  } else {
    // NO FREEZES - RESET STREAK
    return {
      status: "missed_check_in", habit: {
        ...habit,
        streak: 0
      }
    };
  }
};

export const wasHabitCheckInMissed = (
  habit: Habit,
  justCheckedInHabit: Habit
): boolean => {
  const setHistory = new Set(habit.history);
  if (setHistory.has(getTodayISO()) || new Set(habit.freezeHistory).has(getTodayISO())) {
    return false; // User already checked in today, so no missed check-in
  }
  if (setHistory.size === 0) return false;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];

  if (
    habit.targetDays &&
    habit.targetDays.length > 0 &&
    !isTargetDay(habit.targetDays, yesterday)
  ) {
    return false;
  }

  if (setHistory.has(yesterdayISO)) return false;

  // Check if yesterday was covered by an active freeze
  // For legacy date strings and new timestamps, we check if any freeze
  // was active during yesterday
  const wasYesterdayFrozen = (freezeHistory?: string[]) =>
    freezeHistory?.some((f) => {
      const frozenAt = new Date(f).getTime();
      const yesterdayStart = new Date(yesterdayISO).getTime();
      const yesterdayEnd = yesterdayStart + 24 * 60 * 60 * 1000;
      // Freeze was set sometime during yesterday or the day before (covers yesterday)
      return frozenAt >= yesterdayStart - 24 * 60 * 60 * 1000 && frozenAt < yesterdayEnd;
    });

  if (
    wasYesterdayFrozen(habit.freezeHistory) ||
    wasYesterdayFrozen(justCheckedInHabit.freezeHistory)
  ) {
    return false;
  }

  return true;
};

export const isTargetDay = (targetDays: number[], date: Date): boolean => new Set(targetDays).has(date.getDay());

export const getLastTargetDayBefore = (
  targetDays: number[],
  fromDate: Date
): Date => {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 7; i++) {
    if (new Set(targetDays).has(d.getDay())) return d;
    d.setDate(d.getDate() - 1);
  }
  return d;
};

/**
 * Walks forwards from `fromDate` (exclusive) to find the next calendar date
 * that falls on one of the targetDays. Used to compute freeze expiry.
 */
export const getNextTargetDayAfter = (
  targetDays: number[],
  fromDate: Date
): Date => {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  for (let i = 0; i < 7; i++) {
    if (new Set(targetDays).has(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
};

const areIntermediateTargetDaysCovered = (
  targetDays: number[],
  afterISO: string,
  beforeISO: string,
  historySet: Set<string>,       // pass in — caller already built this
  freezeHistory: string[],
  habitTargetDays: number[],
): boolean => {
  // Pre-compute freeze coverage: for each freeze, which target-day ISO dates
  // does it cover? Build a Set once instead of recomputing per day in the walk.
  const coveredByFreeze = new Set<string>();
  for (const f of freezeHistory) {
    const frozenAt = new Date(f);
    // This freeze covers from its timestamp until 06:00 on the next target day
    const expiresAt = getNextTargetDayAfter(habitTargetDays, frozenAt);
    expiresAt.setHours(6, 0, 0, 0);

    // Walk forward from freeze date and mark every target day it covers
    const cursor = new Date(frozenAt);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1); // start from day after freeze
    while (cursor < expiresAt) {
      if (habitTargetDays.includes(cursor.getDay())) {
        coveredByFreeze.add(cursor.toISOString().split("T")[0]);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Forward-walk between afterISO and beforeISO, check each target day
  const end = new Date(beforeISO);
  end.setHours(0, 0, 0, 0);
  const cursor = new Date(afterISO);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1); // exclusive start

  while (cursor < end) {
    if (targetDays.includes(cursor.getDay())) {
      const iso = cursor.toISOString().split("T")[0];
      if (!historySet.has(iso) && !coveredByFreeze.has(iso)) {
        return false; // early exit — uncovered target day found
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return true;
};

const isFreezeEntryActive = (
  freezeTimestamp: string,
  frequency: "daily"|"weekly",
  targetDays?: number[]
): boolean => {
  const frozenAt = new Date(freezeTimestamp);
  const now = new Date();

  if (!targetDays || targetDays.length === 0) {
    if (frequency === "daily")
    return now.getTime() - frozenAt.getTime() < 24 * 60 * 60 * 1000;
  else
    return now.getTime() - frozenAt.getTime() < 7 * 24 * 60 * 60 * 1000;
  }

  const nextTarget = getNextTargetDayAfter(targetDays, frozenAt);
  nextTarget.setHours(6, 0, 0, 0); // 06:00 on next target day
  return now < nextTarget;
};

export const isFrozen = (habit: Habit): boolean => {
  if (!habit.freezeHistory || habit.freezeHistory.length === 0) return false;
  const last = habit.freezeHistory[habit.freezeHistory.length - 1];
  return isFreezeEntryActive(last, habit.frequency, habit.targetDays);
};

export const freezeHabit = (habit: Habit): FreezeResult => {
  const today = new Date();

  // Freezing a non-target day protects nothing — streak doesn't run those days
  if (habit.targetDays && habit.targetDays.length > 0) {
    if (!isTargetDay(habit.targetDays, today)) {
      return { status: "denied", reason: "not_a_target_day" };
    }
  }
  if (isCompletedToday(habit || isCompletedInLast7Days(habit))) {
    return { status: "denied", reason: "already_checked_in" };
  }
  if (isFrozen(habit)) {
    return { status: "denied", reason: "already_frozen" };
  }

  if (habit.streakFreezes === 0) {
    return { status: "denied", reason: "no_freezes_left" };
  }

  return {
    status: "success",
    habit: {
      ...habit,
      streakFreezes: habit.streakFreezes - 1,
      // Store full timestamp — this is the key change that enables 24h windows
      freezeHistory: [...(habit.freezeHistory || []), getNowISO()],
    },
  };
};

export const checkInHabit = (habit: Habit): CheckInResult => {
  const today = new Date();
  const todayISO = getTodayISO();
  let workingHabit = habit;
  if (
    habit.pendingStreakResetAfter &&
    new Date() >= new Date(habit.pendingStreakResetAfter)
  ) {
    workingHabit = {
      ...habit,
      streak: 0,
      pendingStreakResetAfter: undefined,
    };
  }
  // Target day gate — shake if user tries to check in on a non-target day
  if (workingHabit.targetDays && workingHabit.targetDays.length > 0) {
    if (!isTargetDay(workingHabit.targetDays, today)) {
      return { status: "denied", reason: "not_a_target_day" };
    }
  }
  if (isCompletedToday(workingHabit)) {
    return { status: "denied", reason: "already_checked_in" };
  }

  if (isFrozen(workingHabit)) {
    return { status: "denied", reason: "frozen" };
  }
  // ── Streak continuity check ──────────────────────────────────────────────
  // Compare calendar dates only (no time component) to decide if the streak
  // is continuous. We look at the last check-in date, not a timestamp.
  const lastDateStr = workingHabit.history[habit.history.length - 1];
  let isStreakContinuous = false;
  if (!lastDateStr) {
    isStreakContinuous = true; // First ever check-in
  } else if (workingHabit.targetDays && workingHabit.targetDays.length > 0) {
    const historySet = new Set(workingHabit.history);
    isStreakContinuous = areIntermediateTargetDaysCovered(
      workingHabit.targetDays,
      lastDateStr,
      todayISO,
      historySet,                    // O(1) lookups
      workingHabit.freezeHistory || [],
      workingHabit.targetDays,
    );
  } else {
    // Diff in whole calendar days between last check-in date and today
    const lastDate = new Date(lastDateStr);
    const todayDate = new Date(todayISO);
    const diffDays = Math.round(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (workingHabit.frequency === "daily") {
      // 1 day gap = checked in yesterday → continuous
      isStreakContinuous = diffDays <= 1;
    } else if (workingHabit.frequency === "weekly") {
      isStreakContinuous = diffDays <= 7;
    }
  }

  const newStreak = isStreakContinuous ? workingHabit.streak + 1 : 1;

  // ── Streak milestone: earn a freeze ─────────────────────────────────────
  let newFreezes = workingHabit.streakFreezes;
  if (newStreak % STREAK_MILESTONE === 0 && newFreezes < MAX_FREEZES) {
    newFreezes += 1;
  }

  const updatedHabit: Habit = {
    ...workingHabit,
    history: [...workingHabit.history, todayISO],
    streak: newStreak,
    longestStreak: Math.max(workingHabit.longestStreak || 0, newStreak),
    streakFreezes: newFreezes,
  };

  if (newStreak === workingHabit.goal) {
    return { status: "goal_reached", habit: updatedHabit };
  }

  return { status: "success", habit: updatedHabit };
};

export const restartHabitAfterGoalForeground = (habit: Habit): Habit => {
  if (habit.pendingStreakResetAfter && new Date() >= new Date(habit.pendingStreakResetAfter))
    return {
      ...habit,
      streak: 0,
      pendingStreakResetAfter: undefined,
    };

  return habit;

}
export const restartHabitAfterGoal = (habit: Habit, oldGoal: number): Habit => {
  // Compute when the current check-in window closes
  let resetAfter: string;

  if (habit.targetDays) {

    // Next target day at 06:00 — same boundary used by freeze expiry
    if(habit.targetDays.length > 0)
    {
      const next = getNextTargetDayAfter(habit.targetDays, new Date());
      next.setHours(6, 0, 0, 0);
      resetAfter = next.toISOString();
    }
    else{
      const next = new Date(new Date().setDate(new Date(habit.history[habit.history.length - 1]).getDate() + 7));
      next.setHours(0,0,0,0);
      resetAfter = next.toISOString()
    }
  } else {
    // Midnight tonight — start of the next calendar day
    if(habit.frequency === "weekly"){
      const next = new Date(new Date().setDate(new Date(habit.history[habit.history.length - 1]).getDate() + 7));
      next.setHours(0,0,0,0);
      resetAfter = next.toISOString()
    }
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // next midnight
    resetAfter = midnight.toISOString();
  }

  return {
    ...habit,
    pendingStreakResetAfter: resetAfter,
    goalCompletions: [
      ...(habit.goalCompletions || []),
      { completedAt: getNowISO(), goal: oldGoal },
    ],
    // streak intentionally NOT reset here — happens on next check-in
  };
};

//!NOT SO OLD Logic
/* const isFreezeActive = (freezeTimestamp: string): boolean => {
  const frozenAt = new Date(freezeTimestamp).getTime();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  return Date.now() - frozenAt < TWENTY_FOUR_HOURS;
};
export const isFrozen = (habit: Habit) => {
  if (!habit.freezeHistory ||habit.freezeHistory.length === 0) return false;
  const lastFreeze = habit.freezeHistory[habit.freezeHistory.length - 1];
   return isFreezeActive(lastFreeze);
   if (!lastFreeze) return false;
  const lastFreezeDate = new Date(lastFreeze);
  const getToday = () => new Date(new Date().toISOString().split("T")[0]);
  const diff =
    (getToday().getTime() - lastFreezeDate.getTime()) / (1000 * 3600 * 24);
  return diff < 1; // Consider frozen if last freeze was within the last dayd
}; */


//!OLD LOGICS
/* export const checkInHabit = (habit: Habit): Habit => {
  const todayISO = getTodayISO();

  // Prevent double check-in
  if (habit.history.includes(todayISO) || isFrozen(habit)) return habit;

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
    const todayDate = new Date(todayISO);
    console.log('Last Date:', lastDate, 'Today:', todayDate);
    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
    console.log('Diff Time (ms):', diffTime);
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
    longestStreak: Math.max(habit.longestStreak || 0, isStreakContinuous ? newStreak : 1),
    streakFreezes: newFreezes
  };
}; */

//!FIXME calculateStreak: maybe needed later
/* export const calculateStreak = (habit: Habit): number => {
  const sortedHistory = [...habit.history].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (sortedHistory.length === 0) return 0;

  let currentStreak = 0;
  let today = new Date();
  // Normalize today to midnight to avoid time conflicts
  today.setHours(0, 0, 0, 0);

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
}; */

/* export const freezeHabit = (habit: Habit): Habit => {
  const todayISO = getTodayISO();
  // Prevent double check-in
  if (habit.freezeHistory?.includes(todayISO)) return habit;

  const newFreezeHistory = [...(habit.freezeHistory || []), todayISO];
  const newFreezes = habit.streakFreezes > 0 ? habit.streakFreezes - 1 : 0;

  return {
    ...habit,
    streakFreezes: newFreezes,
    freezeHistory: newFreezeHistory,
    // Streak is preserved (maintained at current value)
  };
} */