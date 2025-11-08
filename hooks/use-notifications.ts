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

const getTriggerOptionsEvent = (time: Date, event: CalendarEvent) => {
  if (event.recurrence === "daily") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.getHours(),
      minute: time.getMinutes(),
    } as Notifications.DailyTriggerInput;
  }
  if (event.recurrence === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: time.getDay() + 1,
      hour: time.getHours(),
      minute: time.getMinutes(),
    } as Notifications.WeeklyTriggerInput;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: time,
  } as Notifications.DateTriggerInput;
};

const getTriggerOptionsHabit = (habit: Habit) => {
  if (habit.frequency === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: habit.reminderDate?.getDay() || 0 + 1,
      hour: habit.reminderDate?.getHours(),
      minute: habit.reminderDate?.getMinutes(),
    } as Notifications.WeeklyTriggerInput;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: habit.reminderDate?.getHours(),
    minute: habit.reminderDate?.getMinutes(),
  } as Notifications.DailyTriggerInput;
};

export const scheduleReminderEvents = async (
  event: CalendarEvent
): Promise<string> => {
  const triggerDate = new Date(event.startTime.getTime());

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming event",
      body: `${event.title} starts soon`,
    },
    trigger: getTriggerOptionsEvent(triggerDate, event),
  });
  return id;
};

export const scheduleReminderTasks = async (task: Task): Promise<string> => {
  const triggerDate = new Date(task.reminderDate?.getTime() || Date.now());

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
