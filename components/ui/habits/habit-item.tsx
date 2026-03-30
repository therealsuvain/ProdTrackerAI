import { Card, Text, Button, ProgressBar } from "react-native-paper";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useContext, useCallback, useRef, useState } from "react";
import Animated from "react-native-reanimated";

import { ThemeContext } from "@/context/ThemeContext";
import { Habit } from "@/types/habits";
import { checkInHabit } from "@/utils/habit-utils";
import { XButton } from "../x-button";
import { HabitStats } from "./habit-stats";
import { TargetDaysRow } from "./habit-target-days";
import { useHabitDeniedFeedback } from "./habit-denied-feedback-util";

interface HabitItemProps {
  habit: Habit;
  onUpdate: (updated: Habit) => void;
  onDelete: () => void;
  onGoalReached?: (habit: Habit) => void;
}

const AnimatedCard = Animated.createAnimatedComponent(Card);

const customComparator = (prev: HabitItemProps, next: HabitItemProps) => {
  // Return true = props are equal = skip re-render
  // Only re-render if the habit's meaningful data changed or callbacks changed.
  return (
    prev.habit.id === next.habit.id &&
    prev.habit.streak === next.habit.streak &&
    prev.habit.streakFreezes === next.habit.streakFreezes &&
    prev.habit.history.length === next.habit.history.length &&
    prev.habit.freezeHistory?.length === next.habit.freezeHistory?.length &&
    prev.habit.goal === next.habit.goal &&
    prev.habit.title === next.habit.title &&
    prev.habit.targetDays === next.habit.targetDays && // array ref — stable if not edited
    prev.habit.isArchived === next.habit.isArchived &&
    prev.onUpdate === next.onUpdate && // stable via useCallback in screen
    prev.onDelete === next.onDelete && // stable via useCallback in screen
    prev.onGoalReached === next.onGoalReached
  );
};
function HabitItem({
  habit,
  onUpdate,
  onDelete,
  onGoalReached,
}: HabitItemProps) {
  const { theme } = useContext(ThemeContext);
  const progress = habit.goal ? habit.streak / habit.goal : 0;
  /* const handleCheckIn = () =>
     onUpdate(checkInHabit(habit)); */
  const route = useRoute();
  const isNotHome = route.name !== "index";
  const { playDeniedFeedback, animatedStyle } = useHabitDeniedFeedback();


  const handleCheckIn = useCallback(() => {
    const result = checkInHabit(habit);

    if (result.status === "denied") {
      // Give the user clear tactile + audio feedback instead of silently ignoring
      playDeniedFeedback();
      return;
    }

    onUpdate(result.habit);

    if (result.status === "goal_reached") {
      // Hold the updated habit for the modal, then open after 1s.
      // The delay makes the completion feel earned — the user sees the streak
      // tick up first, then the celebration fires. More rewarding than an
      // immediate modal that obscures the check-in animation.
      onGoalReached ? onGoalReached(result.habit) : null;
      //setTimeout(() => setGoalModalVisible(true), 1000);
    }
  }, [habit, onUpdate, playDeniedFeedback, onGoalReached]);

  return (
    <AnimatedCard
      style={[
        styles.container,
        { backgroundColor: theme.habitDarkPrimary },
        !isNotHome && { borderRadius: 0 },
        animatedStyle,
      ]}
    >
      <Card.Content>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.info}>
            {/* Target days row — only rendered if days are set */}
            {habit.targetDays && habit.targetDays.length > 0 && (
              <TargetDaysRow
                targetDays={habit.targetDays}
                activeColor={theme.habitBase}
                inactiveColor={theme.whiteBase} // 20% opacity
              />
            )}
            <Text variant="titleMedium" style={{ color: theme.whiteBase }}>
              {habit.title}
            </Text>
            {habit.pendingStreakResetAfter ? (
              <>
                <Text
                  style={{ color: "red", fontStyle: "italic", fontSize: 16 }}
                >
                  Streak will reset on{" "}
                  {new Date(habit.pendingStreakResetAfter).toDateString()} with
                  new goal of {habit.goal} requiring {habit.frequency}{" "}
                  check-ins.
                </Text>
              </>
            ) : (
              <Text style={{ color: theme.whiteBase }}>
                Streak: {habit.streak} / Goal: {habit.goal}
              </Text>
            )}
          </View>

          {/*<View style={styles.container}>
              <Text variant="titleMedium" style={{ color: theme.whiteBase }}>
                {habit.title}
              </Text>
              <Text style={{ color: theme.whiteBase }}>
                Streak: {habit.streak} / Goal: {habit.goal || "OnGoing"}
              </Text>
            </View>*/}

          {/* <View style={{flexDirection:'row'}}>
        <Text style={{color:theme.whiteBase, paddingHorizontal:2}}>
           LS:{habit.longestStreak}
        </Text>
        <Text style={{color:theme.whiteBase}}>
           F:{habit.streakFreezes}
        </Text>
        </View> */}
          {!habit.pendingStreakResetAfter && (
            <HabitStats
              habit={habit}
              onUpdate={onUpdate}
              onDenied={playDeniedFeedback}
            />
          )}
        </View>
        {!habit.pendingStreakResetAfter && (
          <ProgressBar progress={progress} color={theme.habitBase} />
        )}

        {isNotHome && (
          <View style={styles.buttons}>
            <XButton
              icon="checkmark"
              mode="habit"
              onPress={handleCheckIn}
            ></XButton>
            <XButton
              icon="trash-outline"
              mode="habit"
              onPress={onDelete}
            ></XButton>
          </View>
        )}
      </Card.Content>
    </AnimatedCard>
  );
}

export default React.memo(HabitItem, customComparator);

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    marginVertical: 8,
    position: "relative",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  info: {
    flexDirection: "column",
    flex: 1,
  },
  buttons: {
    position: "relative",
    flexDirection: "row",
    top: 5,
    justifyContent: "space-between",
  },
});
