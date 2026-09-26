import { useTaskStore } from "@/stores/use-task-store";
import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Checkbox } from "expo-checkbox";

type TimelineTaskRowProps = {
  taskId: string;
  top: number;
  height: number;
  onToggle: (id: string) => void;
  color: string;
};

const getPriorityColor = (priority: "low" | "medium" | "high"): string => {
  return {
    low: "green",
    medium: "orange",
    high: "red",
  }[priority];
};

export const TimelineTaskRow = React.memo(function TimelineTaskRow({
  taskId,
  top,
  height,
  color,
  onToggle,
}: TimelineTaskRowProps) {
  const title = useTaskStore((state) => state.tasksById[taskId].title);
  const completed = useTaskStore((state) => state.tasksById[taskId].completed);
  const priority = useTaskStore((state) => state.tasksById[taskId].priority);
  if (!title || !priority) return null;

  const priorityColor = getPriorityColor(priority);

  return (
    <TouchableOpacity
      style={[
        styles.taskBlock,
        {
          top,
          height,
          borderColor: color,
          backgroundColor: color + "55",
          borderRightColor: priorityColor,
        },
      ]}
      onPress={() => onToggle(taskId)}
    >
      <View style={styles.blockHeader}>
        <Checkbox value={completed} onValueChange={() => onToggle(taskId)} />

        <Text
          style={[
            styles.taskTitle,
            completed && styles.completedTask,
            { color: "white" },
          ]}
        >
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  taskTitle: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  completedTask: {
    textDecorationLine: "line-through",
  },
  taskSubtext: {
    fontSize: 11,
    marginLeft: 40,
  },
  taskBlock: {
    position: "absolute",
    justifyContent: "center",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    borderWidth: 2,
    borderRightWidth: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
