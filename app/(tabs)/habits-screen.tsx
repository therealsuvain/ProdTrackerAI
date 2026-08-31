import { View, StyleSheet, FlatList, Text } from "react-native";
import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { FAB, Portal, Searchbar } from "react-native-paper";

import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useData } from "@/hooks/context-hooks/use-data";
import { Habit } from "@/types/habits";
import { GlobalMetricKey } from "@/types/metrics";

import HabitItem from "@/components/ui/habits/habit-item";
import HabitModal from "@/components/modal/habit-modal";
import { GoalCompletionModal } from "@/components/modal/goal-completion-modal";
import HabitHeatmap from "@/components/ui/habits/habit-heatmap";
import { useHabitForm } from "@/hooks/use-forms/use-habit-form";
import { ThemeContext } from "@/context/ThemeContext";
import { cancelReminder } from "@/hooks/use-notifications";
import { withAlpha } from "@/utils/common-utils";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { usePlaySound } from "@/hooks/use-play-sound";
import { ScreenErrorBoundary } from "@/components/shared/screen-error-boundary";
import {
  DbErrorToast,
  useDbErrorToast,
} from "@/components/shared/db-error-toast";
import { useHaptics } from "@/hooks/use-haptics";
import { useScreenReady } from "@/hooks/use-screen-ready";
import { EntitySkeleton } from "@/components/shared/loading-indicators/screen-loaders/entity-skeleton";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";

// TODOOptim : shifting logic from habit-screen , habit-item, habiit-stats to utils maybe
function HabitsScreenInner() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { habits, addHabit, editHabit, removeHabit } = useHabits();
  const { trackMetric, appMetrics } = useData();
  const [filteredHabits, setFilteredHabits] = useState<Habit[]>(habits);
  const [searchQuery, setSearchQuery] = useState("");
  const [visible, setVisible] = useState(false);
  const [visibleInEditMode, setVisibleInEditMode] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [completedHabit, setCompletedHabit] = useState<Habit | null>(null);
  const { toastError, showToast, dismissToast } = useDbErrorToast();
  const { triggerHaptic } = useHaptics();
  const { state, updateField, onSubmit } = useHabitForm({
    addHabit,
    editHabit,
    editingHabit,
    onClose: () => {
      setVisible(false);
      setVisibleInEditMode(false);
    },
  });
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const audioSource = require("@/assets/audio/habit-congrats-2.mp3");
  const audioPlayer = usePlaySound(audioSource, 0.5);
  const showModal = (habit?: Habit) => {
    if (habit) {
      setVisibleInEditMode(true);
      setVisible(true);
      setEditingHabit(habit);
      return;
    }
    setEditingHabit(null);
    setVisible(true);
  };
  const hideModal = () => {
    setVisibleInEditMode(false);
    setVisible(false);
  };

  const handleUpdate = useCallback(
    async (updated: Habit) => {
      // console.log("Updated Habit:", updated.id);
      // console.log("Updated Habitsss:", habits.map((h)=>h.id));
      const habit = habits.find((h) => h.id === updated.id);
      if (!habit) return;
      try {
        await editHabit(updated);
        let updateMetrics: GlobalMetricKey[] = [];
        if (habit.history.length < updated.history.length) {
          updateMetrics.push("habitsCheckedIn");
        }
        if (
          !updated.pendingStreakResetAfter &&
          updated.streak === updated.goal
        ) {
          updateMetrics.push("habitsGoalsCompleted");
        }
        if (
          (!habit.freezeHistory && updated.freezeHistory) ||
          (habit.freezeHistory &&
            updated.freezeHistory &&
            habit.freezeHistory.length < updated.freezeHistory.length)
        ) {
          updateMetrics.push("habitsFrozen");
        }
        if (habit.streak < updated.streak) {
          if (updated.frequency === "daily") {
            trackMetric(["habitsStreakMaxDaily"], updated.streak);
          } else {
            trackMetric(["habitsStreakMaxWeekly"], updated.streak);
          }
        }
        if (habit.streak !== updated.streak) {
          const now = new Date();
          const nowSecs =
            now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
          const TWO_AM = 2 * 3600;
          const FOUR_AM = 4 * 3600;
          const EIGHT_AM = 8 * 3600;
          const TEN_PM = 22 * 3600;
          if (nowSecs <= EIGHT_AM && nowSecs >= FOUR_AM) {
            updateMetrics.push("habitsCheckedInBefore8am");
          } else if (nowSecs >= TEN_PM || nowSecs <= TWO_AM) {
            updateMetrics.push("habitsCheckedInAfter10pm");
          }
        }
        if (updateMetrics.length > 0) {
          trackMetric(updateMetrics, 1);
        }
      } catch (e) {
        showToast("Couldn't save habit. Changes have been undone.");
      }
    },
    [trackMetric, habits],
  );

  const handleDelete = useCallback(async () => {
    if (!habitToDelete) return;
    const id = habitToDelete;
    if (id === "") return;

    const habit = habits.find((h: Habit) => h.id === id);
    if (habit?.notificationId) {
      cancelReminder(habit.notificationId);
    }
    try {
      if (!habit) return;
      await removeHabit(id);
      if (habit.streak < habit.goal && history.length === 0) {
        trackMetric(["habitsDeleted", "habitsAbandoned"], 1);
      } else {
        trackMetric(["habitsDeleted"], 1);
      }
      triggerHaptic();
    } catch {
      showToast("Couldn't delete the habit. It has been restored.");
    } finally {
      setHabitToDelete(null);
    }
  }, [habitToDelete, trackMetric, habits]);

  const handleGoalRestart = useCallback(
    (updated: Habit) => {
      handleUpdate(updated);
      setGoalModalVisible(false);
      trackMetric(["habitGoalsRestarted"], 1);
    },
    [handleUpdate, trackMetric],
  );

  const handleGoalReached = useCallback(
    (habit: Habit) => {
      setCompletedHabit(habit);
      setGoalModalVisible(true);
      audioPlayer.seekTo(0);
      audioPlayer.play();
      trackMetric(["habitsGoalsCompleted"], 1);
    },
    [trackMetric],
  );

  useEffect(() => {
    setFilteredHabits(
      habits.filter((habit) =>
        habit.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    );
  }, [searchQuery, habits]);
  const emptyStateColor = isDarkMode ? theme.habitBase : theme.habitDarkPrimary;
  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <FontAwesome6 name="bars-progress" size={60} color={emptyStateColor} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(emptyStateColor, "99") },
        ]}
      >
        This is your habits page
      </Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added habits will be shown here
      </Text>
      <View
        style={[
          emptyStateStyle.suggestionBox,
          { borderColor: withAlpha(emptyStateColor, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: emptyStateColor }]}
        >
          Habits can have daily and weekly goals with on specific days of the
          week
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: emptyStateColor }]}
        >
          1 Free streak freeze is given per habit, every 5 successive check-ins
          earn 1 additional freeze
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
          rippleColor="#ffffff96"
          iconColor={theme.whiteBase}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: theme.habitBaseTrans }]}
          theme={{ colors: { onSurfaceVariant: theme.whiteBase } }}
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
              onDelete={() => setHabitToDelete(item.id)}
              onEdit={() => showModal(item)}
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
      <DbErrorToast error={toastError} onDismiss={dismissToast} />
      <Portal>
        <HabitModal
          visible={visible}
          visibleInEditMode={visibleInEditMode}
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
              if (completedHabit) setHabitToDelete(completedHabit.id);
              setGoalModalVisible(false);
            }}
            onDismiss={() => setGoalModalVisible(false)}
          />
        )}
      </Portal>
      <ConfirmDialog
        visible={habitToDelete !== null}
        title="Delete Log"
        description="Are you sure you want to delete this log?"
        confirmText="Delete"
        confirmVariant="destructive"
        onCancel={() => setHabitToDelete(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default function HabitsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const isReady = useScreenReady();
  if (!isReady) return <EntitySkeleton isDark={isDarkMode} />;
  return (
    <ScreenErrorBoundary screenName="Habits">
      <HabitsScreenInner />
    </ScreenErrorBoundary>
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
});
