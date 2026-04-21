import { AIHandler } from "@/types/ai-handler";
import { cancelReminder, scheduleReminderEvents } from "../../hooks/use-notifications";
import { createEvent } from "../model-factory-utils";
import { getTimeRangeHelper } from "./additional-handlers";

//! 59567 Port for qbitorent
export const AddEventHandler: AIHandler = {
  execute: async (params, context) => {
    const newEvent = await createEvent(params);
    if (newEvent.reminder) {
      try {
        newEvent.notificationIds = await scheduleReminderEvents(newEvent);
      } catch (error) {
        console.warn("Failed to schedule event notifications:", error);
        return { status: "partial_success", reason: "Failed to schedule notification", task: newEvent };
      }
    }

    await context.addEvent(newEvent);
    console.log(`AI Action: Added event "${newEvent.title}"`);
    return { status: "success", event: newEvent };
  }

}

export const EditEventHandler: AIHandler = {
  execute: async (params, context) => {
    const oldEvent = context.events.find((e) => e.id.slice(0, 8) === params.id)
    if (!oldEvent) throw new Error("Event not found");
    const updatedEvent = await createEvent({ ...oldEvent, ...params, id: oldEvent.id })
    if (updatedEvent.reminder) {
      try {
        if (oldEvent.notificationIds?.length) {
          const cancelPromises = oldEvent.notificationIds.map((n) =>
            cancelReminder(n.id)
          );
          await Promise.all(cancelPromises);
        }
        updatedEvent.notificationIds = await scheduleReminderEvents(updatedEvent);
      } catch (error) {
        console.warn("Failed to schedule event notifications:", error);
        return { status: "partial_success", reason: "Failed to schedule notifications", task: updatedEvent };
      }
    }
    await context.editEvent(updatedEvent);
    return { status: "success", event: updatedEvent };
  }
};
export const DeleteEventSingleOccurrenceHandler: AIHandler = {
  execute: async (params, context) => {
    const oldEvent = context.events.find((e) => e.id.slice(0, 8) === params.id)
    if (!oldEvent) throw new Error("Event not found");
    await context.deleteEventOccurrence(oldEvent.id, params.date, false);
    return { status: "success", event: oldEvent };
  }
};

export const DeleteEventHandler: AIHandler = {
  execute: async (params, context) => {
    const oldEvent = context.events.find((e) => e.id.slice(0, 8) === params.id)
    if (!oldEvent) throw new Error("Event not found");
    if (oldEvent.notificationIds?.length) {
      const cancelPromises = oldEvent.notificationIds.map((n) =>
        cancelReminder(n.id)
      );
      await Promise.all(cancelPromises);
    }
    await context.removeEvent(oldEvent.id);
    return { status: "success", event: oldEvent };
  }
};

export const QueryEventsHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { timeRange = "today", timeOfDay = "all", specificEventId } = args;
    const now = new Date();

    // DEEP DIVE: If AI asks about a specific event (e.g., "How many yoga classes left?")
    if (specificEventId) {
      const targetEvent = context.events.find((e: any) => e.id.slice(0, 8) === specificEventId);
      if (!targetEvent) return { error: "Event not found" };

      // Calculate Remaining Instances natively
      let instancesLeft = 0;
      const end = new Date(targetEvent.endDate);

      if (end >= now) {
        if (targetEvent.recurrence === 'none') instancesLeft = 1;
        if (targetEvent.recurrence === 'daily') {
          instancesLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24));
        }
        if (targetEvent.recurrence === 'weekly') {
          instancesLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24 * 7));
        }

        // Subtract future deleted occurrences
        const futureDeleted = (targetEvent.deletedOccurrences || []).filter((d: string) => new Date(d) >= now).length;
        instancesLeft = Math.max(0, instancesLeft - futureDeleted);
      }

      return {
        output: {
          id: targetEvent.id,
          title: targetEvent.title,
          recurrence: targetEvent.recurrence,
          instancesRemaining: instancesLeft,
          deletedOccurrences: targetEvent.deletedOccurrences || [],
          starts: targetEvent.startDate,
          ends: targetEvent.endDate
        }
      };
    }

    // GENERAL QUERY (Time Ranges and Time of Day)
    let filtered = [...(context.events || [])];
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    // Filter by Time Of Day (Ignoring date part, just looking at hours)
    if (timeOfDay !== "all") {
      filtered = filtered.filter(e => {
        const hours = new Date(e.startTime).getHours();
        if (timeOfDay === "morning") return hours >= 5 && hours < 12;
        if (timeOfDay === "afternoon") return hours >= 12 && hours < 17;
        if (timeOfDay === "evening") return hours >= 17 && hours <= 23;
        return true;
      });
    }

    const { rangeStart, rangeEnd } = getTimeRangeHelper(timeRange);
    filtered = filtered.filter(e => {
      const eventStart = new Date(e.startDate);
      const eventEnd = e.endDate ? new Date(e.endDate) : null;
      if (!rangeStart || !rangeEnd) return true;
      return eventStart <= rangeEnd && (eventEnd ?? eventStart) >= rangeStart;
    });

    return {
      output: filtered.map(e => ({
        id: e.id.slice(0, 8),
        title: e.title,
        time: e.startTime, // AI can read the time
        recurrence: e.recurrence
      }))
    };
  }
};