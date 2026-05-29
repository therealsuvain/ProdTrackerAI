import { View, Text, StyleSheet } from "react-native";
import { CategoryBadge } from "../../shared/categories/category-badge";
import { TagBadge } from "../../shared/tags/tag-badge";
import { format } from "date-fns";
import { ActionChipProps } from "./chip-props";

// TODO: Preview for description or any other field , that I dont really add in development
export const ItemChip = ({ action }: ActionChipProps) => {
  const isEdit = action.name.toLowerCase().includes("edit");
  const existingTags: string[] = action.extraInfo?.tags || [];
  const addedTags: string[] = action.args.addTagIds || [];
  const removedTags: string[] = action.args.removeTagIds || [];
  // For new creations (addTask)
  const newActionTags: string[] = action.args.tags || action.args.tagIds || [];

  // Calculate Delta
  let activeTags: string[] = [];
  let crossedOutTags: string[] = [];

  if (isEdit) {
    // Final Active Tags: (Existing  Added) minus Removed
    const combinedTags = new Set([...existingTags, ...addedTags]);
    activeTags = Array.from(combinedTags).filter(
      (id) => !removedTags.includes(id),
    );

    // -Removed Tags: Only show as crossed out if they actually existed on the item before
    crossedOutTags = removedTags.filter((id) => existingTags.includes(id));
  } else {
    activeTags = newActionTags;
  }
  const getActionSubtitle = () => {
    const data = { ...action.extraInfo, ...action.args };
    const parts: string[] = [];

    if (action.name.includes("Task")) {
      if (data.dueDate)
        parts.push(`Due: ${new Date(data.dueDate).toLocaleDateString()}`);
      if (data.priority) parts.push(`Priority: ${data.priority}`);
    } else if (action.name.includes("Habit")) {
      if (data.streak !== undefined) parts.push(`Streak: ${data.streak}`);
      if (data.goal) parts.push(`Goal: ${data.goal}`);
    } else if (action.name.includes("Event")) {
      if (data.startDate)
        parts.push(`${format(new Date(data.startDate), "MMM ,d")}`);
      // Truncated for brevity, drop in your existing date formatting here
    }
    return parts.join(" | ");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { alignItems: "center" }]}>
        <Text style={styles.title} numberOfLines={1}>
          {action.args.title ||
            action.args.t ||
            action.extraInfo?.title ||
            "Deleted Item"}
        </Text>
        {action.extraInfo?.category && (
          <CategoryBadge
            category={action.extraInfo.category}
            variant="iconOnly"
          />
        )}
        {/* Show Old Category ➔ New Category if the AI is changing it */}
        {action.args.categoryId &&
          action.args.categoryId !== action.extraInfo?.category?.id && (
            <>
              <Text style={styles.arrow}>➔</Text>
              <CategoryBadge
                category={{ id: action.args.categoryId } as any}
                variant="iconOnly"
              />
            </>
          )}
      </View>

      <View style={styles.tagsContainer}>
        {/* Render Final Active Tags */}
        {activeTags.map((tagId) => (
          <TagBadge key={`active-${tagId}`} tagId={tagId} holeColor="#ffffff" />
        ))}

        {/* Render Removed Tags with a Strikethrough Overlay */}
        {crossedOutTags.map((tagId) => (
          <View key={`removed-${tagId}`} style={styles.strikethroughWrapper}>
            <TagBadge tagId={tagId} holeColor="#ffffff" />
            <View style={styles.strikethroughLine} />
          </View>
        ))}
      </View>
      <Text style={styles.subtitle}>{getActionSubtitle()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: { flexDirection: "row", gap: 4 },
  title: { fontSize: 14, fontWeight: "600", color: "#333" },
  subtitle: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  arrow: { fontSize: 12, color: "#8E8E93", marginHorizontal: 2 },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    maxWidth: "99%",
    marginTop: 4,
    gap: 4,
  },

  // Strikethrough Styles
  strikethroughWrapper: {
    position: "relative",
    opacity: 0.4,
  },
  strikethroughLine: {
    position: "absolute",
    height: 1.5,
    backgroundColor: "#FF3B30",
    top: "50%",
    left: 4,
    right: 4,
    zIndex: 1,
  },
});
