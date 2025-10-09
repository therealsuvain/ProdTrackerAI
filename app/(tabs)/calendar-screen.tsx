import React, { useState } from "react";
import { View, StyleSheet, Alert, Platform, Switch, Text } from "react-native";
import {
  FAB,
  Portal,
  Modal,
  Provider,
  TextInput,
  Button,
  Appbar,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useDataTest } from "../../hooks/use-data-test";
import CalendarMonthly from "../../components/ui/calendar-monthly";
import DayView from "../../components/ui/day-view";
import ViewSwitcher from "../../components/ui/view-switcher-event";
import { useCalendarState } from "../../hooks/use-calendar-state";
import { useEventForm } from "../../hooks/use-event-form";
import {
  cancelReminder,
  useNotifications,
} from "../../hooks/use-notifications";
import { CalendarEvent } from "@/types/calendar";

export default function CalendarScreen() {
  const { events, setEvents } = useDataTest();
  useNotifications();
  const {
    currentView,
    setCurrentView,
    selectedDate,
    setSelectedDate,
    filteredEvents,
  } = useCalendarState(events);
  const [visible, setVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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

  const handleDelete = (id: string) => {
    Alert.alert("Delete Event", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          const event = events.find((e) => e.id === id);
          if (event?.notificationId) await cancelReminder(event.notificationId);
          setEvents(events.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const onStartChange = (event: any, selected?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (selected) updateField("startTime", selected);
  };

  const onEndChange = (event: any, selected?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (selected) updateField("endTime", selected);
  };

  return (
    <Provider>
      <Appbar.Header>
        <Appbar.Action
          icon="calendar-today"
          onPress={() => setSelectedDate(new Date())}
        />
        <Appbar.Content title={selectedDate.toDateString()} />
      </Appbar.Header>
      <View style={styles.container}>
        <ViewSwitcher currentView={currentView} onChange={setCurrentView} />
        {currentView === "month" ? (
          <CalendarMonthly
            events={events}
            onDateSelect={setSelectedDate}
            selectedDate={selectedDate}
          />
        ) : (
          <DayView
            events={filteredEvents}
            onEventSelect={showModal}
            onDelete={handleDelete}
          />
        )}
        <FAB style={styles.fab} icon="plus" onPress={() => showModal()} />
      </View>
      <Portal>
        <Modal
          visible={visible}
          onDismiss={hideModal}
          contentContainerStyle={styles.modal}
        >
          <TextInput
            label="Title"
            value={state.title}
            onChangeText={(text) => updateField("title", text)}
          />
          {state.errors.title && (
            <Text style={styles.error}>{state.errors.title}</Text>
          )}
          <Button onPress={() => setShowStartPicker(true)}>
            Pick Start Time
          </Button>
          <Text>Start: {state.startTime?.toLocaleString() || ""}</Text>
          {state.errors.startTime && (
            <Text style={styles.error}>{state.errors.startTime}</Text>
          )}
          {showStartPicker &&
            (Platform.OS === "ios" ? (
              <DateTimePicker
                value={state.startTime || new Date()}
                mode="datetime"
                onChange={onStartChange}
              />
            ) : (
              <DateTimePicker
                value={state.startTime || new Date()}
                mode="date"
                onChange={onStartChange}
              />
            ))}
          <Button onPress={() => setShowEndPicker(true)}>Pick End Time</Button>
          <Text>End: {state.endTime?.toLocaleString() || ""}</Text>
          {state.errors.endTime && (
            <Text style={styles.error}>{state.errors.endTime}</Text>
          )}
          {showEndPicker &&
            (Platform.OS === "ios" ? (
              <DateTimePicker
                value={state.endTime || new Date()}
                mode="datetime"
                onChange={onEndChange}
              />
            ) : (
              <DateTimePicker
                value={state.endTime || new Date()}
                mode="date"
                onChange={onEndChange}
              />
            ))}
          <TextInput
            label="Description"
            value={state.description || ""}
            onChangeText={(text) => updateField("description", text)}
            multiline
          />
          <View style={styles.switchContainer}>
            <Text>Set Reminder</Text>
            <Switch
              value={state.reminder}
              onValueChange={(val) => updateField("reminder", val)}
            />
          </View>
          <View style={styles.recurrence}>
            <Text>Recurrence</Text>
            <Button
              onPress={() => updateField("recurrence", "none")}
              mode={state.recurrence === "none" ? "contained" : "outlined"}
            >
              None
            </Button>
            <Button
              onPress={() => updateField("recurrence", "daily")}
              mode={state.recurrence === "daily" ? "contained" : "outlined"}
            >
              Daily
            </Button>
            <Button
              onPress={() => updateField("recurrence", "weekly")}
              mode={state.recurrence === "weekly" ? "contained" : "outlined"}
            >
              Weekly
            </Button>
          </View>
          {/* Category input if needed: TextInput for now */}
          <TextInput
            label="Category"
            value={state.category || ""}
            onChangeText={(text) => updateField("category", text)}
          />
          <Button onPress={onSubmit}>Save</Button>
          <Button onPress={hideModal}>Cancel</Button>
        </Modal>
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fab: { position: "absolute", margin: 16, right: 0, bottom: 0 },
  modal: { backgroundColor: "white", padding: 20, margin: 20 },
  error: { color: "red", fontSize: 12 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  recurrence: { marginVertical: 8 },
});
