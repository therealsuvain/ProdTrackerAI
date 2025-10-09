import { useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { getEventsForDate } from "@/utils/eventUtils";

export const useCalendarState = (events: CalendarEvent[]) => {
const [currentView, setCurrentView] = useState<'day'|'month'>('month');
const [selectedDate, setSelectedDate]=useState(new Date());

const filteredEvents = getEventsForDate(events, selectedDate);

return {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
};
};
