import { AIHandler } from "@/types/ai-handler";
import { cancelReminder, scheduleReminderEvents } from "@/hooks/use-notifications";
import { createEvent } from "@/utils/model-factory-utils";
import { getTimeRangeHelper } from "./additional-handlers";
import { resolveIdsFromNames } from "./tags-and-categories-handlers";

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
    const { id, embedding, ...rest } = newEvent;
    return { status: "success", event: { id: id.slice(0, 8), ...rest } };
  }

}

export const EditEventHandler: AIHandler = {
  execute: async (params, context) => {
    const oldEvent = context.events.find((e) => e.id.slice(0, 8) === params.id)
    if (!oldEvent) throw new Error("Event not found");
    let currentTags = Array.isArray(oldEvent.tags) ? [...oldEvent.tags] : [];

    if (params.addTagIds && Array.isArray(params.addTagIds)) {
      currentTags = [...new Set([...currentTags, ...params.addTagIds])];
    }

    if (params.removeTagIds && Array.isArray(params.removeTagIds)) {
      currentTags = currentTags.filter(id => !params.removeTagIds.includes(id));
    }
    const updatedEvent = await createEvent({ ...oldEvent, ...params, tags: currentTags, id: oldEvent.id })
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
    const { id, embedding, ...rest } = updatedEvent;
    return { status: "success", event: { id: id.slice(0, 8), ...rest } };
  }
};
export const DeleteEventSingleOccurrenceHandler: AIHandler = {
  execute: async (params, context) => {
    const oldEvent = context.events.find((e) => e.id.slice(0, 8) === params.id)
    if (!oldEvent) throw new Error("Event not found");
    await context.deleteEventOccurrence(oldEvent.id, params.date, false);
    const { id, title } = oldEvent;
    return { status: "success", event: { id: id.slice(0, 8), title } };
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
    const { id, title } = oldEvent;
    return { status: "success", event: { id: id.slice(0, 8), title } };
  }
};

export const QueryEventsHandler: AIHandler = {
  execute: async (args: any, context: any) => {
    const { timeRange = "today", timeOfDay = "all", specificEventId, categoryName,
      tagNames } = args;
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
          id: targetEvent.id.slice(0, 8),
          t: targetEvent.title,
          d: targetEvent.description || '',
          r: targetEvent.recurrence,
          instancesRemaining: instancesLeft,
          do: targetEvent.deletedOccurrences || [],
          sd: targetEvent.startDate,
          st: targetEvent.startTime.split('T')[1],
          ed: targetEvent.endDate || '',
          et: targetEvent.endTime.split('T')[1],
          rem: targetEvent.reminder ? 1 : 0,
          tg: targetEvent.tags || [],
          cat: targetEvent.category || "",
          ct: targetEvent.createdAt,
          ut: targetEvent.updatedAt,
        }
      };
    }
    const targetCategoryId = categoryName ? resolveIdsFromNames(categoryName, context.categories)[0] : undefined;
    const targetTagIds = tagNames ? resolveIdsFromNames(tagNames, context.tags) : [];
    // GENERAL QUERY (Time Ranges and Time of Day)
    let filtered = [...(context.events || [])];
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    if (targetCategoryId) {
      filtered = filtered.filter(e => e.category === targetCategoryId);
    }

    if (targetTagIds.length > 0) {
      filtered = filtered.filter(e =>
        targetTagIds.every((tagId: string) => e.tags?.includes(tagId))
      );
    }
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
        i: e.id.slice(0, 8),
        t: e.title,
        d: e.description || '',
        r: e.recurrence,
        do: e.deletedOccurrences || [],
        sd: e.startDate,
        st: e.startTime.split('T')[1], // AI can read the time
        ed: e.endDate || '',
        et: e.endTime.split('T')[1],
        tg: e.tags || [],
        rem: e.reminder ? 1 : 0,
        cat: e.category || "",
        ct: e.createdAt,
        ut: e.updatedAt
      }))
    };
  }
};