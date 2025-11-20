import { Card, Text, Button, ProgressBar } from "react-native-paper";
import { StyleSheet, View } from "react-native";
import { Habit } from "@/types/habits";
import { updateStreak } from "@/utils/habit-utils";
import XButton from "../XButton";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";

interface HabitItemProps {
  habit: Habit;
  onUpdate?: (updated: Habit) => void;
  onDelete?: () => void;
}

export default function HabitItem({
  habit,
  onUpdate,
  onDelete,
}: HabitItemProps) {
  const { theme } = useContext(ThemeContext);
  const progress = habit.goal ? habit.streak / habit.goal : 0;
  const handleCheckIn = () =>
    onUpdate ? onUpdate(updateStreak(habit)) : undefined;
  const route = useRoute();
  const isNotHome = route.name !== "index";

  return (
    <Card style={[styles.container, {backgroundColor: theme.habitDarkPrimary,}]}>
      <Card.Content>
        <Text variant="titleMedium">{habit.title}</Text>
        <Text>
          Streak: {habit.streak} / Goal: {habit.goal || "OnGoing"}
        </Text>
        <ProgressBar progress={progress} color={theme.habitBase} />
        <View style={styles.buttons}>
          {isNotHome && (
            <XButton
              icon="checkmark"
              mode="habit"
              onPress={handleCheckIn}
            ></XButton>
          )}
          {isNotHome && (
            <XButton
              icon="trash-outline"
              mode="habit"
              onPress={onDelete}
            ></XButton>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    marginVertical: 8,
    position: "relative",
  },
  buttons: {
    position: "relative",
    flexDirection: "row",
    top: 5,
    justifyContent: "space-between",
  },
});
