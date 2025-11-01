import { useData } from "@/hooks/use-data";
import { AIIntent } from "@/types/ai-intent";
import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { Button } from "react-native-paper";
import TaskItem from "./tasks/task-item";
import EventItem from "./calendar-events/event-item";
import HabitItem from "./habits/habit-item";
import { createTask, createEvent, createHabit } from "@/utils/model-factory-utils";
import { Task } from "@/types/task";
import Fuse from "fuse.js";
import { CalendarEvent } from "@/types/calendar";
import { Habit } from "@/types/habits";

interface IntentConfirmationModalProps {
  intent: AIIntent|null ;
  onConfirm: () => void;
}

export function IntentConfirmationModal({
  intent,
  onConfirm,
}: IntentConfirmationModalProps) {
  const [visible, setVisible] = useState(true);
   const { tasks, events, habits } = useData();

   const renderPreview = () => {
    if(intent===null)
      return null;
    const { intent: type, params } = intent;

    // Task intents
    if (type === "add_task") {
      try {
        const newTask = createTask(params);
        return (
          <View>
            <Text style={styles.label}>New Task Preview:</Text>
            <TaskItem task={newTask} onToggleComplete={() => {}} />
          </View>
        );
      } catch (error) {
        return <Text style={styles.errorText}>Invalid task data</Text>;
      }
    }

    if (type === "edit_task" || type === "delete_task" || type === "complete_task") {
      const searchKey = params.title || params.description || "";
      if (!searchKey) {
        return <Text style={styles.errorText}>No task identifier provided</Text>;
      }

      const fuse = new Fuse<Task>(tasks, {
        keys: ["title", "description"],
        threshold: 0.3,
      });
      const matches = fuse.search(searchKey);

      if (matches.length === 0) {
        return <Text style={styles.errorText}>No matching task found</Text>;
      }

      const targetTask = matches[0].item;
      
      if (type === "edit_task") {
        try {
          const updatedTask = createTask({ ...targetTask, ...params });
          return (
            <View>
              <Text style={styles.label}>Updated Task Preview:</Text>
              <TaskItem task={updatedTask} onToggleComplete={() => {}} />
            </View>
          );
        } catch (error) {
          return <Text style={styles.errorText}>Invalid edit data</Text>;
        }
      }

      if (type === "complete_task") {
        return (
          <View>
            <Text style={styles.label}>Task to Complete:</Text>
            <TaskItem task={{ ...targetTask, completed: true }} onToggleComplete={() => {}} />
          </View>
        );
      }

      return (
        <View>
          <Text style={styles.label}>Task to Delete:</Text>
          <TaskItem task={targetTask} onToggleComplete={() => {}} />
        </View>
      );
    }

    // Event intents
    if (type === "add_event") {
      try {
        const newEvent = createEvent(params);
        return (
          <View>
            <Text style={styles.label}>New Event Preview:</Text>
            <EventItem event={newEvent} />
          </View>
        );
      } catch (error) {
        return <Text style={styles.errorText}>Invalid event data</Text>;
      }
    }

    if (type === "edit_event" || type === "delete_event") {
      const searchKey = params.title || params.description || "";
      if (!searchKey) {
        return <Text style={styles.errorText}>No event identifier provided</Text>;
      }

      const eventFuse = new Fuse<CalendarEvent>(events, {
        keys: ["title", "description"],
        threshold: 0.3,
      });
      const matches = eventFuse.search(searchKey);

      if (matches.length === 0) {
        return <Text style={styles.errorText}>No matching event found</Text>;
      }

      const targetEvent = matches[0].item;

      if (type === "edit_event") {
        try {
          const updatedEvent = createEvent({ ...targetEvent, ...params });
          return (
            <View>
              <Text style={styles.label}>Updated Event Preview:</Text>
              <EventItem event={updatedEvent} />
            </View>
          );
        } catch (error) {
          return <Text style={styles.errorText}>Invalid edit data</Text>;
        }
      }

      return (
        <View>
          <Text style={styles.label}>Event to Delete:</Text>
          <EventItem event={targetEvent} />
        </View>
      );
    }

    // Habit intents
    if (type === "add_habit") {
      try {
        const newHabit = createHabit(params);
        return (
          <View>
            <Text style={styles.label}>New Habit Preview:</Text>
            <HabitItem habit={newHabit} />
          </View>
        );
      } catch (error) {
        return <Text style={styles.errorText}>Invalid habit data</Text>;
      }
    }

    if (type === "edit_habit" || type === "delete_habit" || type === "checkin_habit") {
      const searchKey = params.title || "";
      if (!searchKey) {
        return <Text style={styles.errorText}>No habit identifier provided</Text>;
      }

      const habitFuse = new Fuse<Habit>(habits, {
        keys: ["title"],
        threshold: 0.3,
      });
      const matches = habitFuse.search(searchKey);

      if (matches.length === 0) {
        return <Text style={styles.errorText}>No matching habit found</Text>;
      }

      const targetHabit = matches[0].item;

      if (type === "edit_habit") {
        try {
          const updatedHabit = createHabit({ ...targetHabit, ...params });
          return (
            <View>
              <Text style={styles.label}>Updated Habit Preview:</Text>
              <HabitItem habit={updatedHabit} />
            </View>
          );
        } catch (error) {
          return <Text style={styles.errorText}>Invalid edit data</Text>;
        }
      }

      if (type === "checkin_habit") {
        return (
          <View>
            <Text style={styles.label}>Habit to Check In:</Text>
            <HabitItem habit={targetHabit} />
          </View>
        );
      }

      return (
        <View>
          <Text style={styles.label}>Habit to Delete:</Text>
          <HabitItem habit={targetHabit} />
        </View>
      );
    }

    // Other intents
    return (
      <View>
        <Text style={styles.label}>Action: {type}</Text>
        <Text style={styles.paramsText}>{JSON.stringify(params, null, 2)}</Text>
      </View>
    );
  };
  //console.log("modal intent", intent)
  //console.log(intent===null)
  if (intent == null) return null;
  return (
    <Portal>
      <View style={styles.container}>
        <Modal
          visible={visible}
          onDismiss={() => setVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={{ padding: 3 }}>
            <Text style={{ color: "#ffffff" }}>Intent: {intent.intent}</Text>
            <Text style={{ color: "#ffffff" }}>
              Params: {JSON.stringify(intent.params, null, 2)}
            </Text>
            {renderPreview()}
            <Button
              mode="contained"
              buttonColor="#999999ff"
              textColor="white"
              style={{ marginVertical: 4 }}
              onPress={onConfirm}
            >
              {"Confirm"}
            </Button>
            <Button
              mode="contained"
              buttonColor="#999999ff"
              textColor="white"
              style={{ marginVertical: 4 }}
              onPress={() => setVisible(false)}
            >
              {"Cancel"}
            </Button>
          </View>
        </Modal>
      </View>
    </Portal>
  );
}
const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#0d0c0ec5",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
  content: {
    padding: 3,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 8,
  },
  paramsText: {
    color: "#cccccc",
    fontSize: 14,
    fontFamily: "monospace",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    marginVertical: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    marginVertical: 4,
  },
});
