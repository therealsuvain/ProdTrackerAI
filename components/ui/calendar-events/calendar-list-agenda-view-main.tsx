import React, { useMemo, useCallback, useState, useEffect, useContext } from "react";
import { View, StyleSheet, Text } from "react-native";
import {
  Agenda,
  AgendaEntry,
  AgendaSchedule,
  DateData,
} from "react-native-calendars";
import { CalendarEvent } from "@/types/calendar";
import EventItem from "./event-item";
import { ThemeContext } from "@/context/ThemeContext";

interface CalendarListAgendaAltProps {
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string, date: string) => void;
}

export default function CalendarListAgendaMain({
  events,
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarListAgendaAltProps) {
  const {theme} = useContext(ThemeContext)
  const [items, setItems] = useState<AgendaSchedule>({});

  // Convert timestamp to date string
  const timeToString = (time: number) => {
    const date = new Date(time);
    return date.toISOString().split("T")[0];
  };

  const getEventsForSingleDay = useCallback((strTime: string, allEvents: any[]) => {
    
    const dayEvents = allEvents.filter((event) => {        
        const eventStartDate = new Date(event.startDate);
        eventStartDate.setHours(0, 0, 0, 0);
        const eventEndDate = new Date(event.endDate);
        eventEndDate.setHours(0, 0, 0, 0);

        // Current Day (Normalized)
        const currentDay = new Date(strTime);
        currentDay.setHours(0,0,0,0);
        const currentDayTime = currentDay.getTime();

        if (currentDayTime < eventStartDate.getTime()) return false;
        if (currentDayTime > eventEndDate.getTime()) return false;
        if (event.deletedOccurrences?.includes(strTime)) return false;

        const eventStartDateString = event.startDate.toISOString().split("T")[0];

        if (event.recurrence === "none" || !event.recurrence) {
          return eventStartDateString === strTime;
        }
        if (event.recurrence === "daily") return true;
        if (event.recurrence === "weekly") {
           return currentDay.getDay() === eventStartDate.getDay();
        }
        return false;
    });

    if (dayEvents.length > 0) {
      return dayEvents
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        .map((event) => ({
          name: event.title,
          height: 40,
          day: strTime,
          event: event,
          occurence: strTime,
        }));
    }
    return [];
  }, []);

  const loadItems = (day: DateData) => {
    // We must use the functional form of setItems to prevent an infinite loop
    setItems((prevItems) => {
      const newItems: AgendaSchedule = { ...prevItems };
      let itemsWereAdded = false; // Flag to check if we're adding new data

      // Load events for 2 months range (1 month before and 1 month after)
      for (let i = -30; i < 30; i++) {
        const time = day.timestamp + i * 24 * 60 * 60 * 1000;
        const strTime = timeToString(time);
        //console.log("strTime", strTime)
        // Only load if we haven't already
        if (!newItems[strTime]) {
          newItems[strTime] = getEventsForSingleDay(strTime, events);
          itemsWereAdded = true; // Mark that we're adding new days
        }
      }

      // If we didn't add any new date keys, return the *previous* state
      // This is crucial to stop the infinite loop
      if (!itemsWereAdded) {
        return prevItems;
      }

      // Otherwise, return the new object
      //console.log(newItems);
      return newItems;
    });
  }; // Only depend on `events`

  useEffect(() => {
    const today = new Date();
    const timestamp = today.getTime();
    const dateData: DateData = {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
      timestamp,
      dateString: today.toISOString().split("T")[0],
    };
    loadItems(dateData);
  }, [events, loadItems]);

  useEffect(() => {
    setItems((prevItems) => {
      // 1. Get all dates currently loaded in the calendar
      const loadedDates = Object.keys(prevItems);
      
      // If nothing is loaded yet, do nothing
      if (loadedDates.length === 0) return prevItems;

      // 2. Create a shallow copy
      const newItems = { ...prevItems };

      // 3. Force recalculate events ONLY for the loaded dates
      // We do NOT use the "if (!newItems)" check here. We overwrite.
      loadedDates.forEach((strTime) => {
        newItems[strTime] = getEventsForSingleDay(strTime, events);
      });

      // 4. Return new object reference
      return newItems;
    });
  }, [events, getEventsForSingleDay]);


  const renderItem = (reservation: AgendaEntry, isFirst: boolean) => {
    const event = (reservation as any).event as CalendarEvent;
    const occurence = (reservation as any).occurence;

    if (!event) {
      return null;
    }

    return (
      <View style={styles.itemContainer}>
        <EventItem
          event={event}
          onEdit={() => onEventSelect?.(event)}
          onDelete={() => onDelete?.(event.id, occurence)}
        />
      </View>
    );
  };

  const renderEmptyDate = () => {
    return (
      <View style={styles.emptyDate}>
        <Text style={[styles.emptyText,{color:theme.greyBasePrimary}]}>No events scheduled</Text>
      </View>
    );
  };

  const rowHasChanged = (r1: AgendaEntry, r2: AgendaEntry) => {
    return JSON.stringify(r1) !== JSON.stringify(r2);
  };

  const selectedStr = selectedDate.toISOString().split("T")[0];



  return (
    <View style={styles.container}>
      <Agenda
        items={items}
        loadItemsForMonth={loadItems}
        selected={selectedStr}
        renderItem={renderItem}
        renderEmptyDate={renderEmptyDate}
        rowHasChanged={rowHasChanged}
        onDayPress={(day) => onDateSelect(new Date(day.timestamp))}
        onDayChange={(day) => onDateSelect(new Date(day.timestamp))}
        theme={{
          agendaDayTextColor: theme.eventBase,
          agendaDayNumColor: theme.eventBase,
          agendaTodayColor: theme.eventBase,
          agendaKnobColor: theme.eventBase,
          selectedDayBackgroundColor: theme.eventBase,
          dotColor: theme.eventBase,
          todayTextColor: theme.eventBase,
          calendarBackground: theme.eventDarkSecondary,
          textSectionTitleColor: theme.whiteBase,
          dayTextColor: theme.whiteBase,
          monthTextColor: theme.whiteBase,
          textDisabledColor: theme.greyBaseSecondary,
        }}
        showClosingKnob={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    marginRight: 10,
    marginTop: 1,
    marginLeft: 10,
  },
  emptyDate: {
    height: 15,
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
