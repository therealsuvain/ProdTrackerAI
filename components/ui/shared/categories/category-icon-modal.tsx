import React, { useState, useMemo } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Text,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useDebounce } from "@/hooks/use-debounce";
import { useTheme } from "@/hooks/use-theme-colors";

// Extract the static array of ~2,100 valid glyph names
const ICON_NAMES = Object.keys(Ionicons.glyphMap) as Array<
  keyof typeof Ionicons.glyphMap
>;

interface CategoryIconPickerProps {
  visible: boolean;
  onSelectIcon: (iconName: string) => void;
  onClose: () => void;
}

export const CategoryIconPicker = ({
  visible,
  onSelectIcon,
  onClose,
}: CategoryIconPickerProps) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoize the filtered list to prevent unnecessary recalculations on re-renders
  const filteredIcons = useMemo(() => {
    if (!debouncedSearchQuery) return ICON_NAMES;
    const lowerQuery = debouncedSearchQuery.toLowerCase();
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(lowerQuery));
  }, [debouncedSearchQuery]);

  const renderItem = ({ item }: { item: keyof typeof Ionicons.glyphMap }) => (
    <TouchableOpacity
      style={styles.iconCell}
      onPress={() => onSelectIcon(item)}
      activeOpacity={0.7}
    >
      <Ionicons name={item} size={28} color="#eeeeee" />
      <Text style={styles.iconName}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <View style={[styles.modalHeader, { marginBottom: 5 }]}>
            <Text style={[styles.modalTitle, { color: theme.whiteBase }]}>
              Pick Icon
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.greyBasePrimary} />
            </Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search icons..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <View style={styles.listContainer}>
            <FlashList
              data={filteredIcons}
              renderItem={renderItem}
              keyExtractor={(item) => item}
              numColumns={5}
              //estimatedItemSize={60} // Crucial for FlashList performance optimization
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(34, 34, 34, 0.27)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    maxHeight: "70%",
    backgroundColor: "#4d4d4d",
    borderRadius: 16,
  },
  searchInput: {
    height: 48,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: "#444444",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#eeeeee",
  },
  listContainer: {
    flex: 1, // FlashList MUST have a parent with a defined size
  },
  iconCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  iconName: {
    fontSize: 12,
    color: "#eeeeee",
  },
});
