import React, {
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Text,
} from "react-native";
import { Button, FAB, Portal, Searchbar } from "react-native-paper";
import DraggableFlatList from "react-native-draggable-flatlist";
import Octicons from "@expo/vector-icons/Octicons";
import { useShallow } from "zustand/react/shallow";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Task } from "@/types/task";
import TaskItem from "@/components/ui/tasks/task-item";
import TaskModal from "@/components/modal/task-modal";
import { useTaskForm } from "@/hooks/use-forms/use-task-form";
import { ThemeContext } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/use-haptics";
import { withAlpha } from "@/utils/common-utils";
import { clearStorageByKey } from "@/utils/storage-utils";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import { useDbErrorToast } from "@/components/shared/db-error-toast";
import { useTaskStore } from "@/stores/use-task-store";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";
import {
  addTaskWithEffects,
  editTaskWithEffects,
  deleteTaskWithEffects,
  toggleTaskWithEffects,
  setTaskOrderWithEffects,
} from "@/utils/Data-services/task-services/task-actions";
function TaskScreenInner() {
  const { theme } = useContext(ThemeContext);

  const [visible, setVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "duedate" | "manual">(
    "manual",
  );
  const [showSortOptions, setShowSortOptions] = useState(false);
  const { showToast, dismissToast } = useDbErrorToast();
  const taskListRef = useRef<FlatList<string>>(null);
  const pendingTaskFocusId = useRef<string | null>(null);
  const handledTaskFocusRequest = useRef<string | null>(null);
  const [taskToFocus, setTaskToFocus] = useState<string | null>(null);

  const { state, updateField, onSubmit } = useTaskForm({
    addTask: addTaskWithEffects,
    editTask: editTaskWithEffects,
    editingTask,
    onClose: () => setVisible(false),
  });
  const { triggerHaptic } = useHaptics();

  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const router = useRouter();

  const {
    openAdd,
    openAddRequest,
    focusItemId,
    focusItemType,
    focusRequestId,
  } = useLocalSearchParams<{
    openAdd?: string;
    openAddRequest?: string;
    focusItemId?: string;
    focusItemType?: string;
    focusRequestId?: string;
  }>();

  const handledOpenAddRequest = useRef<string | null>(null);

  const filteredTaskIds = useTaskStore(
    useShallow((state) =>
      Object.values(state.tasksById)
        .filter(
          (task) =>
            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .sort((a, b) => {
          if (sortBy === "priority") {
            const priorityOrder = { high: 2, medium: 1, low: 0 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          }

          if (sortBy === "duedate") {
            return (
              (new Date(a.dueDate).getTime() || Infinity) -
              (new Date(b.dueDate).getTime() || Infinity)
            );
          }

          return 0;
        })
        .map((task) => task.id),
    ),
  );

  const showModal = useCallback((task?: Task) => {
    if (task) {
      setEditingTask(task);
      setIsEditing(true);
      setVisible(true);
      return;
    }
    setEditingTask(null);
    setIsEditing(false);
    setVisible(true);
  }, []);

  const hideModal = useCallback(() => {
    setIsEditing(false);
    setVisible(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (!taskToDelete) return;
    const id = taskToDelete;
    void deleteTaskWithEffects(id)
      .then(() => {
        triggerHaptic();
      })
      .catch(() => {
        showToast("Couldn't delete the task. It has been restored.");
      })
      .finally(() => setTaskToDelete(null));
  }, [
    deleteTaskWithEffects,
    taskToDelete,
    showToast,
    triggerHaptic /* , trackMetric */,
  ]);

  const toggleComplete = useCallback(
    (id: string) => {
      void toggleTaskWithEffects(id).catch(() => {
        showToast("Couldn't update the task. Changes have been undone.");
      });
    },
    [toggleTaskWithEffects, triggerHaptic, showToast /* trackMetric */],
  );

  const handleDragEnd = useCallback(
    ({ data }: { data: string[] }) => {
      triggerHaptic();
      setTaskOrderWithEffects(data);
    },
    [triggerHaptic],
  );
  const handleEditRow = useCallback(
    (id: string) => {
      const task = useTaskStore.getState().tasksById[id];
      if (task) showModal(task);
    },
    [showModal],
  );

  const handleDeleteRow = useCallback((id: string) => {
    setTaskToDelete(id);
  }, []);

  const keyExtractor = useCallback((id: string) => id, []);

  const renderTask = useCallback(
    ({ item: id }: { item: string }) => (
      <TaskItem
        id={id}
        onToggleComplete={toggleComplete}
        onEdit={handleEditRow}
        onDelete={handleDeleteRow}
      />
    ),
    [toggleComplete, handleEditRow, handleDeleteRow],
  );

  const renderDraggableTask = useCallback(
    ({ item: id, drag }: { item: string; drag: () => void }) => (
      <TouchableOpacity onLongPress={drag}>
        <TaskItem
          id={id}
          onToggleComplete={toggleComplete}
          onEdit={handleEditRow}
          onDelete={handleDeleteRow}
        />
      </TouchableOpacity>
    ),
    [toggleComplete, handleEditRow, handleDeleteRow],
  );

  const handleScrollToIndexFailed = useCallback(
    ({
      index,
      averageItemLength,
    }: {
      index: number;
      averageItemLength: number;
    }) => {
      const list = taskListRef.current;
      if (!list) return;

      // Approximate the item's location and allow the list to render there.
      list.scrollToOffset({
        offset: Math.max(0, averageItemLength * index),
        animated: false,
      });

      // Retry after the list has had an opportunity to measure more rows.
      setTimeout(() => {
        taskListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
          viewOffset: 8,
        });
      }, 120);
    },
    [],
  );

  useEffect(() => {
    if (
      focusItemType !== "task" ||
      !focusItemId ||
      !focusRequestId ||
      handledTaskFocusRequest.current === focusRequestId
    ) {
      return;
    }

    handledTaskFocusRequest.current = focusRequestId;

    // Clear any existing Tasks-screen search filter.
    setSearchQuery("");

    // Schedule scrolling once the list contains the requested task.
    setTaskToFocus(focusItemId);

    // Consume this navigation request so it isn't replayed.
    router.setParams({
      focusItemId: undefined,
      focusItemType: undefined,
      focusRequestId: undefined,
    });
  }, [focusItemId, focusItemType, focusRequestId, router]);

  useEffect(() => {
    if (!taskToFocus) return;

    const index = filteredTaskIds.indexOf(taskToFocus);

    // The store may still be loading, or the task may no longer exist.
    // Keep the request pending until the item becomes available.
    if (index === -1) return;

    const frame = requestAnimationFrame(() => {
      const list = taskListRef.current;

      if (!list) return;

      list.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0,
        viewOffset: 8,
      });

      setTaskToFocus(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [taskToFocus, filteredTaskIds, sortBy]);

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

  useEffect(() => {
    if (
      openAdd !== "1" ||
      !openAddRequest ||
      handledOpenAddRequest.current === openAddRequest
    ) {
      return;
    }

    // Prevent this request from opening the modal more than once.
    handledOpenAddRequest.current = openAddRequest;

    showModal();

    // Clear the request so it won't be replayed on a later visit.
    router.setParams({
      openAdd: undefined,
      openAddRequest: undefined,
    });
  }, [openAdd, openAddRequest, router, showModal]);
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
              data={filteredTaskIds}
              ref={taskListRef as any}
              renderItem={renderDraggableTask}
              keyExtractor={keyExtractor}
              onDragEnd={handleDragEnd}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              ListEmptyComponent={EmptyState}
            />
          </View>
        ) : (
          <View style={styles.flatlist}>
            <FlatList
              data={filteredTaskIds}
              ref={taskListRef}
              renderItem={renderTask}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              onScrollToIndexFailed={handleScrollToIndexFailed}
              ListEmptyComponent={EmptyState}
            />
          </View>
        )}
        <FAB style={styles.fab} icon="plus" onPress={() => showModal()} />
        {/*  <FAB style={styles.fab} icon="plus" onPress={() => allScheduledNotificationsLogs()} /> */}
        {/*  <FAB
          style={styles.fab}
          icon="plus"
          onPress={async () => {
            clearStorageByKey("AI_TOKEN_MONITOR_STATS");
            const stored = await AsyncStorage.getItem("AI_TOKEN_MONITOR_STATS");
            if (stored) console.log(JSON.parse(stored));
          }}
        /> */}
      </View>
      <Portal>
        <TaskModal
          visible={visible}
          onDismiss={hideModal}
          state={state}
          updateField={updateField}
          onSubmit={onSubmit}
          editingTask={editingTask}
          isNew={!isEditing}
        />
      </Portal>
      <ConfirmDialog
        visible={taskToDelete !== null}
        title="Delete Task"
        description="Are you sure you want to delete this task?"
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => setTaskToDelete(null)}
        onConfirm={handleDelete}
      />
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
