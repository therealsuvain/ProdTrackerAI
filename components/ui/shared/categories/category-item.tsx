import { Category } from "@/types/category";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { CategoryBadge } from "./category-badge";

interface CategoryItemProps {
  category: Category;
  variant: "selected" | "list";
  handleSelect?: (catId: string) => void;
  handleDeSelect?: () => void;
  handleDelete?: (catId: string) => void;
  handleDeleteSecondary?: () => void;
  isNewlyCreated: boolean;
}
export const CategoryItem = ({
  category,
  variant,
  handleSelect,
  handleDeSelect,
  handleDelete,
  handleDeleteSecondary,
  isNewlyCreated,
}: CategoryItemProps) => {
  const onPress =
    variant === "list"
      ? () => handleSelect?.(category.id)
      : () => handleDeSelect?.();

  const onDelete =
    variant === "list"
      ? () => handleDelete?.(category.id)
      : () => handleDeleteSecondary?.();
  return (
    <View style={styles.catgory}>
      <TouchableOpacity
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <CategoryBadge category={category} size="medium" />
      </TouchableOpacity>
      {isNewlyCreated && (
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.deleteBtn, { borderColor: "red" }]}
        >
          <Ionicons name="trash-outline" size={18} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  catgory: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4, // Spacing for vertical search list
  },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 6,
    borderStyle: "dashed",
    backgroundColor: "#ff000083",
    padding: 2,
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
