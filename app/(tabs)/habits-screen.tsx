import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useState } from "react";
import { useData } from "@/hooks/use-data";
import { Habit } from "@/types/habits";
import {
  Button,
  FAB,
  Modal,
  Portal,
  Provider,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";
import { LineChart } from "react-native-chart-kit";
import HabitItem from "@/components/ui/habits/habit-item";

export default function HabitsScreen() {
  const { habits, setHabits } = useData();
  const [visible, setVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [goal, setGoal] = useState("");

  const showModal = (habit?: Habit) => {
    setEditingHabit(habit || null);
    setTitle(habit?.title || "");
    setFrequency(habit?.frequency || "daily");
    setGoal(habit?.goal?.toString() || "");
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const handleSave = () => {
    if (!title) return Alert.alert("Error", "Name is required");
    const newHabit: Habit = {
      id: editingHabit ? editingHabit.id : Date.now().toString(),
      title,
      frequency,
      streak: editingHabit ? editingHabit.streak : 0,
      lastCompleted: editingHabit ? editingHabit.lastCompleted : undefined,
      goal: goal ? parseInt(goal) : undefined,
    };
    if (editingHabit) {
      setHabits(habits.map((h) => (editingHabit.id === h.id ? newHabit : h)));
    } else {
      setHabits([...habits, newHabit]);
    }
    hideModal();
  };

  const handleUpdate = (updated: Habit) => {
    setHabits(habits.map((h) => (h.id === updated.id ? updated : h)));
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Habit", "Are you sure", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: () => setHabits(habits.filter((h) => h.id !== id)),
      },
    ]);
  };

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets: [{ data: [1, 2, 3, 4, 5] }],
  };
  return (
    <Provider>
      <View style={styles.container}>
        <FlatList
          data={habits}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HabitItem
              habit={item}
              onUpdate={handleUpdate}
              onDelete={()=>handleDelete(item.id)}
            />
          )}
          ListEmptyComponent={<Text>No habits yet-add one</Text>}
        />
        <FAB style={styles.fab} icon="plus"  onPress={() => showModal()} />
      </View>
      <Portal>
          <Modal
            visible={visible}
            onDismiss={hideModal}
            contentContainerStyle={styles.modal}
          >
            <TextInput
              style={{ marginVertical: 2.5 }}
              label="Habit Name"
              mode="outlined"
              activeOutlineColor="#f1b718ff"
              value={title}
              onChangeText={setTitle}
            />

            <SegmentedButtons
              style={{ marginVertical: 2.5 }}
              value={frequency}
              onValueChange={(val) => setFrequency(val as "daily" | "weekly")}
              buttons={[
                {
                  value: "daily",
                  label: "Daily",
                  checkedColor: "#f1b718ff",
                  style: { backgroundColor: "#423205ff" },
                },
                {
                  value: "weekly",
                  label: "Weekly",
                  checkedColor: "#f1b718ff",
                  style: { backgroundColor: "#423205ff" },
                },
              ]}
            />
            <TextInput
              style={{ marginVertical: 2.5 }}
              label="Goal"
              mode="outlined"
              activeOutlineColor="#f1b718ff"
              value={goal}
              onChangeText={setGoal}
              keyboardType="numeric"
            />
            <Button
              style={{ marginVertical: 2.5 }}
              mode="elevated"
              buttonColor="#503c06ff"
              textColor="#f1b718ff"
              onPress={handleSave}
            >
              Save
            </Button>
            <Button
              style={{ marginVertical: 2.5 }}
              mode="elevated"
              buttonColor="#503c06ff"
              textColor="#f1b718ff"
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
  container: { flex: 1, padding: 16 },
  fab: { position: "absolute", margin: 16, right: 0, bottom: 0 , backgroundColor:"#f1b718ff"},
  modal: {
    backgroundColor: "#3b3525ff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2b2001ff",
  },
});
