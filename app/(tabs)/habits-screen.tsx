import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useContext, useState } from "react";
import { useData } from "@/hooks/use-data";
import { Habit } from "@/types/habits";
import { FAB, Portal, Provider, Text } from "react-native-paper";
import { LineChart } from "react-native-chart-kit";
import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { useHabitForm } from "@/hooks/use-habit-form";
import { ThemeContext } from "@/context/ThemeContext";

export default function HabitsScreen() {
  const {theme}= useContext(ThemeContext)
  const { habits, setHabits } = useData();
  const [visible, setVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const { state, updateField, onSubmit } = useHabitForm({
    habits,
    setHabits,
    editingHabit,
    onClose: () => setVisible(false),
  });

  const showModal = (habit?: Habit) => {
    setEditingHabit(habit || null);
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

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
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListEmptyComponent={<Text>No habits yet-add one</Text>}
        />
        <FAB color={theme.habitDarkPrimary} style={[styles.fab,{backgroundColor:theme.habitBase, borderColor:theme.habitDarkSecondary}]} icon="plus" onPress={() => showModal()} />
      </View>
      <Portal>
        <HabitModal
          visible={visible}
          onDismiss={hideModal}
          state={state}
          updateField={updateField}
          onSubmit={onSubmit}
        />
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    borderWidth:1,
  },
});
