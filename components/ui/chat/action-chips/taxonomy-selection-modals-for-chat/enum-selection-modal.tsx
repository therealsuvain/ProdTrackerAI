import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors"; // Adjust path

interface EnumSelectionModalProps {
  visible: boolean;
  fieldName: string | null;
  currentValue: string | null;
  options: string[];
  onClose: () => void;
  onSelect: (value: string) => void;
}

export const EnumSelectionModal = ({
  visible,
  fieldName,
  currentValue,
  options,
  onClose,
  onSelect,
}: EnumSelectionModalProps) => {
  const { theme } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Invisible overlay to tap out and close */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheetContent, { backgroundColor: theme.background }]}
          onPress={(e) => e.stopPropagation()} // Prevent touches from bleeding through
        >
          <Text style={[styles.title, { color: theme.greyBasePrimary }]}>
            Select {fieldName}
          </Text>

          <View style={styles.optionsContainer}>
            {options.map((opt) => {
              const isSelected = opt === currentValue;
              return (
                <Pressable
                  key={opt}
                  style={[
                    styles.optionRow,
                    { borderBottomColor: theme.greyBaseSecondary + "40" },
                  ]}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: isSelected ? theme.text : theme.whiteBase,
                        fontWeight: isSelected ? "bold" : "normal",
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text
              style={{
                color: theme.greyBasePrimary,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end", // Pushes the sheet to the bottom
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40, // Extra padding for safe area on newer phones
  },
  title: {
    fontSize: 14,
    textTransform: "capitalize",
    textAlign: "center",
    marginBottom: 16,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionRow: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  optionText: {
    fontSize: 18,
    textTransform: "capitalize",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
});
