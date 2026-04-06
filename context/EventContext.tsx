import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import {
  getAllCalendarEvents,
  insertCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/db/repositories/event-repository";

import { CalendarEvent } from "@/types/calendar";
import { useData } from "@/hooks/use-data";
import { cancelReminder } from "@/hooks/use-notifications";

interface EventContextType {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  addEvent: (event: CalendarEvent) => Promise<void>;
  editEvent: (event: CalendarEvent) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  deleteEventOccurrence: (
    eventId: string,
    date: string,
    all: boolean,
  ) => Promise<void>;
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
        (prev) => prev.map((e) => (e.id === event.id ? event : e)),
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

  const deleteEventOccurrence = async (
      eventId: string,
      date: string,
      all: boolean,
    ) => {
      const event = events.find((e) => e.id === eventId);
      if (!event) return; //TODO add feedback?
      //TODO what if there is just one occurence and user doesnt choose delete all, UI doesnt show, but DB still has it
      if (all) {
        // cancel all notifications
        //event.notificationIds?.forEach((n) => cancelReminder(n.id));
        console.log("Context id", eventId);
        await removeEvent(eventId);
        return ;
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
        deleteEventOccurrence,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}
