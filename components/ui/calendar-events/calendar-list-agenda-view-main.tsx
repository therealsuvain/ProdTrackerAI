import React, { useMemo, useCallback, useState, useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import {
  Agenda,
  AgendaEntry,
  AgendaSchedule,
  DateData,
} from "react-native-calendars";
import { CalendarEvent } from "@/types/calendar";
import EventItem from "./event-item";

interface CalendarListAgendaAltProps {
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

export default function CalendarListAgendaMain({
  events,
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarListAgendaAltProps) {
  const [items, setItems] = useState<AgendaSchedule>({});

  // Convert timestamp to date string
  const timeToString = (time: number) => {
    const date = new Date(time);
    return date.toISOString().split("T")[0];
  };


const loadItems = useCallback((day: DateData) => {
    // We must use the functional form of setItems to prevent an infinite loop
    setItems((prevItems) => {
      const newItems: AgendaSchedule = { ...prevItems };
      let itemsWereAdded = false; // Flag to check if we're adding new data

      // Load events for 2 months range (1 month before and 1 month after)
      for (let i = -30; i < 30; i++) {
        const time = day.timestamp + i * 24 * 60 * 60 * 1000;
        const strTime = timeToString(time);

        // Only load if we haven't already
        if (!newItems[strTime]) {
          itemsWereAdded = true; // Mark that we're adding new days
          
          // --- START OF FILTER FIX ---

          const dayEvents = events.filter((event) => {
            // Get the day we are *currently checking* (from the loop)
            // Normalized to midnight
            const currentDay = new Date(time);
            currentDay.setHours(0, 0, 0, 0);
            const currentDayTimestamp = currentDay.getTime();
            const currentDayEndTimestamp = currentDayTimestamp + (24*60*60*1000)-1

            // Get the event's start *date* (normalized to midnight)
            const eventStartDate = new Date(event.startDate);
            eventStartDate.setHours(0,0,0,0)
            const eventStartDateTimestamp = eventStartDate.getTime();
            
            // Get the event's end *date* (normalized to midnight)
            const eventEndDate = new Date(event.endDate);
            eventEndDate.setHours(0,0,0,0)
            const eventEndDateTimestamp = eventEndDate.getTime();


            if (currentDayTimestamp < eventStartDateTimestamp ) {
              return false;
            }

            if (currentDayTimestamp > eventEndDateTimestamp) {
              return false;
            }
            



            // Now we know the currentDay is *within* the event's start/end range.
            // We can proceed with the recurrence logic.

            const eventStartDateString = event.startDate.toISOString().split("T")[0];

            // Check 1: Is it a non-recurring event on its exact start date?
            if (event.recurrence === "none" || !event.recurrence) {
              return eventStartDateString === strTime;
            }

            // Check 2: Is it a daily recurrence?
            // (We already know we're within the start/end dates, so this is valid)
            if (event.recurrence === "daily") {
              return true;
            }

            // Check 3: Is it a weekly recurrence?
            if (event.recurrence === "weekly") {
              // Check if the day of the week matches the event's *start* day
              return currentDay.getDay() === eventStartDate.getDay();
            }

            return false;
          });

          // --- END OF FILTER FIX ---
          
          if (dayEvents.length > 0) {
            newItems[strTime] = dayEvents
              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
              .map((event) => ({
                name: event.title,
                height: 80,
                day: strTime,
                event: event, // Store full event object
              }));
          } else {
            // Empty array for days with no events
            newItems[strTime] = [];
          }
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
  }, [events]); // Only depend on `events`

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



  const renderItem = (reservation: AgendaEntry, isFirst: boolean) => {
    const event = (reservation as any).event as CalendarEvent;

    if (!event) {
      return null;
    }

    return (
      <View style={styles.itemContainer}>
        <EventItem
          event={event}
          onEdit={() => onEventSelect?.(event)}
          onDelete={() => onDelete?.(event.id)}
        />
      </View>
    );
  };

  const renderEmptyDate = () => {
    return (
      <View style={styles.emptyDate}>
        <Text style={styles.emptyText}>No events scheduled</Text>
      </View>
    );
  };

  const rowHasChanged = (r1: AgendaEntry, r2: AgendaEntry) => {
    return r1.name !== r2.name;
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
          agendaDayTextColor: "#F44336",
          agendaDayNumColor: "#F44336",
          agendaTodayColor: "#F44336",
          agendaKnobColor: "#F44336",
          selectedDayBackgroundColor: "#8f251dff",
          dotColor: "#F44336",
          todayTextColor: "#F44336",
          backgroundColor: "#1a1a1a",
          calendarBackground: "#2d2a30",
          textSectionTitleColor: "#ffffff",
          dayTextColor: "#ffffff",
          monthTextColor: "#ffffff",
          textDisabledColor: "#6e6e6e",
        }}
        showClosingKnob={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  itemContainer: {
    marginRight: 10,
    marginTop: 17,
    marginLeft: 10,
  },
  emptyDate: {
    height: 15,
    flex: 1,
    paddingTop: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#999999",
    fontSize: 14,
  },
});