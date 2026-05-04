import React, { useState, useContext, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "@/context/ThemeContext";
import { CategoryRow } from "@/db/schema";
import { CategoryBadge } from "./category-badge";
import { updateCSSTransition } from "react-native-reanimated/lib/typescript/css/native";

interface CategorySelectorProps {
  categoriesDb: CategoryRow[]; // Passed down from DataContext
  selectedCategory: string | null;
  onSelectCategory: (category: string) => void;
  onCreateCategory: (name: string, color: string) => Promise<void>; // The DAO call
  updateField: (field: any, value: any) => void;
}

export const CategorySelector = ({
  categoriesDb,
  selectedCategory,
  onSelectCategory,
  onCreateCategory,
  updateField,
}: CategorySelectorProps) => {
  const { theme } = useContext(ThemeContext);
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  // Simple predefined color palette for inline creation
  const [selectedColor, setSelectedColor] = useState("#3b82f6");

  const colorPalette = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
  ];

  const selectedTaskCategory = useMemo(() => {
    return categoriesDb.find((c) => c.name === selectedCategory);
  }, [categoriesDb, selectedCategory]);

  const handleSelect = (name: string) => {
    onSelectCategory(name);
    updateField("category", name);
    setModalVisible(false);
  };

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;
    await onCreateCategory(newCategoryName.trim(), selectedColor);
    setIsCreating(false);
    setNewCategoryName("");
    // Ideally, the parent context refetches the categories here,
    // and you automatically select the newly created category.
  };
  const sortedCategories = useMemo(() => {
    // [...categoriesDb] creates a shallow copy because .sort() mutates the original array
    return [...categoriesDb].sort((a, b) => a.color.localeCompare(b.color));
  }, [categoriesDb]);
  return (
    <>
      {/* The Anchor Element in the Form */}
      <Pressable
        style={[styles.anchor, { backgroundColor: theme.taskDarkPrimary }]}
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
              <>
                <FlatList
                  data={sortedCategories}
                  keyExtractor={(item) => item.id}
                  numColumns={4}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.listItem}
                      onPress={() => handleSelect(item.name)}
                    >
                      <CategoryBadge category={item} size="medium" />
                      {item.id === selectedCategory && (
                        <Ionicons
                          name="checkmark"
                          size={24}
                          color={item.color}
                          style={{ marginLeft: "auto" }}
                        />
                      )}
                    </Pressable>
                  )}
                  ItemSeparatorComponent={() => (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: theme.greyBasePrimary,
                        opacity: 0.2,
                      }}
                    />
                  )}
                />
                <Pressable
                  style={[
                    styles.createButton,
                    { borderColor: theme.taskLightPrimary },
                  ]}
                  onPress={() => setIsCreating(true)}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={theme.taskLightPrimary}
                  />
                  <Text
                    style={{
                      color: theme.taskLightPrimary,
                      marginLeft: 8,
                      fontWeight: "600",
                    }}
                  >
                    Create New Category
                  </Text>
                </Pressable>
              </>
            ) : (
              // Creation View
              <View style={styles.creationContainer}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: theme.whiteBase,
                      borderColor: theme.greyBasePrimary,
                    },
                  ]}
                  placeholder="Category Name"
                  placeholderTextColor={theme.greyBasePrimary}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  autoFocus
                />
                <Text style={{ color: theme.greyBasePrimary, marginBottom: 8 }}>
                  Select Color
                </Text>
                <View style={styles.colorPalette}>
                  {colorPalette.map((color) => (
                    <Pressable
                      key={color}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: color },
                        selectedColor === color && {
                          borderWidth: 2,
                          borderColor: theme.whiteBase,
                        },
                      ]}
                      onPress={() => setSelectedColor(color)}
                    />
                  ))}
                </View>
                <View style={styles.creationActions}>
                  <Pressable
                    onPress={() => setIsCreating(false)}
                    style={styles.actionBtn}
                  >
                    <Text style={{ color: theme.greyBasePrimary }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.taskLightPrimary },
                    ]}
                  >
                    <Text
                      style={{ color: theme.whiteBase, fontWeight: "bold" }}
                    >
                      Create
                    </Text>
                  </Pressable>
                </View>
              </View>
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
  },
  creationContainer: {
    paddingVertical: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  creationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
});
