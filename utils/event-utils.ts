import { CalendarEvent } from "@/types/calendar";

//Get events for a specific date
export const getEventsForDate = (
  events: CalendarEvent[],
  date: Date
): CalendarEvent[] => {
  const filtered: CalendarEvent[] = [];
  events.forEach((event) => {
    const eventDate = new Date(event.startDate);
    if (eventDate.toDateString() === date.toDateString()) {
      filtered.push(event);
    }
  });
  return sortEventsByTime(filtered);
};

export const sortEventsByTime = (
  filtered: CalendarEvent[]
): CalendarEvent[] => {
  return [...filtered].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
};

export const calculateMarketDates = (
  events: CalendarEvent[]
): Record<string, { marked: boolean; dotColor: string }> => {
  const marked: Record<string, { marked: boolean; dotColor: string }> = {};
  events.forEach((event) => {
    const dateStr = event.startTime.toISOString().split("T")[0];
    marked[dateStr] = { marked: true, dotColor: "blue" };
    if (event.recurrence === "daily" || event.recurrence === "weekly") {
      let nextDate = new Date(event.startDate);
      let endDate = new Date(
        event.endDate
          ? event.endDate
          : event.recurrence === "daily"
          ? event.startDate.getDate() + 1
          : event.startDate.getDate() + 7
      );
      let endPoint = Math.ceil(
        (endDate.getDate() - nextDate.getDate()) / (1000 * 60 * 60 * 24)
      );
      console.log("endtime", endDate);
      console.log("days", endPoint);
      for (let i = 0; i < endPoint; i++) {
        nextDate = new Date(nextDate);
        nextDate.setDate(
          nextDate.getDate() + (event.recurrence === "daily" ? 1 : 7)
        );
        const nextStr = nextDate.toISOString().split("T")[0];
        marked[nextStr] = { marked: true, dotColor: "#F44336" };
      }
    }
  });
  return marked;
};

export const validateEventTimes = (start: Date, end?: Date): boolean => {
  return !end || start < end;
};
