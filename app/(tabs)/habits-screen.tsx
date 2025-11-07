import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useRef, useState } from "react";
import { useData } from "@/hooks/use-data";
import { Habit } from "@/types/habits";
import {
  FAB,
  Portal,
  Provider,
  Text,
} from "react-native-paper";
import { LineChart } from "react-native-chart-kit";
import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { scheduleReminderHabits } from "@/hooks/use-notifications";

export default function HabitsScreen() {
  const { habits, setHabits } = useData();
      const [visible, setVisible] = useState(false);
      const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
      const [title, setTitle] = useState("");
      const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
      const [goal, setGoal] = useState("");
        const [reminder, setReminder] = useState(false);
    const [reminderDate, setReminderDate] = useState<Date | undefined>(
      undefined
    );
      const [showTimePicker, setShowTimePicker] = useState(false);
  

        const showModal = (habit?: Habit) => {
        setEditingHabit(habit || null);
        setTitle(habit?.title || "");
        setFrequency((habit?.frequency as "daily" | "weekly") || "daily");
        setGoal(habit?.goal?.toString() || "");
        setReminder(habit?.reminder ? true : false);
        setReminderDate(habit?.reminderDate || undefined);
        setVisible(true);
      }
    
      const hideModal = () => setVisible(false);
    
      const handleSave = async () => {
        if (!title) return Alert.alert("Error", "Name is required");
        const newHabit: Habit = {
          id: editingHabit ? editingHabit.id : Date.now().toString(),
          title,
          frequency,
          streak: editingHabit ? editingHabit.streak : 0,
          lastCompleted: editingHabit ? editingHabit.lastCompleted : undefined,
          reminder,
          reminderDate,
          goal: goal ? parseInt(goal) : undefined,
        };
        if (editingHabit) {
          setHabits(habits.map((h) => (editingHabit.id === h.id ? newHabit : h)));
        } else {
          if (newHabit.reminder) {
                  const notifId = await scheduleReminderHabits(newHabit);
                  newHabit.notificationId = notifId;
                }
          setHabits([...habits, newHabit]);
        }
        hideModal();
      };
        const onTimeChange= (event: any, selectedDate?: Date) => {
      setShowTimePicker(false);
      if (selectedDate) setReminderDate(selectedDate);
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
        <HabitModal
          visible={visible}
          onDismiss={hideModal}
          title={title}
          setTitle={setTitle}
          frequency={frequency}
          setFrequency={setFrequency}
          goal={goal}
          setGoal={setGoal}
          reminder={reminder}
          setReminder={setReminder}
          reminderDate={reminderDate}
          showTimePicker={showTimePicker}
          setShowTimePicker={setShowTimePicker}
          onTimeChange={onTimeChange}
          handleSave={handleSave}
        />
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fab: { position: "absolute", margin: 16, right: 0, bottom: 0 , backgroundColor:"#f1b718ff"},
});
