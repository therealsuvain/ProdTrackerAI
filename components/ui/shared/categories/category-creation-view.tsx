import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import ColorPicker, {
  ColorFormatsObject,
  HueSlider,
  OpacitySlider,
  Panel1,
  Preview,
} from "reanimated-color-picker";

import { ThemeContext } from "@/context/ThemeContext";
import {
  MAX_COLORS,
  getRecentColors,
  saveCustomColor,
} from "@/utils/category-color-cache";
import { CategoryColorPicker } from "./category-color-modal";
import { CategoryIconPicker } from "./category-icon-modal";
import { Category } from "@/types/category";
import { text } from "drizzle-orm/gel-core";

const colorPalette = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

interface CategoryCreatorProps {
  isCreating: boolean;
  onClose: () => void;
  onCreateCategory: (
    name: string,
    color: string,
    icon: string,
  ) => Promise<void>; // The DAO call
  editingCategory?: Category;
  mode?: "ai" | "settings";
}
export const CategoryCreator = ({
  isCreating,
  onClose,
  onCreateCategory,
  editingCategory,
  mode = "settings",
}: CategoryCreatorProps) => {
  const { theme } = useContext(ThemeContext);
  const [newCategoryName, setNewCategoryName] = useState(
    editingCategory?.name || "",
  );
  const [selectedColor, setSelectedColor] = useState(
    editingCategory?.color || "#3b82f6",
  );
  const selectedColorValue = useSharedValue(
    editingCategory?.color || "#3b82f6",
  );
  const [displayPalette, setDisplayPalette] = useState<string[]>(colorPalette);
  const [fullSavedPalette, setFullSavedPalette] = useState<string[]>([]);
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<
    keyof typeof Ionicons.glyphMap
  >((editingCategory?.icon as keyof typeof Ionicons.glyphMap) || "briefcase"); // Default icon
  const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);

  const handleCreate = async () => {
    if (!newCategoryName.trim()) return;
    await onCreateCategory(newCategoryName.trim(), selectedColor, selectedIcon);
    onClose();
    setNewCategoryName("");
    // Ideally, the parent context refetches the categories here,
    // and you automatically select the newly created category.
  };

  const handleCustomColorPicked = async (color: ColorFormatsObject) => {
    setSelectedColor(color.hex); // Automatically set to selected state
    selectedColorValue.value = color.hex;
  };

  const handleCustomColorSaved = async () => {
    const updatedRecents = await saveCustomColor(selectedColor);
    const paletteWithPlaceholders = [
      ...updatedRecents,
      ...Array(Math.max(0, 25 - updatedRecents.length)).fill(null),
    ];
    setFullSavedPalette(paletteWithPlaceholders);
    // Re-calculate the 9-slot queue
    const mergedQueue = Array.from(
      new Set([...updatedRecents, ...colorPalette]),
    ).slice(0, 9);

    setDisplayPalette(mergedQueue);
    setIsColorPickerVisible(false); // Close the picker modal
  };

  const textColor = mode === "ai" ? theme.blackBase : theme.greyBasePrimary;
  useEffect(() => {
    const hydrateQueue = async () => {
      const recents = await getRecentColors();
      const paletteWithPlaceholders = [
        ...recents,
        ...Array(Math.max(0, MAX_COLORS - recents.length)).fill(null),
      ];
      setFullSavedPalette(paletteWithPlaceholders);
      // Merge recents with base, filter duplicates via Set, and slice to exactly 9 slots
      const editingCategoryColor = editingCategory?.color;
      const mergedQueue = Array.from(new Set([...recents, ...colorPalette]));

      if (editingCategoryColor && !mergedQueue.includes(editingCategoryColor)) {
        mergedQueue.unshift(editingCategoryColor);
      }
      setDisplayPalette(mergedQueue.slice(0, 9));
      // Optional: Default to the user's most recently used color instead of the base red
      if (recents.length > 0) setSelectedColor(recents[0]);
      if (editingCategoryColor) setSelectedColor(editingCategoryColor);
    };

    hydrateQueue();
  }, []);

  return (
    <>
      <Modal visible={isCreating} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor:
                  mode === "ai" ? theme.greyBaseTrans : theme.background,
              },
            ]}
          >
            <View style={[styles.modalHeader, { marginBottom: 5 }]}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: mode === "ai" ? theme.blackBase : theme.whiteBase },
                ]}
              >
                Create Category
              </Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color={textColor} />
              </Pressable>
            </View>
            <View style={styles.creationContainer}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: mode === "ai" ? theme.blackBase : theme.whiteBase,
                    borderColor: textColor,
                  },
                ]}
                placeholder="Category Name"
                placeholderTextColor={theme.greyBasePrimary}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                //autoFocus
              />
              <View style={styles.iconRow}>
                <Text
                  style={{
                    color: textColor,
                    //margin: "auto",
                    marginRight: 8,
                  }}
                >
                  Pick Icon :
                </Text>
                <Pressable
                  style={[
                    styles.iconTrigger,
                    {
                      backgroundColor: `${selectedColor}20`,
                      borderColor: selectedColor,
                    },
                  ]}
                  onPress={() => setIsIconPickerVisible(true)}
                >
                  <Ionicons
                    name={selectedIcon}
                    size={100}
                    color={selectedColor}
                  />
                </Pressable>
              </View>
              <Text style={{ color: textColor, marginBottom: 8 }}>
                Select Color
              </Text>
              <View style={styles.colorPalette}>
                {displayPalette.map((color) => (
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
                {/* The 10th Slot: Add Custom Color Trigger */}
                <Pressable
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: theme.background,
                      borderWidth: 2,
                      borderColor: theme.whiteBase,
                      justifyContent: "center",
                      alignItems: "center",
                    },
                  ]}
                  onPress={() => setIsColorPickerVisible(true)}
                >
                  <Ionicons
                    name="add-outline"
                    size={25}
                    color={theme.whiteBase}
                    style={{ fontWeight: 900 }}
                  />
                </Pressable>
              </View>
              <View style={styles.creationActions}>
                <Pressable onPress={onClose} style={styles.actionBtn}>
                  <Text style={{ color: textColor }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: theme.taskLightPrimary },
                  ]}
                >
                  <Text style={{ color: theme.whiteBase, fontWeight: "bold" }}>
                    Create
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <CategoryColorPicker
        visible={isColorPickerVisible}
        selectedColor={selectedColor}
        fullPalette={fullSavedPalette}
        onClose={() => setIsColorPickerVisible(false)}
        updateColor={setSelectedColor}
        handleColorPicked={handleCustomColorPicked}
        handleColorSaved={handleCustomColorSaved}
      />
      <CategoryIconPicker
        visible={isIconPickerVisible}
        onSelectIcon={(iconName) => {
          setSelectedIcon(iconName as keyof typeof Ionicons.glyphMap);
          setIsIconPickerVisible(false);
        }}
        onClose={() => setIsIconPickerVisible(false)}
      />
      {/* IOS ONLY */}
      {/* {isColorPickerVisible && (
         <Host matchContents>
            <ColorPicker
                label="Select a color"
                selection={selectedColor}
                onSelectionChange={handleCustomColorPicked}
                supportsOpacity
            />
        </Host>
    )} */}
    </>
  );
};

const styles = StyleSheet.create({
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
  creationContainer: {
    paddingVertical: 12,
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    marginBottom: 12,
    gap: 12,
  },
  iconTrigger: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    margin: "auto",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  /*   input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  }, */
  colorPalette: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
