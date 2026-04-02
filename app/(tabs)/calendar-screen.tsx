import React, { useContext, useState } from "react";
import { View, StyleSheet, Alert, Text, Pressable } from "react-native";
import { FAB, Portal } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

import { useData } from "@/hooks/use-data";
import ViewSwitcher from "@/components/ui/calendar-events/view-switcher-event";
import { useCalendarState } from "@/hooks/use-calendar-state";
import { useEventForm } from "@/hooks/use-event-form";
import { CalendarEvent } from "@/types/calendar";

import Timeline from "@/components/ui/calendar-events/calendar-timeline-view";
import CalendarListAgendaMain from "@/components/ui/calendar-events/calendar-list-agenda-view-main";
import CalendarEventModal from "@/components/modal/calendar-event-modal";
import { ThemeContext } from "@/context/ThemeContext";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { DbErrorToast, useDbErrorToast } from "@/components/db-error-toast";

// TODO - can we getting db write error from useItemForm hook into ItemScreen and display toast?
function CalendarScreenInner() {
  const { theme } = useContext(ThemeContext);
  const { events, addEvent, editEvent, deleteEventOccurrence } = useData();
  const {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
  } = useCalendarState(events);
  const [visible, setVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const { toastError, showToast, dismissToast } = useDbErrorToast();
  const { state, updateField, onSubmit } = useEventForm({
    addEvent,
    editEvent,
    editingEvent,
    onClose: () => setVisible(false),
  });

  const showModal = (event?: CalendarEvent) => {
    setEditingEvent(event || null);
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const handleDelete = (id: string, date: string) => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete Current Occurrence",
        onPress: async () => {
          try {
            await deleteEventOccurrence(id, date, false);
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          }
        },
      },
      {
        text: "Delete All Occurrences",
        onPress: async () => {
          try {
            await deleteEventOccurrence(id, date, true);
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          }
        },
      },
    ]);
  };
  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Pressable
          style={[styles.header, { backgroundColor: theme.eventBase }]}
          onPress={() => setSelectedDate(new Date())}
        >
          <Ionicons size={40} name="calendar"></Ionicons>
        </Pressable>
        <Text style={[styles.date, { color: theme.text }]}>
          {selectedDate.toDateString()}
        </Text>
      </View>
      <ViewSwitcher currentView={currentView} onChange={setCurrentView} />
      {currentView === "month" ? (
        <CalendarListAgendaMain
          //key={Object.keys(events).length}
          events={[...events]}
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
      <FAB
        color={theme.eventDarkPrimary}
        style={[styles.fab, { backgroundColor: theme.eventBase }]}
        icon="plus"
        onPress={() => showModal()}
      />
      <DbErrorToast error={toastError} onDismiss={dismissToast} />
      <Portal>
        <CalendarEventModal
          visible={visible}
          onDismiss={hideModal}
          updateField={updateField}
          state={state}
          onSubmit={onSubmit}
        ></CalendarEventModal>
      </Portal>
    </>
  );
}

export default function CalendarScreen() {
  return (
    <ScreenErrorBoundary screenName="Calendar">
      <CalendarScreenInner />
    </ScreenErrorBoundary>
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
  date: { fontSize: 30 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
