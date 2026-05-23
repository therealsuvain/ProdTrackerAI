import React, { useState, useContext, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemeContext } from "@/context/ThemeContext";
import { CategoryBadge } from "./category-badge";
import { CategoryCreator } from "./category-creation-view";
import { CategoryList } from "./category-list-view";
import { Category } from "@/types/category";

//TODO duplicate cateogries get added to UI, and count gets updated in db for exisitng one
// TODO swap color from white to black for icon depending on background color lightness or darkness
interface CategorySelectorProps {
  itemType: "task" | "habit" | "event" | "log";
  categoriesDb: Category[]; // Passed down from DataContext
  sessionCategories: Set<string>;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCreateCategory: (
    name: string,
    color: string,
    icon: string,
  ) => Promise<void>; // The DAO call
  onDeleteCategory: (id: string) => Promise<void>;
  updateField?: (field: any, value: any) => void;
}

export const CategorySelector = ({
  itemType,
  categoriesDb,
  sessionCategories,
  selectedCategory,
  onSelectCategory,
  onCreateCategory,
  onDeleteCategory,
  updateField,
}: CategorySelectorProps) => {
  const { theme } = useContext(ThemeContext);
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const activeColor = useMemo(() => {
    switch (itemType) {
      case "task":
        return theme.taskDarkPrimary;
      case "habit":
        return theme.habitDarkPrimary;
      case "event":
        return theme.eventDarkPrimary;
      case "log":
        return theme.timerDarkPrimary;
      default:
        return theme.greyBasePrimary;
    }
  }, [itemType, theme]);
  const selectedTaskCategory = useMemo(() => {
    return categoriesDb.find((c) => c.id === selectedCategory);
  }, [categoriesDb, selectedCategory]);

  const handleSelect = (catId: string) => {
    onSelectCategory(catId);
    if (updateField) updateField("category", catId);
    //setModalVisible(false);
  };

  const handleDeSelect = () => {
    onSelectCategory(null);
    if (updateField) updateField("category", null);
  };

  return (
    <>
      {/* The Anchor Element in the Form */}
      <Pressable
        style={[styles.anchor, { backgroundColor: activeColor }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={{ color: theme.greyBasePrimary, marginRight: 8 }}>
          Category
        </Text>
        {selectedCategory ? (
          <CategoryBadge category={selectedTaskCategory} />
        ) : (
          <Text style={{ color: theme.whiteBase }}>None Selected</Text>
        )}
        <Ionicons
          name="chevron-down"
          size={20}
          color={theme.greyBasePrimary}
          style={{ marginLeft: "auto" }}
        />
      </Pressable>

      {/* The Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.whiteBase }]}>
                Select Category
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.greyBasePrimary}
                />
              </Pressable>
            </View>

            {!isCreating ? (
              // List View
              <CategoryList
                selectedCategory={selectedCategory}
                selectedCategoryObject={selectedTaskCategory}
                categoriesDb={categoriesDb}
                sessionCategories={sessionCategories}
                selectCategory={handleSelect}
                deselectCategory={handleDeSelect}
                onDeleteCategory={onDeleteCategory}
                openCategoryCreator={() => setIsCreating(true)}
                onClose={() => setModalVisible(false)}
              />
            ) : (
              // Creation View
              <CategoryCreator
                isCreating={isCreating}
                onClose={() => setIsCreating(false)}
                onCreateCategory={onCreateCategory}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  anchor: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
});
