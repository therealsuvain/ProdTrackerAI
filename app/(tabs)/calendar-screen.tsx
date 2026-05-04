import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useState } from "react";
import {
  Alert,
  AlertButton,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FAB, Portal } from "react-native-paper";

import ViewSwitcher from "@/components/ui/calendar-events/view-switcher-event";
import { useCalendarState } from "@/hooks/use-calendar-state";
import { useEventForm } from "@/hooks/use-event-form";
import { useEvents } from "@/hooks/use-events";
import { CalendarEvent } from "@/types/calendar";

import { DbErrorToast, useDbErrorToast } from "@/components/db-error-toast";
import CalendarEventModal from "@/components/modal/calendar-event-modal";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
import Timeline from "@/components/ui/calendar-events/calendar-timeline-view";
import CalendarListAgendaV2 from "@/components/ui/calendar-events/v2-calendar-list-agenda-view-v2";
import { ThemeContext } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/use-haptics";
import CalendarListAgendaMain from "@/components/ui/calendar-events/calendar-list-agenda-view-main";

// TODOX - can we getting db write error from useItemForm hook into ItemScreen and display toast?
function CalendarScreenInner() {
  const { theme } = useContext(ThemeContext);
  const { events, addEvent, editEvent, deleteEventOccurrence } = useEvents();
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
  const { triggerHaptic } = useHaptics();
  const { state, updateField, onSubmit } = useEventForm({
    addEvent,
    editEvent,
    editingEvent,
    onClose: () => setVisible(false),
    resetEditingEvent: () => setEditingEvent(null),
  });

  const showModal = (event?: CalendarEvent) => {
    setEditingEvent(event || null);
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const isSingleOccurrenceHelper = (event: CalendarEvent) => {
    if (event.recurrence === "none") return true;
    if (!event.endDate) return false;
    const start = new Date(event.startDate.split("T")[0]);
    const end = new Date(event.endDate.split("T")[0]);
    const dayDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    let totalOccurrences = 0;
    if (event.recurrence === "daily") {
      totalOccurrences = dayDiff + 1;
    } else if (event.recurrence === "weekly") {
      totalOccurrences = Math.floor(dayDiff / 7) + 1;
    }
    // fallback safety
    else {
      totalOccurrences = 1;
    }
    const deletedOcurrencesCount = event.deletedOccurrences?.length || 0;
    const remainingOccurrences = totalOccurrences - deletedOcurrencesCount;
    return remainingOccurrences === 1;
  };

  const handleDelete = (id: string, date: string) => {
    const event = events.find((e: CalendarEvent) => e.id === id);
    if (!event) return;
    const isSingleOccurrence = isSingleOccurrenceHelper(event);
    const buttons: AlertButton[] = [
      { text: "Cancel" },
      {
        text: "Delete Event",
        onPress: async () => {
          try {
            await deleteEventOccurrence(id, date, true);
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          }
        },
      },
    ];
    if (!isSingleOccurrence) {
      buttons.push({
        text: "Delete Current Occurrence",
        onPress: async () => {
          try {
            await deleteEventOccurrence(id, date, false);
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the event. It has been restored.");
          }
        },
      });
    }

    Alert.alert("Delete Event", "Are you sure?", buttons);
  };
  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Pressable
          style={[styles.header, { backgroundColor: theme.eventBase }]}
          onPress={() => setSelectedDate(new Date())}
        >
          <Ionicons
            size={40}
            name="calendar"
            color={theme.modalDarkPrimary}
          ></Ionicons>
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
