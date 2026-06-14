import React, { useState, useEffect } from "react";
import { Tag } from "@/types/tag";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { TagBadge } from "@/components/ui/shared/tags/tag-badge"; // Adjust path as needed
import { AnimatedTag } from "../animated-tag";
import { set } from "date-fns";

interface TagSelectionModalProps {
  tags: Tag[];
  initialSelected: string[];
  visible: boolean;
  onClose: () => void;
  onSave: (selectedTagIds: string[]) => void;
}

export const TagSelectionModal = ({
  tags,
  initialSelected,
  visible,
  onClose,
  onSave,
}: TagSelectionModalProps) => {
  const { theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(true);

  // Sync state when opened
  useEffect(() => {
    if (visible) setSelectedIds(initialSelected);
  }, [visible, initialSelected]);

  const toggleTag = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));
  const unselectedTags = tags.filter((t) => !selectedIds.includes(t.id));

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: theme.background }]}
        >
          <View style={styles.headerRow}>
            <Text
              style={{
                color: theme.whiteBase,
                fontSize: 18,
                fontWeight: "bold",
              }}
            >
              Edit Tags
            </Text>
            <Pressable onPress={() => onSave(selectedIds)}>
              <Text
                style={{ color: theme.text, fontWeight: "bold", fontSize: 16 }}
              >
                Save
              </Text>
            </Pressable>
          </View>

          {/* Selected Tags Section */}
          <Text style={{ color: theme.greyBasePrimary, marginBottom: 8 }}>
            Selected
          </Text>
          <View style={styles.wrapContainer}>
            {selectedTags.length === 0 && (
              <Text style={{ color: theme.greyBaseSecondary, fontSize: 12 }}>
                No tags selected
              </Text>
            )}
            {selectedTags.map((t) => (
              /*  <Pressable key={t.id} onPress={() => toggleTag(t.id)}>
                  <TagBadge
                    tagId={t.id}
                    tagName={t.name}
                    holeColor={theme.background}
                  />
              </Pressable> */
              <AnimatedTag
                key={`active-${t.id}`}
                onRemove={() => {
                  setIsAdding(false);
                  toggleTag(t.id);
                }}
                isAdding={isAdding}
              >
                <TagBadge
                  tagId={t.id}
                  tagName={t.name}
                  holeColor={theme.background}
                />
              </AnimatedTag>
            ))}
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: theme.greyBaseSecondary },
            ]}
          />

          {/* Unselected Tags Section */}
          <Text style={{ color: theme.greyBasePrimary, marginBottom: 8 }}>
            Available
          </Text>
          <ScrollView contentContainerStyle={styles.wrapContainer}>
            {unselectedTags.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  setIsAdding(true);
                  toggleTag(t.id);
                }}
              >
                <TagBadge
                  tagId={t.id}
                  tagName={t.name}
                  holeColor={theme.background}
                />
              </Pressable>
            ))}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={{ color: theme.greyBasePrimary }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    minHeight: "50%",
    maxHeight: "80%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  divider: { height: 1, width: "100%", marginVertical: 12, opacity: 0.3 },
  cancelBtn: { marginTop: 10, alignItems: "center", padding: 10 },
});
