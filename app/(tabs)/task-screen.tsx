import { useState } from "react";
import {
  Alert,
  Platform,
  TouchableOpacity,
  View,
  StyleSheet,
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
  SegmentedButtons
} from "react-native-paper";
import DraggableFlatList from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useDataTest } from "@/hooks/use-data-test";
import { Task } from "@/types/task";
import TaskItem from "@/components/ui/task-item";


export default function TaskScreen() {
  const { tasks, setTasks } = useDataTest();
  const [visible, setVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const handleSave = () => {
    if (!title) return Alert.alert("Title is required");
    const newTask: Task = {
      id: editingTask ? editingTask.id : randomUUID(),
      title,
      description,
      priority,
      dueDate,
      completed: editingTask ? editingTask.completed : false,
    };
    if (editingTask) {
      setTasks(tasks.map((t) => (t.id === editingTask.id ? newTask : t)));
    } else {
      setTasks([...tasks, newTask]);
    }
    hideModal();
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: () => setTasks(tasks.filter((t) => t.id !== id)),
      },
    ]);
  };

  const toggleComplete = (id: string) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const onDataChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) setDueDate(selectedDate);
  };

  const handleDragEnd = ({ data }: { data: Task[] }) => {
    setTasks(data);
  };
  //console.log("menu", menuVisible);
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

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button onPress={() => setMenuVisible(true)}>Sort By</Button>
            }
            style={{ flexDirection: "column", width: "100%" }}
          >
            <Menu.Item
              onPress={() => {
                setSortBy("priority");
                setMenuVisible(false);
              }}
              title="Priority"
            />
            <Menu.Item
              onPress={() => {
                setSortBy("duedate");
                setMenuVisible(false);
              }}
              title="Due Date"
            />
            <Menu.Item
              onPress={() => {
                setSortBy("manual");
                setMenuVisible(false);
              }}
              title="Manual"
            />
          </Menu>

          {filteredTasks.length === 0 ? (
            <Text style={styles.noTasks}>No tasks found, Add one</Text>
          ) : (
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
                mode="outlined"
                label="Title"
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                mode="outlined"
                label="Description"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <SegmentedButtons
                value={priority}
                onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}
                buttons={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                style={{ marginVertical: 8 }}
              />
              <Button mode="elevated" style={{marginVertical:2.5}} onPress={() => setShowDatePicker(true)}>
                Pick Due Date
              </Button>
              {dueDate && <Text style={{alignSelf:"center", marginVertical:2.5, fontSize:20}}>{dueDate.toDateString()}</Text>}
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={onDataChange}
                />
              )}
              <Button mode="elevated" style={{marginVertical:2.5}} onPress={handleSave}>Save</Button>
              <Button mode="elevated" style={{marginVertical:2.5}} onPress={hideModal}>Cancel</Button>
            </Modal>
          </View>
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
    borderWidth:1,
    borderColor:"#1e1c20ff"
  },
  noTasks: { textAlign: "center", marginTop: 20 },
});
