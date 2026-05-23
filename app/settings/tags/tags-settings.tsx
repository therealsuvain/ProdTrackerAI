import React, { useContext, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";
import { useTasks } from "@/hooks/use-tasks";
import { useHabits } from "@/hooks/use-habits";
import { useEvents } from "@/hooks/use-events";
import { useLogs } from "@/hooks/use-logs";
import { TagEditModal } from "@/components/ui/shared/tags/tags-edit-modal";
import { TagBadge } from "@/components/ui/shared/tags/tag-badge";

export default function TagsSettingsScreen() {
  const { theme } = useContext(ThemeContext);
  const { tags, updateUserTag, deleteUserTag, getTagUsageForAll } = useData();
  const { reassignTaskTagLocal } = useTasks();
  const { reassignHabitTagLocal } = useHabits();
  const { reassignEventTagLocal } = useEvents();
  const { reassignLogTagLocal } = useLogs();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagToEdit, setTagToEdit] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  // --- HANDLERS ---
  const handleEditRequest = (id: string) => {
    const tag = tags.find((t) => t.id === id);
    if (tag) {
      setEditNameValue(tag.name);
      setSelectedTagId(null); // Close analytics modal
      setTagToEdit(id); // Open mini edit modal
    }
  };

  const handleSaveEdit = async () => {
    if (!tagToEdit || !editNameValue.trim()) return;
    const existingTag = tags.find((t) => t.id === tagToEdit);

    if (existingTag) {
      await updateUserTag({ ...existingTag, name: editNameValue.trim() });
    }
    setTagToEdit(null);
  };

  const handleDeleteRequest = async (id: string) => {
    // MOCK: Replace with real getTagUsageStats(id) if you have it
    const data = await getTagUsageForAll(id);
    const stats = { total: data.total };
    setSelectedTagId(null);

    if (stats.total === 0) {
      Alert.alert("Delete Tag", "This tag is empty. Delete it?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteUserTag(id, null),
        },
      ]);
    } else {
      Alert.alert(
        "Tag in Use",
        `This tag is attached to ${stats.total} items. What would you like to do?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove Tag from Items",
            style: "destructive",
            onPress: () => deleteUserTag(id, null),
          },
          {
            text: "Reassign to Another Tag",
            onPress: () => setTagToDelete(id),
          },
        ],
      );
    }
  };

  const executeReassignment = async (fallbackId: string) => {
    if (!tagToDelete) return;
    await deleteUserTag(tagToDelete, fallbackId);
    reassignTaskTagLocal(tagToDelete, fallbackId);
    reassignHabitTagLocal(tagToDelete, fallbackId);
    reassignEventTagLocal(tagToDelete, fallbackId);
    reassignLogTagLocal(tagToDelete, fallbackId);
    setTagToDelete(null);
  };
  // Filter and sort alphabetically
  const displayTags = useMemo(() => {
    let filtered = tags;
    if (searchQuery) {
      filtered = filtered.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, searchQuery]);

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.whiteBase} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.whiteBase }]}>
          Tags
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.description, { color: theme.greyBasePrimary }]}>
          Manage your tags. Tap any tag to view its usage history, edit its
          name, or reassign it to another tag.
        </Text>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.taskDarkPrimary,
              borderColor: theme.greyBasePrimary,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.greyBasePrimary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.whiteBase }]}
            placeholder="Search tags..."
            placeholderTextColor={theme.greyBasePrimary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.greyBasePrimary}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.wrapContainer}>
          {displayTags.map((tag) => (
            <Pressable key={tag.id} onPress={() => setSelectedTagId(tag.id)}>
              <TagBadge
                tagId={tag.id}
                tagName={tag.name}
                holeColor={theme.background}
                mode="big"
              />
            </Pressable>
          ))}

          {displayTags.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.greyBasePrimary }]}>
              No tags found.
            </Text>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedTagId}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedTagId(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.background }]}
          >
            <TagEditModal
              tagId={selectedTagId!}
              onClose={() => setSelectedTagId(null)}
              onEdit={handleEditRequest}
              onDelete={handleDeleteRequest}
            />
          </View>
        </View>
      </Modal>
      {/* 2. Mini Edit Modal */}
      {tagToEdit && (
        <Modal visible={true} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: theme.background,
                  minHeight: "30%",
                  justifyContent: "center",
                },
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
                Rename Tag
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: theme.taskDarkSecondary,
                  color: theme.whiteBase,
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 16,
                  marginBottom: 24,
                }}
                value={editNameValue}
                onChangeText={setEditNameValue}
                autoFocus
                placeholder="Tag Name..."
                placeholderTextColor={theme.greyBasePrimary}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() => setTagToEdit(null)}
                  style={{
                    flex: 1,
                    padding: 14,
                    alignItems: "center",
                    borderRadius: 8,
                    backgroundColor: theme.taskDarkSecondary,
                  }}
                >
                  <Text style={{ color: theme.whiteBase }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveEdit}
                  style={{
                    flex: 1,
                    padding: 14,
                    alignItems: "center",
                    borderRadius: 8,
                    backgroundColor: theme.taskLightPrimary,
                  }}
                >
                  <Text style={{ color: theme.whiteBase, fontWeight: "bold" }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* 3. Reassignment Modal */}
      {tagToDelete && (
        <Modal visible={true} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: theme.background, minHeight: "50%" },
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
                Select Fallback Tag
              </Text>
              <Text style={{ color: theme.greyBasePrimary, marginBottom: 20 }}>
                Choose a tag to absorb the items currently using this tag.
              </Text>

              <ScrollView contentContainerStyle={styles.wrapContainer}>
                {tags
                  .filter((t) => t.id !== tagToDelete)
                  .map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => executeReassignment(t.id)}
                    >
                      <TagBadge
                        tagId={t.id}
                        tagName={t.name}
                        holeColor={theme.background}
                        mode="big"
                      />
                    </Pressable>
                  ))}
              </ScrollView>

              <Pressable
                onPress={() => setTagToDelete(null)}
                style={{ marginTop: 20, alignItems: "center", padding: 10 }}
              >
                <Text style={{ color: theme.greyBasePrimary }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ... Same styles as app/settings/categories.tsx ...
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 26, fontWeight: "bold" },
  scrollContent: { padding: 16 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 24,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  wrapContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  tagText: { fontSize: 14, fontWeight: "600" },
  emptyText: { marginTop: 20, fontStyle: "italic" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    margin: 20,
  },
});
