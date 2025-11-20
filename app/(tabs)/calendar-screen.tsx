import React, { useContext, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Text,
  Pressable,
} from "react-native";
import {
  FAB,
  Portal,
  Provider,
} from "react-native-paper";
import { useData } from "../../hooks/use-data";
import ViewSwitcher from "../../components/ui/view-switcher-event";
import { useCalendarState } from "../../hooks/use-calendar-state";
import { useEventForm } from "../../hooks/use-event-form";
import { CalendarEvent } from "@/types/calendar";
import { Ionicons } from "@expo/vector-icons";
import Timeline from "@/components/ui/calendar-events/calendar-timeline-view";
import CalendarListAgendaMain from "@/components/ui/calendar-events/calendar-list-agenda-view-main";
import CalendarEventModal from "@/components/modal/calendar-event-modal";
import { ThemeContext } from "@/context/ThemeContext";

export default function CalendarScreen() {
  const {theme, isDarkMode } = useContext(ThemeContext)
   console.log("TATAT2", isDarkMode)
  const { events, setEvents , deleteEventOccurrence} = useData();
  const {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
  } = useCalendarState(events);
  const [visible, setVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const { state, updateField, onSubmit } = useEventForm({
    events,
    setEvents,
    editingEvent,
    onClose: () => setVisible(false),
  });

  const showModal = (event?: CalendarEvent) => {
    setEditingEvent(event || null);
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const handleDelete = (id: string, date:string) => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete Current Occurrence",
        onPress: async () => {
          const eventId = events.filter((e)=>e.id===id) 
          deleteEventOccurrence(id, date, false)
        },
      },
      {
        text: "Delete All Occurrences",
        onPress: async () => {
          const eventId = events.filter((e)=>e.id===id) 
          deleteEventOccurrence(id, date, true)
        },
      },
    ]);
  };
  return (
    <Provider>
      <View style={styles.container}>
        <Pressable
          style={[styles.header,{backgroundColor:theme.eventBase}]}
          onPress={() => setSelectedDate(new Date())}
        >
          <Ionicons size={40} name="calendar"></Ionicons>
        </Pressable>
        <Text style={[styles.date,{color:theme.text}]}>
          {selectedDate.toDateString()}
        </Text>
      </View>
      <ViewSwitcher currentView={currentView} onChange={setCurrentView} />
      {currentView === "month" ? (
        <CalendarListAgendaMain
          events={events}
          selectedDate={selectedDate}
          onDateSelect={(date: Date) => {
            setSelectedDate(date);
          }}
          onEventSelect={showModal}
          onDelete={handleDelete}
        />
      ) : (
        <Timeline
          events={filteredEvents}
          selectedDate={selectedDate}
          onEventSelect={showModal}
          onDelete={handleDelete}
        />
      )}
      <FAB style={[styles.fab,{backgroundColor:theme.eventBase}]} icon="plus" onPress={() => showModal()} />
      <Portal>
        <CalendarEventModal
          visible={visible}
          onDismiss={hideModal}
          updateField={updateField}
          state={state}
          onSubmit={onSubmit}
        ></CalendarEventModal>
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 30,
    width: 60,
    height: 60,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  container: { flexDirection: "row", alignItems: "center" },
  date:{ fontSize: 30 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
