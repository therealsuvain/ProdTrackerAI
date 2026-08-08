import React from "react";
import {
  Modal,
  View,
  Pressable,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

interface GlobalFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GlobalFilterModal = ({
  visible,
  onClose,
}: GlobalFilterModalProps) => {
  const { theme } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background ?? "#1C1C1E",
              borderColor: theme.text + "1A",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Filters</Text>
            <Pressable onPress={onClose} style={styles.closeIcon}>
              <Text style={[styles.closeIconText, { color: theme.text }]}>
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Placeholder section — date range already lives in its own chip/picker,
                shown here read-only for context, or omit entirely if redundant */}

            <Text style={[styles.emptyState, { color: theme.text + "80" }]}>
              More filters coming soon.
            </Text>

            {/* Future sections drop in here, each following this shape: */}
            {/* <FilterSection title="Some Field">...</FilterSection> */}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[
              styles.applyButton,
              { backgroundColor: theme.taskDarkPrimary ?? "#2196F3" },
            ]}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "70%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIconText: {
    fontWeight: "600",
  },
  body: {
    marginBottom: 12,
  },
  emptyState: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 30,
  },
  applyButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
});
