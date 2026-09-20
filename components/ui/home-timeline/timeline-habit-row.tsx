import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { TouchableOpacity, View, StyleSheet, Text } from "react-native";
import { ProgressBar } from "react-native-paper";
import { useHabitDeniedFeedback } from "../habits/habit-denied-feedback-util";
import { useHabitStore } from "@/stores/use-habit-store";
import { CheckInOutcome } from "@/utils/Data-services/habit-services/habit-actions";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import Animated from "react-native-reanimated";

interface TimelineHabitRow {
  id: string;
  onHabitCheckIn: (id: string) => Promise<CheckInOutcome | undefined>;
}

export const TimelineHabitRow = React.memo(function TimelineHabitRow({
  id,
  onHabitCheckIn,
}: TimelineHabitRow) {
  const { theme } = useTheme();
  const { playDeniedFeedback, animatedStyle } = useHabitDeniedFeedback();
  const habit = useHabitStore((state) => state.habitsById[id]);
  if (!habit) return null;

  const progress = habit.goal ? habit.streak / habit.goal : 0;
  const completed = habit.streak >= habit.goal;
  const handlePress = useCallback(async () => {
    const status = await onHabitCheckIn(id);
    if (
      status === "already_checked_in" ||
      status === "frozen" ||
      status === "not_a_target_day"
    ) {
      playDeniedFeedback();
      return;
    }
  }, [onHabitCheckIn, playDeniedFeedback]);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.habitCard,
          {
            backgroundColor: theme.habitDarkPrimary,
            borderColor: completed ? theme.success : theme.habitBaseTrans,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.habitCardHeader}>
          <Text
            style={[styles.habitTitle, { color: theme.whiteBase }]}
            numberOfLines={1}
          >
            {habit.title}
          </Text>
          <Ionicons
            name={completed ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={completed ? theme.success : theme.habitBase}
          />
        </View>
        <View style={styles.habitStats}>
          <Text style={[styles.habitStreak, { color: theme.habitBase }]}>
            🔥 {habit.streak} day streak
          </Text>
          <Text style={[styles.habitGoal, { color: theme.habitBase }]}>
            Goal: {habit.goal}
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={theme.habitBase}
          style={[styles.habitProgress, { backgroundColor: theme.modalBase }]}
        />
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  habitCard: {
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 160,
    borderWidth: 2,
  },
  habitCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  habitTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  habitStats: {
    marginBottom: 8,
  },
  habitStreak: {
    fontSize: 12,
    marginBottom: 2,
  },
  habitGoal: {
    fontSize: 11,
  },
  habitProgress: {
    height: 4,
    borderRadius: 2,
  },
});
