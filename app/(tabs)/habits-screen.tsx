import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { FAB, Portal, Provider, Text, Searchbar } from "react-native-paper";

import { useData } from "@/hooks/use-data";
import { Habit } from "@/types/habits";
import {GlobalMetricKey} from "@/types/metrics";

import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { GoalCompletionModal } from "@/components/modal/goal-completion-modal";
import HabitHeatmap from "@/components/ui/habits/habit-heatmap";
import { useHabitForm } from "@/hooks/use-habit-form";
import { ThemeContext } from "@/context/ThemeContext";
import { cancelReminder } from "@/hooks/use-notifications";
import {
  wasHabitCheckInMissed,
  restartHabitAfterGoal,
} from "@/utils/habit-utils";

// TODO : shifting logic from habit-screen , habit-item, habiit-stats to utils maybe
export default function HabitsScreen() {
  const { theme } = useContext(ThemeContext);
  const { habits, setHabits, trackMetric, appMetrics } = useData();
  const [filteredHabits, setFilteredHabits] = useState<Habit[]>(habits);
  const [searchQuery, setSearchQuery] = useState("");
  const [visible, setVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [completedHabit, setCompletedHabit] = useState<Habit | null>(null);
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

  const handleUpdate = useCallback(
    (updated: Habit) => {
      setHabits((prevHabits) => {
        return prevHabits.map((h) => {
          if (h.id !== updated.id) {
            return h;
          }
          let updateMetrics: GlobalMetricKey[] = [];
          if (h.history.length < updated.history.length) {
            updateMetrics.push("habitsCheckedIn");
          }
          if (updated.streak === updated.goal) {
            updateMetrics.push("habitsGoalsCompleted");
          }
          if (
            (!h.freezeHistory && updated.freezeHistory) ||
            (h.freezeHistory &&
              updated.freezeHistory &&
              h.freezeHistory.length < updated.freezeHistory.length)
          ) {
            updateMetrics.push("habitsFrozen");
          }
          if(updateMetrics.length > 0){
            trackMetric(updateMetrics, 1);
          }
          return updated;
        });
      });
    },
    [trackMetric],
  );

  const handleDelete = useCallback((id: string) => {
    if (id === "") return;
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
  }, []);

  const handleGoalRestart = useCallback(
    (updated: Habit) => {
      handleUpdate(restartHabitAfterGoal(updated));
      setGoalModalVisible(false);
    },
    [handleUpdate],
  );

  const handleGoalReached = useCallback((habit: Habit) => {
    setCompletedHabit(habit);
    setGoalModalVisible(true);
  }, []);

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    datasets: [{ data: [1, 2, 3, 4, 5] }],
  };

  useEffect(() => {
    setFilteredHabits(
      habits.filter((habit) =>
        habit.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [searchQuery, habits]);

  return (
    <Provider>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Searchbar
          placeholder="Search Habits"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: theme.habitBaseTrans }]}
        />
        <FlatList
          data={filteredHabits}
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            appMetrics && <HabitHeatmap metrics={appMetrics} />
          }
          renderItem={({ item }) => (
            <HabitItem
              habit={item}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(item.id)}
              onGoalReached={handleGoalReached}
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
        {completedHabit && (
          <GoalCompletionModal
            visible={goalModalVisible}
            habit={completedHabit}
            onRestart={handleGoalRestart}
            onDelete={() => {
              if (completedHabit) handleDelete(completedHabit.id);
              setGoalModalVisible(false);
            }}
            onDismiss={() => setGoalModalVisible(false)}
          />
        )}
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
  searchbar: {
    marginHorizontal: 4,
    marginVertical: 8,
    //height: "6%",
  },
});
