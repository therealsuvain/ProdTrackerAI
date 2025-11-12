import { useMemo, useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { getEventsForDate } from "@/utils/event-utils";

export const useCalendarState = (events: CalendarEvent[]) => {
const [currentView, setCurrentView] = useState<'day'|'month'>('month');
let today=new Date().setHours(5,30,0,0)
const [selectedDate, setSelectedDate]=useState(new Date(today));

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
