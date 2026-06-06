import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Agenda,
  AgendaEntry,
  AgendaSchedule,
  DateData,
} from "react-native-calendars";
import EventItem from "./event-item";

interface CalendarListAgendaAltProps {
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string, date: string) => void;
}

const MemoizedEventItem = memo(
  ({
    event,
    //showEdit,
    onEdit,
    onDelete,
  }: {
    event: CalendarEvent;
    //showEdit: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
  }) => (
    <View style={styles.itemContainer}>
      <EventItem event={event} onEdit={onEdit} onDelete={onDelete} />
    </View>
  ),
);

// TODOOptim Optimize maybe
export default function CalendarListAgendaMain({
  events,
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarListAgendaAltProps) {
  const { theme } = useContext(ThemeContext);
  const [items, setItems] = useState<AgendaSchedule>({});

  //const seenEventIds = useRef<Set<string>>(new Set());

  // Convert timestamp to date string
  const timeToString = (time: number) => {
    const date = new Date(time);
    return date.toISOString().split("T")[0];
  };

  const getEventsForSingleDay = useCallback(
    (todayDateString: string, allEvents: any[]) => {
      const dayEvents = allEvents.filter((event) => {
        const eventStartDate = new Date(event.startDate);
        const eventStartDateString = eventStartDate.toISOString().split("T")[0];
        let eventEndDateString;
        if (event.endDate) {
          eventEndDateString = new Date(event.endDate)
            .toISOString()
            .split("T")[0];
        }
        const currentDay = new Date(todayDateString);

        if (todayDateString < eventStartDateString) return false;
        if (event.endDate && todayDateString > eventEndDateString!)
          return false;
        if (event.deletedOccurrences?.includes(todayDateString)) return false;

        if (event.recurrence === "none" || !event.recurrence) {
          return eventStartDateString === todayDateString;
        }
        if (event.recurrence === "daily") return true;
        if (event.recurrence === "weekly") {
          return currentDay.getDay() === eventStartDate.getDay();
        }
        return false;
      });

      if (dayEvents.length > 0) {
        return dayEvents
          .sort(
            (a, b) =>
              new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
          )
          .map((event) => ({
            name: event.title,
            height: 40,
            day: todayDateString,
            event: event,
            occurence: todayDateString,
            _fingerprint: `${event.category}-${event.tags?.length || 0}-${event.title}-${event.description}`,
          }));
      }
      return [];
    },
    [],
  );

  const loadItems = useCallback(
    (day: DateData) => {
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
    },
    [events, getEventsForSingleDay, timeToString],
  ); // Only depend on `events`

  useEffect(() => {
    const today = new Date();
    const timestamp = today.getTime();
    const dateData: DateData = {
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate(),
      timestamp,
      dateString: today.toISOString().split("T")[0],
    };
    loadItems(dateData);
    //console.log(events.filter((e) => e.title === "ThirdEvent")[0].category);
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

  // set list so that only fist occurence of event renders with edit button

  const renderItem = (reservation: AgendaEntry, isFirst: boolean) => {
    const event = (reservation as any).event as CalendarEvent;
    const occurence = (reservation as any).occurence;
    if (!event) {
      return null;
    }
    /*  const showEdit = !seenEventIds.current.has(event.id);
    if (showEdit) seenEventIds.current.add(event.id); */

    return (
      <MemoizedEventItem
        event={event}
        //showEdit={showEdit}
        onEdit={() => onEventSelect?.(event)}
        onDelete={() => onDelete?.(event.id, occurence)}
      />
    );
  };

  const renderEmptyDate = () => {
    return (
      <View style={styles.emptyDate}>
        <Text style={[styles.emptyText, { color: theme.greyBasePrimary }]}>
          No events scheduled
        </Text>
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
