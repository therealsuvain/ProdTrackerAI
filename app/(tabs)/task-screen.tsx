import { useState } from "react";
import {
  Alert,
  TouchableOpacity,
  View,
  StyleSheet,
  FlatList,
} from "react-native";
import {
  Button,
  FAB,
  Portal,
  Provider,
  Searchbar,
  Text,
} from "react-native-paper";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useData } from "@/hooks/use-data";
import { Task } from "@/types/task";
import TaskItem from "@/components/ui/tasks/task-item";
import { cancelReminder } from "@/hooks/use-notifications";
import TaskModal from "@/components/modal/task-modal";
import { useTaskForm } from "@/hooks/use-task-form";

export default function TaskScreen() {
  const { tasks, setTasks } = useData();
  const [visible, setVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "duedate" | "manual">(
    "manual"
  );
  const { state, updateField, onSubmit } = useTaskForm({
    tasks,
    setTasks,
    editingTask,
    onClose: () => setVisible(false),
  });

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
    setVisible(true);
  };

  const hideModal = () => {
    setVisible(false);
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

  const handleDragEnd = ({ data }: { data: Task[] }) => {
    setTasks(data);
  };

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
          <View style={styles.menuButton}>
            <Button onPress={() => setShowSortOptions(!showSortOptions)}>
              Sort By
            </Button>

            {showSortOptions && (
              <View style={styles.menu}>
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
          ) : sortBy === "manual" ? (
            <View style={styles.flatlist}>
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
          ) : (
            <View style={styles.flatlist}>
              <FlatList
                data={filteredTasks}
                renderItem={({ item }) => (
                  <TaskItem
                    task={item}
                    onToggleComplete={toggleComplete}
                    onEdit={() => showModal(item)}
                    onDelete={() => handleDelete(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
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
            state={state}
            updateField={updateField}
            onSubmit={onSubmit}
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
  menu: {
    position: "absolute",
    top: 40,
    left: 160,
    backgroundColor: "#2d2a30ff",
    borderRadius: 8,
    padding: 8,
    width: 150,
    zIndex: 1001,
    elevation: 5,
  },
  flatlist: {
    flex: 1,
  },
  menuButton: {
    zIndex:1
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
