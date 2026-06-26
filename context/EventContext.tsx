import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  batchRestore,
  batchUpdateEvents,
  countCalendarEvents,
  deleteAllCalendarEvents,
  deleteCalendarEvent,
  getAllCalendarEvents,
  insertCalendarEvent,
  updateCalendarEvent,
} from "@/db/repositories/event-repository";

import { useData } from "@/hooks/context-hooks/use-data";
import { cancelReminder } from "@/hooks/use-notifications";
import { CalendarEvent } from "@/types/calendar";

interface EventContextType {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  removeEvents: () => Promise<void>;
  deleteEventOccurrence: (
    eventId: string,
    date: string,
    all: boolean,
  ) => Promise<void>;
  reassignEventCategoryLocal: (oldId: string, newId: string) => void;
  reassignEventTagLocal: (oldId: string, newId: string) => void;
  eventCount: () => Promise<number>;
  batchMutateEvents: (
    eventsToMutate: CalendarEvent[],
    newValues: any,
  ) => Promise<void>;
  batchRestoreEvents: (originalEvents: CalendarEvent[]) => Promise<void>;
}

export const EventContext = createContext<EventContextType | undefined>(
  undefined,
);

export default function EventProvider({ children }: { children: ReactNode }) {
  const { dispatchError } = useData();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const optimisticCalendarEventMutation = useCallback(
    async (
      optimisticUpdate: (prev: CalendarEvent[]) => CalendarEvent[],
      dbWrite: () => Promise<void> | Promise<CalendarEvent>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: CalendarEvent[] = [];
      setEvents((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setEvents(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[EventContext] Event DB write failed, rolling back:",
          err,
        );
        setEvents(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addEvent = useCallback(
    async (event: CalendarEvent): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => [...prev, event],
        () => insertCalendarEvent(event),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const editEvent = useCallback(
    async (event: CalendarEvent): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => prev.map((e) => (e.id === event.id ? { ...event } : e)),
        () => updateCalendarEvent(event),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const removeEvent = useCallback(
    async (id: string): Promise<void> => {
      await optimisticCalendarEventMutation(
        (prev) => prev.filter((e) => e.id !== id),
        () => deleteCalendarEvent(id),
      );
    },
    [optimisticCalendarEventMutation],
  );

  const removeEvents = useCallback(async () => {
    await deleteAllCalendarEvents();
    setEvents([]);
  }, []);

  const eventCount = useCallback(async (): Promise<number> => {
    const result = await countCalendarEvents();
    return result ?? 0;
  }, []);

  const deleteEventOccurrence = async (
    eventId: string,
    date: string,
    all: boolean,
  ) => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return; //TODOX add feedback?
    if (all) {
      // cancel all notifications
      if (event.notificationIds?.length) {
        const cancelPromises = event.notificationIds.map((n) =>
          cancelReminder(n.id),
        );
        await Promise.all(cancelPromises);
      }
      //console.log("Context id", eventId);
      await removeEvent(eventId);
      return;
    }

    // cancel only the notification for that date
    const notifId = event.notificationIds?.find((n) => n.date === date)?.id;
    if (notifId) cancelReminder(notifId);

    await editEvent({
      ...event,
      deletedOccurrences: [...(event.deletedOccurrences || []), date],
      notificationIds: event.notificationIds?.filter((n) => n.date !== date),
    });
  };
  const reassignEventCategoryLocal = useCallback(
    (oldCategoryId: string, newCategoryId: string): void => {
      setEvents((prev) =>
        prev.map((e) =>
          e.category === oldCategoryId
            ? {
                ...e,
                category: newCategoryId,
              }
            : e,
        ),
      );
    },
    [],
  );

  const reassignEventTagLocal = useCallback(
    (oldTagId: string, newTagId: string | null): void => {
      setEvents((prev) =>
        prev.map((e) => {
          // If the task doesn'e have the old tag, return it untouched
          if (!e.tags?.includes(oldTagId)) return e;

          // Remove the old tag
          const filteredTags = e.tags.filter((id) => id !== oldTagId);

          // Add new tag securely
          if (newTagId && !filteredTags.includes(newTagId)) {
            filteredTags.push(newTagId);
          }

          return { ...e, tags: filteredTags };
        }),
      );
    },
    [],
  );

  const batchMutateEvents = useCallback(
    async (eventsToMutate: CalendarEvent[], newValues: any) => {
      // 1. Optimistic UI Update (0ms latency for the user)
      // useeventStore.getState().updateMany(eventIds, newValues);
      const eventIds = eventsToMutate.map((t) => t.id);
      await optimisticCalendarEventMutation(
        (prev) =>
          prev.map((e) => {
            if (!eventIds.includes(e.id)) return e;
            return {
              ...e,
              ...newValues,
              updatedAt: new Date().toISOString(),
            };
          }),
        () => batchUpdateEvents(eventsToMutate, newValues),
      );
    },
    [],
  );

  const batchRestoreEvents = useCallback(
    async (originalEvents: CalendarEvent[]) => {
      optimisticCalendarEventMutation(
        (prev) =>
          prev.map((t) => ({ ...t, updatedAt: new Date().toISOString() })),
        () => batchRestore(originalEvents),
      );
    },
    [],
  );
  //Loader
  useEffect(() => {
    const loadEvents = async () => {
      try {
        let loadedEvents = await getAllCalendarEvents();
        setEvents(loadedEvents);
      } catch (err) {
        console.error("[EventContext] Failed to initialise database:", err);
        dispatchError(
          `Failed to initialise database: ${err instanceof Error ? err.message : String(err)}`,
          "fatal",
        );
      } finally {
        setLoaded(true);
      }
    };
    loadEvents();
  }, []);

  return (
    <EventContext.Provider
      value={{
        events,
        setEvents,
        addEvent,
        editEvent,
        removeEvent,
        removeEvents,
        deleteEventOccurrence,
        reassignEventCategoryLocal,
        reassignEventTagLocal,
        eventCount,
        batchMutateEvents,
        batchRestoreEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}
