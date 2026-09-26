import { useMemo, useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { getEventsForDate } from "@/utils/event-utils";
import { selectedDateEventIds, useEventStore } from "@/stores/use-event-store";
import { useShallow } from "zustand/shallow";

export const useCalendarState = () => {
  const [currentView, setCurrentView] = useState<'day' | 'month'>('month');
  let today = new Date()
  const [selectedDate, setSelectedDate] = useState(today);

  const filteredEvents =
    useEventStore(
      useShallow((state) => {

        return selectedDateEventIds(state, selectedDate);
      }),
    );
  ;

  return {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
  };
};
