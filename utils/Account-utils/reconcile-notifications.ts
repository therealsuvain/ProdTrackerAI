// notifications/reconcile-notifications.ts
import * as Notifications from "expo-notifications";

import {
  cancelReminder,
  scheduleReminderEvents,
  scheduleReminderHabits,
  scheduleReminderTasks,
} from "@/hooks/use-notifications";

import type { Task } from "@/types/task";
import type { Habit } from "@/types/habits";
import type { CalendarEvent } from "@/types/calendar";

type PulledData = {
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
};

type NotificationReconcileOptions = {
  rescheduleTasks?: boolean;
  rescheduleHabits?: boolean;
  rescheduleEvents?: boolean;
};

export async function reconcileNotificationsForPulledData(
  data: PulledData,
  options: NotificationReconcileOptions = {},
): Promise<void> {
  const {
    rescheduleTasks = true,
    rescheduleHabits = true,
    rescheduleEvents = true,
  } = options;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map((request) => request.identifier));

  if (rescheduleTasks) {
    for (const task of data.tasks) {
      if (!task.reminder || !task.reminderDate) continue;

      if (task.notificationId && scheduledIds.has(task.notificationId)) {
        continue;
      }

      const notificationId = await scheduleReminderTasks(task);
      // Important: return this ID to the caller so it can persist it in the
      // local SQLite task row. Do not push it to cloud.
      task.notificationId = notificationId;
    }
  }

  if (rescheduleHabits) {
    for (const habit of data.habits) {
      if (!habit.reminder || !habit.reminderDate) continue;

      if (habit.notificationId && scheduledIds.has(habit.notificationId)) {
        continue;
      }

      const notificationId = await scheduleReminderHabits(habit);
      habit.notificationId = notificationId;
    }
  }

  if (rescheduleEvents) {
    for (const event of data.events) {
      if (!event.reminder) continue;

      const existingIds = (event.notificationIds ?? []).map((entry) =>
        typeof entry === "string" ? entry : entry.id,
      );

      const hasAnyScheduledId = existingIds.some((id) => scheduledIds.has(id));
      if (hasAnyScheduledId) continue;

      const notificationIds = await scheduleReminderEvents(event);
      event.notificationIds = notificationIds;
    }
  }
}