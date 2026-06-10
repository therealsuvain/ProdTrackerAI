import { useContext, useState } from "react";
import {
  Alert,
  TouchableOpacity,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Text,
} from "react-native";
import {
  Button,
  FAB,
  Portal,
  Searchbar,
  TouchableRipple,
  useTheme,
} from "react-native-paper";
import DraggableFlatList from "react-native-draggable-flatlist";
import Octicons from "@expo/vector-icons/Octicons";

import { useData } from "@/hooks/context-hooks/use-data";
import { Task } from "@/types/task";
import TaskItem from "@/components/ui/tasks/task-item";
import {
  cancelReminder,
  allScheduledNotificationsLogs,
  cancelAllScheduledNotifications,
} from "@/hooks/use-notifications";
import TaskModal from "@/components/modal/task-modal";
import { useTaskForm } from "@/hooks/use-forms/use-task-form";
import { ThemeContext } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/use-haptics";
import { withAlpha } from "@/utils/common-utils";
import { clearStorageByKey } from "@/utils/storage-utils";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import {
  DbErrorToast,
  useDbErrorToast,
} from "@/components/shared/db-error-toast";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
function TaskScreenInner() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { tasks, setTasks, addTask, editTask, removeTask, toggleTask } =
    useTasks();
  const { trackMetric, addTags } = useData();
  const [visible, setVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "duedate" | "manual">(
    "manual",
  );
  const [showSortOptions, setShowSortOptions] = useState(false);
  const { toastError, showToast, dismissToast } = useDbErrorToast();
  const { state, updateField, onSubmit } = useTaskForm({
    addTask,
    editTask,
    editingTask,
    onClose: () => setVisible(false),
  });
  const { triggerHaptic } = useHaptics();
  const filteredTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description &&
          t.description.toLowerCase().includes(searchQuery.toLowerCase())),
    )
    .sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 2, medium: 1, low: 0 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      } else if (sortBy === "duedate") {
        return (
          (new Date(a.dueDate).getTime() || Infinity) -
          (new Date(b.dueDate).getTime() || Infinity)
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
          const task = tasks.find((e: Task) => e.id === id);
          if (task?.notificationId) {
            cancelReminder(task.notificationId);
          }
          try {
            await removeTask(id);
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the task. It has been restored.");
          }
        },
      },
    ]);
  };

  const toggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    try {
      await toggleTask(id);

      // Track metric — same logic as before, using pre-toggle state
      if (task.completed) {
        trackMetric(["tasksCompleted"], -1); // undoing completion
      } else {
        trackMetric(["tasksCompleted"], 1);
        triggerHaptic();
      }
    } catch {
      showToast("Couldn't update the task. Changes have been undone.");
    }
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => {
    setTasks(data);
    triggerHaptic();
  };

  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <Octicons name="tasklist" size={60} color={theme.taskBase} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(theme.taskBase, "99") },
        ]}
      >
        This is your task page
      </Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added tasks will be shown here
      </Text>
      <View
        style={[
          emptyStateStyle.suggestionBox,
          { borderColor: withAlpha(theme.taskBase, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: theme.taskBase }]}
        >
          Tasks can have priorities, due dates, and descriptions
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: theme.taskBase }]}
        >
          You can search tasks by title or description, sort them by priority,
          due date, or manually by dragg and drop
        </Text>
      </View>
    </View>
  );
  const paperTheme = useTheme();
  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Searchbar
          placeholder="Search Tasks"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[
            styles.searchbar,
            { backgroundColor: theme.taskBaseTransToo },
          ]}
        />
        <View style={styles.menuButton}>
          <Button onPress={() => setShowSortOptions(!showSortOptions)}>
            Sort By
          </Button>

          {showSortOptions && (
            <View
              style={[
                styles.menu,
                { backgroundColor: theme.taskDarkSecondary },
              ]}
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

        {sortBy === "manual" ? (
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
              ListEmptyComponent={EmptyState}
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
              ListEmptyComponent={EmptyState}
            />
          </View>
        )}
        <FAB style={styles.fab} icon="plus" onPress={() => showModal()} />
        <DbErrorToast error={toastError} onDismiss={dismissToast} />
        {/*  <FAB style={styles.fab} icon="plus" onPress={() => allScheduledNotificationsLogs()} /> */}
        {/* <FAB
          style={styles.fab}
          icon="plus"
          onPress={async () => {
             const stored = await AsyncStorage.getItem("AI_TOKEN_MONITOR_STATS");
            if (stored) console.log(JSON.parse(stored)); 
            clearStorageByKey("AI_TOKEN_MONITOR_STATS");
               clearStorageByKey("timeLogs");
            clearStorageByKey("@prodtracker_metrics");
            clearStorageByKey("@prodtracker_achievements");
            clearStorageByKey("tasks");
            clearStorageByKey("habits");
            clearStorageByKey("events");
            clearStorageByKey("messages"); 
          }}
        /> */}
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={async () => {
            clearStorageByKey("AI_TOKEN_MONITOR_STATS");
            const stored = await AsyncStorage.getItem("AI_TOKEN_MONITOR_STATS");
            if (stored) console.log(JSON.parse(stored));
          }}
        />
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
    </>
  );
}

export default function TaskScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const isReady = useScreenReady();
  if (!isReady) return <EntitySkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Tasks">
      <TaskScreenInner />
    </ScreenErrorBoundary>
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
    zIndex: 1,
  },
  searchbar: { marginBottom: 16 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
  noTasks: { textAlign: "center", marginTop: 20 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 5,
  },
});

const emptyStateStyle = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "40%", // Keeps it centered in the upper-middle
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  suggestionBox: {
    marginTop: 30,
    width: "100%",
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
  },
  suggestionText: {
    fontSize: 13,
    marginVertical: 5,
    textAlign: "center",
  },
});
