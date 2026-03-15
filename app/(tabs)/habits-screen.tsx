import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useContext, useState } from "react";
import { useData } from "@/hooks/use-data";
import { Habit } from "@/types/habits";
import { FAB, Portal, Provider, Text } from "react-native-paper";
import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { useHabitForm } from "@/hooks/use-habit-form";
import { ThemeContext } from "@/context/ThemeContext";
import { cancelReminder } from "@/hooks/use-notifications";
import { wasHabitCheckInMissed } from "@/utils/habit-utils";

// TODO : shifting logic from habit-screen , habit-item, habiit-stats to utils maybe
export default function HabitsScreen() {
  const { theme } = useContext(ThemeContext);
  const { habits, setHabits, trackMetric } = useData();
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
    setHabits((prevHabits)=>{
      return prevHabits.map((h) => {
        if (h.id !== updated.id) {
          return h;
        }
        if (h.history.length < updated.history.length) {
          trackMetric("habitsCheckedIn", 1);
        }
        if(updated.streak === updated.goal){
          trackMetric("habitsGoalsCompleted", 1);
        }
        if((!h.freezeHistory && updated.freezeHistory)||(h.freezeHistory && updated.freezeHistory && (h.freezeHistory.length < updated.freezeHistory.length) )){
          trackMetric("habitsFrozen", 1);
        }
        if(wasHabitCheckInMissed(h, updated)){
          trackMetric('habitCheckInsMissed',1);
        }
        return updated;
      });
    })
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Habit", "Are you sure", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          setHabits((currentHabits) => {
            const habit = currentHabits.find((h: Habit) => h.id === id);
            if (habit?.notificationId) {
              cancelReminder(habit.notificationId);
            }
            return currentHabits.filter((h: Habit) => h.id !== id);
          });
        },
      },
    ]);
  };

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets: [{ data: [1, 2, 3, 4, 5] }],
  };
  return (
    <Provider>
      <View style={[styles.container, { backgroundColor: theme.background}]}>
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
        <FAB
          color={theme.habitDarkPrimary}
          style={[
            styles.fab,
            {
              backgroundColor: theme.habitBase,
              borderColor: theme.habitDarkSecondary,
            },
          ]}
          icon="plus"
          onPress={() => showModal()}
        />
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
    borderWidth: 1,
  },
});
