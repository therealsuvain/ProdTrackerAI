import React from "react";
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
import { CategoryBadge } from "@/components/ui/shared/categories/category-badge"; // Adjust path

interface CategorySelectionModalProps {
  categories: Category[];
  visible: boolean;
  onClose: () => void;
  onSelect: (catId: string) => void;
}

export const CategorySelectionModal = ({
  categories,
  visible,
  onClose,
  onSelect,
}: CategorySelectionModalProps) => {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: theme.background }]}
        >
          <Text
            style={{
              color: theme.whiteBase,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 16,
            }}
          >
            Select Category
          </Text>

          <ScrollView contentContainerStyle={styles.wrapContainer}>
            {categories.map((cat) => (
              <Pressable key={cat.id} onPress={() => onSelect(cat.id)}>
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
  wrapContainer: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    minHeight: "40%",
    maxHeight: "70%",
  },
});
