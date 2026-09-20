import { useHabitStore } from "@/stores/use-habit-store";
import { checkInHabit, freezeHabit, restartHabitAfterGoal } from "@/utils/habit-utils";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";
import { GlobalMetricKey } from "@/types/metrics";
import { Habit } from "@/types/habits";
import { cancelReminder, scheduleReminderHabits } from "@/hooks/use-notifications";

export type CheckInOutcome =
    | "success"
    | "goal_reached"
    | "already_checked_in"
    | "frozen"
    | "not_a_target_day"
    | "habit_not_found";

export async function addHabitWithEffects(habit: Habit, actor: 'user' | 'ai' = 'user'): Promise<void> {
    if (habit.reminder) {
        const notificationId = await scheduleReminderHabits(habit);
        habit.notificationId = notificationId;
    }
    await useHabitStore.getState().addHabit(habit);
    metricsEventBus.emit("metric:track", { keys: ["habitsAdded"], amount: 1, actor });
}

export async function editHabitWithEffects(habit: Habit, actor: 'user' | 'ai' = 'user'): Promise<void> {

    const oldHabit = useHabitStore.getState().habitsById[habit.id];

    if (!oldHabit) throw new Error(`Habit ${habit.id} not found`);
    if (oldHabit.reminder && oldHabit.notificationId) {
        await cancelReminder(oldHabit.notificationId);
    }
    if (habit.reminder) {
        const notificationId = await scheduleReminderHabits(habit);
        habit.notificationId = notificationId;
    }

    await useHabitStore.getState().editHabit(habit);
    metricsEventBus.emit("metric:track", { keys: ["habitsEdited"], amount: 1, actor });
}

export async function deleteHabitWithEffects(id: string, actor: 'user' | 'ai' = 'user'): Promise<void> {
    const habit = useHabitStore.getState().habitsById[id];
    if (!habit) throw new Error(`Habit ${id} not found`);
    if (habit.notificationId) {
        cancelReminder(habit.notificationId);
    }
    await useHabitStore.getState().removeHabit(id);
    if (habit.streak < habit.goal && history.length === 0) {
        metricsEventBus.emit("metric:track", { keys: ["habitsDeleted", "habitsAbandoned"], amount: 1, actor });
    }
    else {
        metricsEventBus.emit("metric:track", { keys: ["habitsDeleted"], amount: 1, actor });
    }
}

export async function deleteAllHabitsWithEffects(actor: 'user' | 'ai' = "user"): Promise<void> {
    const DeletedHabits = Object.values(useHabitStore.getState().habitsById);
    const noOfDeletedHabits = DeletedHabits.length;
    await useHabitStore.getState().removeHabits();
    metricsEventBus.emit("metric:track", { keys: ["habitsDeleted"], amount: noOfDeletedHabits, actor });
    let noOfAbandonedHabits = 0;
    for (const habit of DeletedHabits) {
        if (habit.streak < habit.goal && history.length === 0) { noOfAbandonedHabits += 1; }
    }
    metricsEventBus.emit("metric:track", { keys: ["habitsAbandoned"], amount: noOfAbandonedHabits, actor });

}


export async function checkInHabitWithEffects(id: string): Promise<CheckInOutcome> {
    const habit = useHabitStore.getState().habitsById[id];
    if (!habit) return "habit_not_found";

    const result = checkInHabit(habit);

    if (result.status === "denied") {
        return result.reason; // "already_checked_in" | "frozen" | "not_a_target_day"
    }

    const habitBefore = habit;
    await useHabitStore.getState().editHabit(result.habit);

    const metrics: GlobalMetricKey[] = ["habitsCheckedIn"];
    const now = new Date();
    const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const FOUR_AM = 4 * 3600;
    const EIGHT_AM = 8 * 3600;
    const TEN_PM = 22 * 3600;
    const TWO_AM = 2 * 3600;
    if (nowSecs >= FOUR_AM && nowSecs <= EIGHT_AM)
        metrics.push("habitsCheckedInBefore8am");
    else if (nowSecs >= TEN_PM || nowSecs <= TWO_AM)
        metrics.push("habitsCheckedInAfter10pm");

    if (habitBefore.streak < result.habit.streak) {
        metricsEventBus.emit("metric:track", {
            keys: result.habit.frequency === "daily" ? ["habitsStreakMaxDaily"] : ["habitsStreakMaxWeekly"],
            amount: result.habit.streak,
        });
    }

    if (
        (!habitBefore.freezeHistory && result.habit.freezeHistory) ||
        (habitBefore.freezeHistory &&
            result.habit.freezeHistory &&
            habitBefore.freezeHistory.length < result.habit.freezeHistory.length)
    ) {
        metrics.push("habitsFrozen");
    }

    metricsEventBus.emit("metric:track", { keys: metrics, amount: 1, actor: "user" });

    if (result.status === "goal_reached") {
        metricsEventBus.emit("metric:track", { keys: ["habitsGoalsCompleted"], amount: 1 });
        return "goal_reached";
    }
    return "success";
}

export async function freezeHabitWithEffects(id: string): Promise<"success" | "already_frozen" | "no_freezes_left" | "not_a_target_day" | "already_checked_in" | "habit_not_found"> {
    const habit = useHabitStore.getState().habitsById[id];
    if (!habit) return "habit_not_found";

    const result = freezeHabit(habit);
    if (result.status === "denied") return result.reason;

    await useHabitStore.getState().editHabit(result.habit);
    metricsEventBus.emit("metric:track", { keys: ["habitsFrozen"], amount: 1 });
    return "success";
}

export async function restartHabitWithEffects(habit: Habit, actor: 'user' | 'ai' = 'user'): Promise<void> {
    const oldHabit = useHabitStore.getState().habitsById[habit.id];
    if (!oldHabit) throw new Error(`Habit ${habit.id} not found`);
    const result = restartHabitAfterGoal(habit, oldHabit.goal);
    await useHabitStore.getState().editHabit(result);
    metricsEventBus.emit("metric:track", { keys: ["habitGoalsRestarted"], amount: 1 });
}

export function setHabitOrderWithEffects(habits: string[]): void {
    useHabitStore.getState().setHabitOrder(habits);
}
export function reassignHabitCategoryWithEffects(oldId: string, newId: string): void {
    useHabitStore.getState().reassignHabitCategoryLocal(oldId, newId);
}

export function reassignHabitTagWithEffects(oldId: string, newId: string | null): void {
    useHabitStore.getState().reassignHabitTagLocal(oldId, newId);
}

export function habitCountWithEffects(): Promise<number> {
    return useHabitStore.getState().habitCount();
}

export async function batchMutateHabitsWithEffects(habitsToMutate: Habit[], newValues: any): Promise<void> {
    await useHabitStore.getState().batchMutateHabits(habitsToMutate, newValues);
}

export async function batchRestoreHabitsWithEffects(originalHabits: Habit[]): Promise<void> {
    useHabitStore.getState().batchRestoreHabits(originalHabits);
}