import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  Switch,
  Text,
  Pressable,
} from "react-native";
import {
  FAB,
  Portal,
  Modal,
  Provider,
  TextInput,
  Button,
  Appbar,
  SegmentedButtons,
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
import { Ionicons } from "@expo/vector-icons";

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
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          style={styles.header}
          onPress={() => setSelectedDate(new Date())}
        >
          <Ionicons size={40} name="calendar"></Ionicons>
        </Pressable>
        <Text style={{ fontSize: 30, color: "white" }}>
          {selectedDate.toDateString()}
        </Text>
      </View>
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
        <View style={{ position: "relative", width: "100%", height: "100%" }}>
          <Modal
            visible={visible}
            onDismiss={hideModal}
            contentContainerStyle={styles.modal}
          >
            <TextInput
              label="Title"
              value={state.title}
              mode="outlined"
              style={{ marginVertical: 2.5 }}
              activeOutlineColor="#F44336"
              onChangeText={(text) => updateField("title", text)}
            />
            {state.errors.title && (
              <Text style={styles.error}>{state.errors.title}</Text>
            )}
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onPress={() => setShowStartPicker(true)}
            >
              Pick Start Time
            </Button>
            <Text style={styles.text}>
              Start: {state.startTime?.toLocaleString() || ""}
            </Text>
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
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onPress={() => setShowEndPicker(true)}
            >
              Pick End Time
            </Button>
            <Text style={styles.text}>
              End: {state.endTime?.toLocaleString() || ""}
            </Text>
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
              mode="outlined"
              activeOutlineColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onChangeText={(text) => updateField("description", text)}
              multiline
            />
            <View style={styles.switchContainer}>
              <Text style={styles.text}>Set Reminder</Text>
              <Switch
                value={state.reminder}
                thumbColor="#F44336"
                trackColor={{ false: "#ffffffff", true: "#f443367a" }}
                onValueChange={(val) => updateField("reminder", val)}
              />
            </View>
            <Text style={styles.text}>Recurrence</Text>
            <SegmentedButtons
              style={{ marginVertical: 2.5 }}
              value={state.recurrence ? state.recurrence : "none"}
              onValueChange={(val) =>
                updateField("recurrence", val as "none" | "daily" | "weekly")
              }
              buttons={[
                {
                  value: "none",
                  label: "None",
                  checkedColor: "#F44336",
                  style: { backgroundColor: "#411310ff" },
                },
                {
                  value: "daily",
                  label: "Daily",
                  checkedColor: "#F44336",
                  style: { backgroundColor: "#411310ff" },
                },
                {
                  value: "weekly",
                  label: "Weekly",
                  checkedColor: "#F44336",
                  style: { backgroundColor: "#411310ff" },
                },
              ]}
            />

            {/* Category input if needed: TextInput for now */}
            <TextInput
              label="Category"
              value={state.category || ""}
              mode="outlined"
              activeOutlineColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onChangeText={(text) => updateField("category", text)}
            />
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onPress={onSubmit}
            >
              Save
            </Button>
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onPress={hideModal}
            >
              Cancel
            </Button>
          </Modal>
        </View>
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#f86055ff",
    borderRadius: 30,
    width: 60,
    height: 60,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  container: { flex: 1, padding: 16 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#F44336",
  },
  modal: {
    backgroundColor: "#36100dff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#411310ff",
  },
  error: { color: "red", fontSize: 12 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  text: { color: "#F44336", marginVertical: 2.5 },
});
