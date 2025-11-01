import { useMemo, useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { getEventsForDate } from "@/utils/event-utils";

export const useCalendarState = (events: CalendarEvent[]) => {
const [currentView, setCurrentView] = useState<'day'|'month'>('month');
const [selectedDate, setSelectedDate]=useState(new Date());

 const filteredEvents = useMemo(() => {
    return getEventsForDate(events, selectedDate);
  }, [events, selectedDate]);

return {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
};
};
