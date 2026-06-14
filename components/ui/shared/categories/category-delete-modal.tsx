import { Category } from "@/types/category";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { CategoryBadge } from "./category-badge";

interface CategoryDeleteModalProps {
  categories: Category[];
  categoryToDelete: string | null;
  onClose: () => void;
  onReassign: (catId: string) => void;
}

export const CategoryDeleteModal = ({
  categories,
  categoryToDelete,
  onClose,
  onReassign,
}: CategoryDeleteModalProps) => {
  const { theme } = useTheme();

  return (
    <Modal visible={!!categoryToDelete} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.background, minHeight: "40%" },
          ]}
        >
          <Text
            style={{
              color: theme.whiteBase,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 16,
            }}
          >
            Select Fallback Category
          </Text>
          <Text style={{ color: theme.greyBasePrimary, marginBottom: 20 }}>
            Choose a category to migrate existing tasks and habits to.
          </Text>

          <ScrollView contentContainerStyle={styles.wrapContainer}>
            {categories
              .filter((c) => c.id !== categoryToDelete)
              .map((cat) => (
                <Pressable key={cat.id} onPress={() => onReassign(cat.id)}>
                  <CategoryBadge category={cat} />
                </Pressable>
              ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={{ marginTop: 20, alignItems: "center" }}
          >
            <Text style={{ color: theme.greyBasePrimary }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12, // Provides consistent grid spacing matching your mockups
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxHeight: "75%",
    alignItems: "center",
  },
});
