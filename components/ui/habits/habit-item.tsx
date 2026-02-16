import { Card, Text, Button, ProgressBar } from "react-native-paper";
import { StyleSheet, View } from "react-native";
import { Habit } from "@/types/habits";
import { checkInHabit } from "@/utils/habit-utils";
import XButton from "../x-button";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";
import HabitStats from "./habit-stats";

interface HabitItemProps {
  habit: Habit;
  onUpdate: (updated: Habit) => void;
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
    onUpdate ? onUpdate(checkInHabit(habit)) : undefined;
  const route = useRoute();
  const isNotHome = route.name !== "index";

  return (
    <Card style={[styles.container, {backgroundColor: theme.habitDarkPrimary}, !isNotHome && {borderRadius:0}]}>
      <Card.Content>
        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
          <View style={styles.container}>
        <Text variant="titleMedium" style={{color:theme.whiteBase}}>{habit.title}</Text>
        <Text style={{color:theme.whiteBase}}>
          Streak: {habit.streak} / Goal: {habit.goal || "OnGoing"}
        </Text>
        </View>
        {/* <View style={{flexDirection:'row'}}>
        <Text style={{color:theme.whiteBase, paddingHorizontal:2}}>
           LS:{habit.longestStreak}
        </Text>
        <Text style={{color:theme.whiteBase}}>
           F:{habit.streakFreezes}
        </Text>
        </View> */}
        <HabitStats habit={habit} onUpdate={onUpdate}/>
        </View>
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
