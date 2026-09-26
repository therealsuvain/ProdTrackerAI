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
import {
  getEventIdsForDate,
  selectedDateEventIds,
  useEventStore,
} from "@/stores/use-event-store";
import { useShallow } from "zustand/shallow";

interface CalendarListAgendaAltProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (id: string) => void;
  onDelete?: (id: string, date: string) => void;
}

/* const MemoizedEventItem = memo(
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
); */

const MemoizedEventItem = React.memo(function MemoizedEventItem({
  eventId,
  occurrence,
  onEdit,
  onDelete,
}: {
  eventId: string;
  occurrence: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string, date: string) => void;
}) {
  const handleEdit = useCallback(() => onEdit?.(eventId), [eventId, onEdit]);
  const handleDelete = useCallback(
    () => onDelete?.(eventId, occurrence),
    [eventId, onDelete, occurrence],
  );
  return (
    <View style={styles.itemContainer}>
      <EventItem
        id={eventId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        occurrence={occurrence}
      />
    </View>
  );
});

// TODOOptim Optimize maybe
export default React.memo(function CalendarListAgendaMain({
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarListAgendaAltProps) {
  const { theme } = useContext(ThemeContext);
  const [items, setItems] = useState<AgendaSchedule>({});
  // Convert timestamp to date string
  const timeToString = (time: number) => {
    const date = new Date(time);
    return date.toISOString().split("T")[0];
  };

  const eventKeysSignature = useEventStore(
    useShallow((state) => Object.keys(state.eventsById).sort().join(",")),
  );
  const eventOccurrenceSignature = useEventStore(
    useShallow((state) =>
      Object.values(state.eventsById)
        .map((e) => `${e.id}:${e.deletedOccurrences?.length ?? 0}`)
        .join(","),
    ),
  );
  /*
  !const eventIds = useEventStore(
    !useShallow((state) => {
      !return selectedDateEventIds(state, selectedDate);
    }),
  ); */
  /*   const getEventsForSingleDay = useCallback(
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
  ); */
  const buildEntriesForDay = useCallback(
    (dateString: string): AgendaEntry[] => {
      const eventsById = useEventStore.getState().eventsById;
      const eventIds = getEventIdsForDate(
        Object.values(eventsById),
        dateString,
      );
      return eventIds.map((id) => ({
        name: "", // event title now read reactively inside MemoizedEventItem; not needed here
        height: 40,
        day: dateString,
        eventId: id,
        occurrence: dateString,
      })) as unknown as AgendaEntry[];
    },
    [
      /* eventIds */
    ],
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
            //!newItems[strTime] = getEventsForSingleDay(strTime, events);
            newItems[strTime] = buildEntriesForDay(strTime);
            itemsWereAdded = true; // Mark that we're adding new days
          }
        }

        // If we didn't add any new date keys, return the *previous* state
        // This is crucial to stop the infinite loop
        // Otherwise, return the new object
        return itemsWereAdded ? newItems : prevItems;
      });
    },
    [buildEntriesForDay],
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
  }, [loadItems]);

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
        newItems[strTime] = buildEntriesForDay(strTime); //getEventsForSingleDay(strTime, events);
      });

      // 4. Return new object reference
      return newItems;
    });
  }, [
    eventOccurrenceSignature /* eventIds */,
    buildEntriesForDay /* getEventsForSingleDay */,
  ]);

  // set list so that only fist occurence of event renders with edit button

  const renderItem = (reservation: AgendaEntry, isFirst: boolean) => {
    const eventId = (reservation as any).eventId as string | undefined;
    const occurrence = (reservation as any).occurrence as string;
    if (!eventId) {
      return null;
    }
    /*  const showEdit = !seenEventIds.current.has(event.id);
    if (showEdit) seenEventIds.current.add(event.id); */

    return (
      <MemoizedEventItem
        eventId={eventId}
        //showEdit={showEdit}
        occurrence={occurrence}
        onEdit={() => onEventSelect?.(eventId)}
        onDelete={() => onDelete?.(eventId, occurrence)}
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

  /*  const rowHasChanged = (r1: AgendaEntry, r2: AgendaEntry) => {
    return JSON.stringify(r1) !== JSON.stringify(r2);
  }; */
  const rowHasChanged = (r1: AgendaEntry, r2: AgendaEntry) =>
    (r1 as any).eventId !== (r2 as any).eventId ||
    (r1 as any).occurrence !== (r2 as any).occurrence;
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
        /* renderKnob={() => <View style={styles.knob} />} */
        onDayPress={(day) => onDateSelect(new Date(day.timestamp))}
        onDayChange={(day) => onDateSelect(new Date(day.timestamp))}
        hideExtraDays={true}
        theme={{
          agendaDayTextColor: theme.whiteBase,
          agendaDayNumColor: theme.whiteBase,
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
          reservationsBackgroundColor: theme.background,
          /*  stylesheet: {
            agenda: {
              main: {
                backgroundColor: "green",
              },
              list: {
                backgroundColor: "green",
              },
            },
          }, */
        }}
        showClosingKnob={true}
      />
      {/* <View
        pointerEvents="none"
        style={[
          styles.calendarBottomMask,
          { backgroundColor: theme.eventDarkSecondary },
        ]}
      /> */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /*   calendarBottomMask: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    bottom: 0,
  }, */
  itemContainer: {
    marginRight: 10,
    marginTop: 1,
    marginLeft: 10,
  },
  /* knob: {
    backgroundColor: "white",
    width: "10%",
    height: 5,
    borderRadius: 2,
  }, */
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
