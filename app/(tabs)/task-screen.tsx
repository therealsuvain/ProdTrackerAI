import { useRef, useState } from "react";
import {
  Alert,
  Platform,
  TouchableOpacity,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { randomUUID } from "expo-crypto";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Button,
  FAB,
  Menu,
  Modal,
  Portal,
  Provider,
  Searchbar,
  Text,
  TextInput,
  SegmentedButtons,
  Switch,
} from "react-native-paper";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useData } from "@/hooks/use-data";
import { Task } from "@/types/task";
import TaskItem from "@/components/ui/tasks/task-item";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import {
  cancelReminder,
  scheduleReminderTasks,
} from "@/hooks/use-notifications";
import TaskModal from "@/components/modal/task-modal";

export default function TaskScreen() {
  const { tasks, setTasks } = useData();
  const [visible, setVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminder, setReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState<Date | undefined>(undefined);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "duedate" | "manual">(
    "manual"
  );
  const filteredTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description &&
          t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 2, medium: 1, low: 0 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      } else if (sortBy === "duedate") {
        return (
          (a.dueDate?.getTime() || Infinity) -
          (b.dueDate?.getTime() || Infinity)
        );
      }
      return 0;
    });

  const showModal = (task?: Task) => {
    setEditingTask(task || null);
    setTitle(task?.title || "");
    setDescription(task?.description || "");
    setPriority(task?.priority || "medium");
    setDueDate(task?.dueDate);
    setVisible(true);
  };

  const hideModal = () => {
    setVisible(false);
  };

  const handleSave = async () => {
    if (!title) return Alert.alert("Title is required");
    const newTask: Task = {
      id: editingTask ? editingTask.id : randomUUID(),
      title,
      description,
      reminder,
      reminderDate,
      notificationId: editingTask ? editingTask.notificationId : undefined,
      priority,
      dueDate,
      completed: editingTask ? editingTask.completed : false,
    };
    if (editingTask) {
      setTasks(tasks.map((t) => (t.id === editingTask.id ? newTask : t)));
    } else {
      if (newTask.reminder) {
        const notifId = await scheduleReminderTasks(newTask);
        newTask.notificationId = notifId;
      }
      setTasks([...tasks, newTask]);
    }
    hideModal();
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          setTasks((currentTasks) => {
            const task = currentTasks.find((e: Task) => e.id === id);
            if (task?.notificationId) {
              cancelReminder(task.notificationId);
            }
            return currentTasks.filter((e: Task) => e.id !== id);
          });
        },
      },
    ]);
  };

  const toggleComplete = (id: string) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const onDataChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDueDate(selectedDate);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) setReminderDate(selectedDate);
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => {
    setTasks(data);
  };
  //console.log("menu", menuVisible);
  const [showSortOptions, setShowSortOptions] = useState(false);
  return (
    <Provider>
      <GestureHandlerRootView>
        <View style={styles.container}>
          <Searchbar
            placeholder="Search Tasks"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <View style={{ zIndex: 1000 }}>
            <Button onPress={() => setShowSortOptions(!showSortOptions)}>
              Sort By
            </Button>

            {showSortOptions && (
              <View
                style={{
                  position: "absolute",
                  top: 40,
                  left: 160,
                  backgroundColor: "#2d2a30ff",
                  borderRadius: 8,
                  padding: 8,
                  width: 150,
                  zIndex: 1001,
                  elevation: 5,
                }}
              >
                <Button
                  mode="text"
                  onPress={() => {
                    setSortBy("priority");
                    setShowSortOptions(false);
                  }}
                >
                  Priority
                </Button>
                <Button
                  mode="text"
                  onPress={() => {
                    setSortBy("duedate");
                    setShowSortOptions(false);
                  }}
                >
                  Due Date
                </Button>
                <Button
                  mode="text"
                  onPress={() => {
                    setSortBy("manual");
                    setShowSortOptions(false);
                  }}
                >
                  Manual
                </Button>
              </View>
            )}
          </View>

          {filteredTasks.length === 0 ? (
            <Text style={styles.noTasks}>No tasks found, Add one</Text>
          ) : (
            <View
              style={{
                flex: 1,
              }}
            >
              <DraggableFlatList
                data={filteredTasks}
                renderItem={({ item, drag }) => (
                  <TouchableOpacity onLongPress={drag}>
                    <TaskItem
                      task={item}
                      onToggleComplete={toggleComplete}
                      onEdit={() => showModal(item)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
                onDragEnd={handleDragEnd}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
          <FAB style={styles.fab} icon="plus" onPress={() => showModal()} />
        </View>
        <Portal>
          <TaskModal
            visible={visible}
            onDismiss={hideModal}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            priority={priority}
            setPriority={setPriority}
            dueDate={dueDate}
            showDatePicker={showDatePicker}
            setShowDatePicker={setShowDatePicker}
            onDateChange={onDataChange}
            reminder={reminder}
            setReminder={setReminder}
            reminderDate={reminderDate}
            showTimePicker={showTimePicker}
            setShowTimePicker={setShowTimePicker}
            onTimeChange={onTimeChange}
            handleSave={handleSave}
          />
        </Portal>
      </GestureHandlerRootView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    position: "relative",
  },
  searchbar: { marginBottom: 16 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: "#2d2a30ff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
  noTasks: { textAlign: "center", marginTop: 20 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 5,
  },
  text: { color: "#8f67d4ff", marginLeft: 10 },
});
