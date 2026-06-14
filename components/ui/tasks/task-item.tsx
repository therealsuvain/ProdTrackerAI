import { Task } from "@/types/task";
import { Badge, Card, Checkbox } from "react-native-paper";
import { StyleSheet, View, Text, Button } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { XButton } from "../shared/x-button";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { ThemeContext } from "@/context/ThemeContext";
import { TagList } from "../shared/tags/tag-list";
import { useData } from "@/hooks/context-hooks/use-data";
import { CategoryBadge } from "../shared/categories/category-badge";
import { desc } from "drizzle-orm";

const today = new Date().toISOString().split("T")[0];
interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const { theme } = useContext(ThemeContext);
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
  const overDue = task.dueDate.split("T")[0] < today;
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
        {isNotHome && <XButton icon="pencil-outline" onPress={onEdit} />}
        {isNotHome && <XButton icon="trash-outline" onPress={onDelete} />}
        <Badge
          size={7.5}
          style={[styles.badge, { backgroundColor: priorityColor }]}
        />
      </Card.Content>
    </Card>
  );
}

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
