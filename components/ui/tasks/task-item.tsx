import { Badge, Card, Checkbox } from "react-native-paper";
import { StyleSheet, View, Text } from "react-native";
import { XButton } from "../shared/x-button";
import { useRoute } from "@react-navigation/native";
import React, { useCallback, useContext, useMemo } from "react";
import { ThemeContext } from "@/context/ThemeContext";
import { TagList } from "../shared/tags/tag-list";
import { useData } from "@/hooks/context-hooks/use-data";
import { CategoryBadge } from "../shared/categories/category-badge";
import { useTaskStore } from "@/stores/use-task-store";

interface TaskItemProps {
  id: string;
  onToggleComplete: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function TaskItem({ id, onToggleComplete, onEdit, onDelete }: TaskItemProps) {
  const { theme } = useContext(ThemeContext);
  const task = useTaskStore((state) => state.tasksById[id]);

  if (!task) return null;
  const { categories } = useData();
  const priorityColor = {
    low: theme.success,
    medium: theme.habitBase,
    high: theme.eventBase,
  }[task.priority];
  let taskCategory;
  if (task.category) {
    taskCategory = categories.find((c) => c.id === task.category);
  }
  const route = useRoute();
  const isNotHome = route.name !== "index";

  const overDue = useMemo(() => {
    if (task.completed) return false; // don't bother computing for completed tasks
    const today = new Date().toISOString().split("T")[0];
    return task.dueDate.split("T")[0] < today;
  }, [task.dueDate, task.completed]);

  const handleEdit = useCallback(() => onEdit?.(task.id), [task.id, onEdit]);
  const handleDelete = useCallback(
    () => onDelete?.(task.id),
    [task.id, onDelete],
  );
  // Edit and Delete buttons are bad, need changes
  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: theme.taskDarkPrimary },
        !isNotHome && { borderRadius: 0 },
      ]}
    >
      <Card.Content style={styles.content}>
        <Checkbox
          status={task.completed ? "checked" : "unchecked"}
          onPress={() => onToggleComplete(task.id)}
          uncheckedColor={theme.greyBasePrimary}
          color={theme.taskLightPrimary}
        />
        <View style={styles.textContainer}>
          <View style={styles.titleContainer}>
            <Text
              style={
                task.completed
                  ? styles.completedText
                  : [styles.text, { color: theme.whiteBase }]
              }
            >
              {task.title}
            </Text>
            {taskCategory && (
              <CategoryBadge category={taskCategory} variant="iconOnly" />
            )}
            {!task.completed && overDue && (
              <Text style={[styles.overDueText, { color: theme.error }]}>
                Overdue
              </Text>
            )}
          </View>
          {task.description && (
            <Text style={styles.descriptionText}>{task.description}</Text>
          )}
          {task.dueDate && (
            <Text style={{ color: "white" }}>
              Due : {new Date(task.dueDate).toDateString()}
            </Text>
          )}
          {task.tags && (
            <TagList tags={task.tags} holeColor={theme.taskDarkPrimary} />
          )}
        </View>
        {isNotHome && <XButton icon="pencil-outline" onPress={handleEdit} />}
        {isNotHome && <XButton icon="trash-outline" onPress={handleDelete} />}
        <Badge
          size={7.5}
          style={[styles.badge, { backgroundColor: priorityColor }]}
        />
      </Card.Content>
    </Card>
  );
}

export default React.memo(TaskItem);

const styles = StyleSheet.create({
  card: { marginVertical: 8, position: "relative" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: { flex: 1, marginLeft: 8 },
  titleContainer: { flexDirection: "row", alignItems: "center", gap: 5 },
  overDueText: { fontSize: 11 },
  descriptionText: { fontSize: 12, fontStyle: "italic", color: "grey" },
  text: { fontSize: 16 },
  completedText: {
    fontSize: 16,
    textDecorationLine: "line-through",
    color: "gray",
  },
  badge: { position: "absolute", top: 0, right: 0, marginHorizontal: 2.5 },
});
