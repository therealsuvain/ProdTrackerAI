import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Agenda, AgendaEntry, AgendaSchedule } from "react-native-calendars";
import { CalendarEvent } from "@/types/calendar";
import EventItem from "./event-item";
import { Text } from "react-native-paper";

interface CalendarAgendaProps {
  events: CalendarEvent[];
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

export default function CalendarAgenda({
  events,
  onEventSelect,
  onDelete,
}: CalendarAgendaProps) {
  // Transform events into Agenda format
  const getAgendaItems = useMemo((): AgendaSchedule => {
    const items: AgendaSchedule = {};

    events.forEach((event) => {
      const dateKey = event.startTime.toISOString().split("T")[0];
      
      if (!items[dateKey]) {
        items[dateKey] = [];
      }

      items[dateKey].push({
        name: event.title,
        height: 80,
        day: dateKey, // Store full event object
      });
    });

    console.log(items)
    return items;
  },[events]);

  const renderItem = (item: AgendaEntry, isFirst: boolean) => {
    const event = (item as any).event as CalendarEvent;
    console.log("renderItem")
    return (
      <View style={styles.itemContainer}>
        <EventItem
          event={event}
         // onEdit={() => onEventSelect?.(event)}
          //onDelete={() => onDelete?.(event.id)}
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
// {
//     '2012-05-22': [{name: 'item 1 - any js object' ,height: 80, day:'2012-05-22'}],
//     '2012-05-23': [{name: 'item 2 - any js object', height: 80, day :'2012-05-23'}],
//     '2012-05-24': [],
//     '2012-05-25': [{name: 'item 3 - any js object', height: 80, day :'2012-05-23'}, {name: 'any js object', height: 80, day :'2012-05-23'}]
//   }
  return (
    <Agenda
      items={getAgendaItems}
      renderItem={renderItem}
      renderEmptyDate={renderEmptyDate}
      rowHasChanged={(r1, r2) => r1.name !== r2.name}
      theme={{
        agendaDayTextColor: "#F44336",
        agendaDayNumColor: "#F44336",
        agendaTodayColor: "#F44336",
        agendaKnobColor: "#F44336",
        selectedDayBackgroundColor: "#F44336",
        dotColor: "#F44336",
        todayTextColor: "#F44336",
        backgroundColor: "#1a1a1a",
        calendarBackground: "#2d2a30ff",
        textSectionTitleColor: "#ffffff",
        dayTextColor: "#ffffff",
        monthTextColor: "#ffffff",
      }}
      showClosingKnob={true}
      style={styles.agenda}
    />
  );
}

const styles = StyleSheet.create({
  agenda: {
    flex: 1,
  },
  itemContainer: {
    marginRight: 10,
    marginTop: 17,
  },
  emptyDate: {
    height: 15,
    flex: 1,
    paddingTop: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#999999",
    fontSize: 14,
  },
});