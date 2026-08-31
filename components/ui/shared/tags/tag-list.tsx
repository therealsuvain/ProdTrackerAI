import { View, StyleSheet } from "react-native";
import { TagBadge } from "./tag-badge";

interface TagListProps {
  tags?: string | string[] | null; // Handles the raw DB JSON string or parsed array
  holeColor: string;
}

export const TagList = ({ tags, holeColor }: TagListProps) => {
  if (!tags) return null;

  // Safely parse if it comes directly from the DB as a stringified JSON
  const parsedTags: string[] =
    typeof tags === "string" ? JSON.parse(tags) : tags;

  if (!parsedTags || parsedTags.length === 0) return null;

  return (
    <View style={styles.listContainer}>
      {parsedTags.map((tag, index) => (
        <TagBadge key={`${tag}-${index}`} tagId={tag} holeColor={holeColor} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8, // Seamless placement at the bottom of the item card
  },
});
