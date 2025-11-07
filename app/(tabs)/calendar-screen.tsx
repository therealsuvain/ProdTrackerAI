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
  SegmentedButtons,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useData } from "../../hooks/use-data";
import CalendarMonthly from "../../components/ui/calendar-events/calendar-monthly";
import ViewSwitcher from "../../components/ui/view-switcher-event";
import { useCalendarState } from "../../hooks/use-calendar-state";
import { useEventForm } from "../../hooks/use-event-form";
import {
  cancelReminder,
  useNotifications,
} from "../../hooks/use-notifications";
import { CalendarEvent } from "@/types/calendar";
import { Ionicons } from "@expo/vector-icons";
import Timeline from "@/components/ui/calendar-events/calendar-timeline-view";
import CalendarListAgenda from "@/components/ui/calendar-events/calendar-list-agenda-view";
import CalendarListAgendaMain from "@/components/ui/calendar-events/calendar-list-agenda-view-main";

export default function CalendarScreen() {
  const { events, setEvents } = useData();
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
  const [showAndroidStartTimePicker, setShowAndroidStartTimerPicker]=useState(false)
  const [showAndroidEndTimePicker, setShowAndroidEndTimerPicker]=useState(false)
  const [androidDate, setAndroidDate]=useState<Date>();

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
        setEvents((currentEvents) => {
          const event = currentEvents.find((e:CalendarEvent) => e.id === id);
          if (event?.notificationId) {
            cancelReminder(event.notificationId);
          }
          return currentEvents.filter((e:CalendarEvent) => e.id !== id);
        });
      },
    },
    ]);
  };

  const onStartChange = (event: any, selected?: Date) => {
    setShowStartPicker(false);
    setAndroidDate(selected);
    console.log(selected)
    console.log(new Date(selected?selected.toLocaleString():''))
    if (selected) updateField("startDate", selected);
  };

  const onStartTimeChangeAndroid = (event: any, selected?:Date) => {
    setShowAndroidStartTimerPicker(false)
    let varTime;
    console.log(selected)
    if (selected) varTime=androidDate?.toISOString().split('T')[0]+'T'+selected.toISOString().split('T')[1]
    console.log(selected?.toISOString().split('T')[1])
    console.log(varTime)
    console.log(new Date(varTime!))
    updateField("startTime",new Date(varTime!));
  }
  const onEndChange = (event: any, selected?: Date) => {
    setShowEndPicker(false);  
    setAndroidDate(selected);
    if (selected) updateField("endDate", selected);
};

const onEndTimeChangeAndroid = (event: any, selected?:Date) => {
    setShowAndroidEndTimerPicker(false)
    let varTime;
    if (selected) varTime=androidDate?.toISOString().split('T')[0]+'T'+selected.toISOString().split('T')[1]
    updateField("endTime",new Date(varTime!));
  }
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
        <ViewSwitcher currentView={currentView} onChange={setCurrentView} />
        {currentView === "month" ? (
          
           <CalendarListAgendaMain
           events={events}
              selectedDate={selectedDate}
              onDateSelect={(date: Date) => {
                setSelectedDate(date);
                // Uncomment below to auto-switch to day view
                // setCurrentView("day");
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
        <FAB style={styles.fab} icon="plus" onPress={() => showModal()} />
      <Portal>
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
              onPress={() => {setShowStartPicker(true)}}
            >
              Pick Date 
            </Button>
            <Text style={styles.text}>
              Start: {state.startDate.toDateString() || ""}
            </Text>
            {state.errors.startDate && (
              <Text style={styles.error}>{state.errors.startDate}</Text>
            )}
            {showStartPicker && <DateTimePicker
                  value={state.startDate || new Date()}
                  mode="date"
                  onChange={onStartChange}
                /> 
              }
            <View style={{flexDirection:'row'}}>
              <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 , width:'50%'}}
              onPress={() => {setShowAndroidStartTimerPicker(true)}}
            >
              Pick Start Time
            </Button>
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 , width:'50%'}}
              onPress={() => {setShowAndroidEndTimerPicker(true)}}
            >
              Pick End Time
            </Button>
            </View>
             <View style={{flexDirection:'row', justifyContent:'space-between'}}>
              <Text style={styles.text}>
              Start: {state.startTime.toLocaleTimeString() || ""}
            </Text>
            {state.errors.startTime && (
              <Text style={styles.error}>{state.errors.startTime}</Text>
            )}      
            <Text style={styles.text}>
              End: {state.endTime?.toLocaleTimeString() || ""}
            </Text>
            {state.errors.endTime && (
              <Text style={styles.error}>{state.errors.endTime}</Text>
            )} 
             </View>
              {showAndroidStartTimePicker && 
                <DateTimePicker
                  value={state.startTime || new Date()}
                  mode="time"
                  onChange={onStartTimeChangeAndroid}
                />}
               {showAndroidEndTimePicker && 
                <DateTimePicker
                  value={state.endTime || new Date()}
                  mode="time"
                  onChange={onEndTimeChangeAndroid}
                />}
            <Button
              mode="elevated"
              buttonColor="#411310ff"
              textColor="#F44336"
              style={{ marginVertical: 2.5 }}
              onPress={() => {setShowEndPicker(true)}}
            >
              Pick End Date
            </Button>
            <Text style={styles.text}>
              End: {state.endDate.toDateString() || ""}
            </Text>
            {state.errors.endDate && (
              <Text style={styles.error}>{state.errors.endDate}</Text>
            )}
            {showEndPicker &&
              <DateTimePicker
                  value={state.endDate || new Date()}
                  mode="date"
                  onChange={onEndChange}
                />
              }
             
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
                trackColor={{ false: "#ffffff", true: "#f443367a" }}
                onValueChange={(val) => {updateField("reminder", val); console.log(val)}}
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
