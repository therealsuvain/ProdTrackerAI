import React, { useMemo } from "react";
import { TimelineHabitRow } from "./timeline-habit-row";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { Ionicons } from "@expo/vector-icons";
import { CheckInOutcome } from "@/utils/Data-services/habit-services/habit-actions";

type TimelineHabitsProps = {
  habitIds: string[];
  completedHabitsCount: number;
  onHabitCheckIn: (id: string) => Promise<CheckInOutcome | undefined>;
};

export const TimelineHabits = React.memo(function TimelineHabits({
  habitIds,
  completedHabitsCount,
  onHabitCheckIn,
}: TimelineHabitsProps) {
  const { theme } = useTheme();
  const positions = useMemo(
    () =>
      habitIds.map((habitId, index) => ({
        habitId,
      })),
    [habitIds],
  );
  return (
    <>
      {positions.length > 0 && (
        <View
          style={[
            styles.habitsContainer,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.greyBaseSecondary,
            },
          ]}
        >
          <View style={styles.habitHeader}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.habitBase}
              style={{
                textShadowColor: "black",
                textShadowOffset: { width: 0.1, height: 0.1 },
                textShadowRadius: 0.1,
              }}
            />
            <Text style={[styles.habitHeaderText, { color: theme.habitBase }]}>
              Daily Habits
            </Text>
            <Text style={[styles.habitCount, { color: theme.habitBase }]}>
              {completedHabitsCount}/{positions.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            style={styles.habitScroll}
          >
            {positions.map((position) => (
              <TimelineHabitRow
                key={position.habitId}
                id={position.habitId}
                onHabitCheckIn={onHabitCheckIn}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  habitsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  habitHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    textShadowColor: "black",
    textShadowOffset: { width: 0, height: 0.15 },
    textShadowRadius: 0.1,
    flex: 1,
  },
  habitCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  habitScroll: {
    paddingLeft: 16,
  },
});
