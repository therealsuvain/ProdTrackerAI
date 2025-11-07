import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { CalendarEvent } from "@/types/calendar";
import { Task } from "@/types/task";

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

const getTriggerOptions = (time: Date, event: CalendarEvent) => {
    if (event.recurrence === "daily") {
    return  {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.getHours(),
      minute: time.getMinutes(),
    } as Notifications.DailyTriggerInput;
  } 
   if (event.recurrence === "weekly") {
    return  {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: time.getDay() + 1,
      hour: time.getHours(),
      minute: time.getMinutes(),
    } as Notifications.WeeklyTriggerInput;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date:time
  } as Notifications.DateTriggerInput

}
export const scheduleReminderEvents = async (
  event: CalendarEvent
): Promise<string> => {
  const triggerDate = new Date(event.startTime.getTime());
  
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming event",
      body: `${event.title} starts soon`,
    },
    trigger:getTriggerOptions(triggerDate, event),
  });
  return id;
};

export const scheduleReminderTasks = async (
  task: Task
): Promise<string> => {

  const triggerDate = new Date(task.reminderDate?.getTime()|| Date.now());
  
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming event",
      body: `${task.title} starts soon`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });
  return id;
};

export const cancelReminder = async (id: string) => {
  console.log("canclled notification");
  await Notifications.cancelScheduledNotificationAsync(id);
};
