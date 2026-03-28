import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { FAB, Portal, Text, Searchbar } from "react-native-paper";

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
import { withAlpha } from "@/utils/common-utils";
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { usePlaySound } from "@/hooks/use-play-sound";

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
  const audioSource = require("@/assets/audio/habit-congrats-2.mp3");
  const audioPlayer = usePlaySound(audioSource, 0.5);
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
    audioPlayer.seekTo(0);
    audioPlayer.play();
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

  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <FontAwesome6 name="bars-progress" size={60} color={theme.habitBase} />
      <Text style={[emptyStateStyle.emptyTitle, { color: withAlpha(theme.habitBase,"99") }]}>This is your habits page</Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added habits will be shown here
      </Text>
      <View style={[emptyStateStyle.suggestionBox, { borderColor: withAlpha(theme.habitBase,"33")}]}>
        <Text style={[emptyStateStyle.suggestionText, { color: theme.habitBase }]}>
          Habits can have daily and weekly goals with on specific days of the week
        </Text>
        <Text style={[emptyStateStyle.suggestionText, { color: theme.habitBase }]}>
          1 Free streak freeze is given per habit, every 5 successive check-ins earn 1 additional freeze
        </Text>
      </View>
    </View>
  );

  return (
    <>
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
          ListEmptyComponent={EmptyState}
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
    </>
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

const emptyStateStyle = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "20%", // Keeps it centered in the upper-middle
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
})
