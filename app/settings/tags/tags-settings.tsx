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
import { useData } from "@/hooks/context-hooks/use-data";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { TagAnalyticsModal } from "@/components/ui/shared/tags/tags-modal";
import { TagBadge } from "@/components/ui/shared/tags/tag-badge";
import { TagsDeleteModal } from "@/components/ui/shared/tags/tags-delete-modal";
import { TagsEditModal } from "@/components/ui/shared/tags/tags-edit-modal";

export default function TagsSettingsScreen() {
  const { theme } = useContext(ThemeContext);
  const { tags, updateUserTag, deleteUserTag, getTagUsageForAll, trackMetric } =
    useData();
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
      trackMetric(["tagsEdited"], 1);
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

      <TagAnalyticsModal
        tagId={selectedTagId!}
        onClose={() => setSelectedTagId(null)}
        onEdit={handleEditRequest}
        onDelete={handleDeleteRequest}
      />

      {/* 2. Mini Edit Modal */}
      {tagToEdit && (
        <TagsEditModal
          tagToEdit={tagToEdit}
          editNameValue={editNameValue}
          setEditNameValue={setEditNameValue}
          onSave={handleSaveEdit}
          onClose={() => setTagToEdit(null)}
        />
      )}
      {/* 3. Reassignment Modal */}
      {tagToDelete && (
        <TagsDeleteModal
          tags={tags}
          tagToDelete={tagToDelete}
          onClose={() => setTagToDelete(null)}
          onReassign={executeReassignment}
        />
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
});
