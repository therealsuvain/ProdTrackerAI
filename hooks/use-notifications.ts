import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { CalendarEvent } from "@/types/calendar";
import { Task } from "@/types/task";
import { Habit } from "@/types/habits";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

// TODO Test all notifications again
export const useNotifications = () => {
  const notificationListener = useRef<any>(undefined);

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      alert("Notification permission not granted");
    }
  };

  useEffect(() => {
    requestPermissions();
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification Received:", notification);
      });
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, []);
};

export const allScheduledNotificationsLogs = async () => {
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  // Each notification in the array has an 'identifier' property
  scheduledNotifications.forEach((notification) => {
    console.log(notification.identifier); // The notification ID
    console.log(notification.content);
    console.log(notification.trigger);
  });
};

export const cancelAllScheduledNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
const getTriggerOptionsHabit = (habit: Habit) => {
  const habitDate = (habit.reminderDate && new Date(habit.reminderDate)) || undefined;
  if (habit.frequency === "weekly") {

    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: habitDate?.getDay() || 0 + 1,
      hour: habitDate?.getHours(),
      minute: habitDate?.getMinutes(),
    } as Notifications.WeeklyTriggerInput;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: habitDate?.getHours(),
    minute: habitDate?.getMinutes(),
  } as Notifications.DailyTriggerInput;
};

export const scheduleReminderEvents = async (event: CalendarEvent) => {
  let ids: { date: string; id: string }[] = [];

  let current = new Date(event.startTime);
  const maxScheduledNotifications = 30; // optional limit (to avoid infinite scheduling)
  for (
    let i = 0;
    i < maxScheduledNotifications && current.getTime() < new Date(event.endDate ? event.endDate : current.setDate(current.getDate() + 30)).getTime();
    i++
  ) {
    if (
      !event.deletedOccurrences?.includes(current.toISOString().split("T")[0])
    ) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Upcoming event",
          body: `${event.title} starts soon`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: current,
        },
      });
      ids.push({ date: current.toISOString().split("T")[0], id });
    }

    if (event.recurrence === "daily")
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    else if (event.recurrence === "weekly")
      current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
    else break;
  }

  return ids;
};

export const scheduleReminderTasks = async (task: Task): Promise<string> => {
  const triggerDate = new Date((task.reminderDate && task.reminderDate) || Date.now());

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming Task",
      body: `${task.title} starts soon`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
  return id;
};

export const scheduleReminderHabits = async (habit: Habit): Promise<string> => {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Check in on your habit",
      body: `${habit.title}`,
    },
    trigger: getTriggerOptionsHabit(habit),
  });
  return id;
};

export const cancelReminder = async (id: string) => {
  console.log("canclled notification");
  await Notifications.cancelScheduledNotificationAsync(id);
};
