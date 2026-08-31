import React, { useContext, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/context-hooks/use-data";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { CategoryBadge } from "@/components/ui/shared/categories/category-badge";
import { CategoryEditModal } from "@/components/ui/shared/categories/category-edit-modal";
import { CategoryCreator } from "@/components/ui/shared/categories/category-creation-view";
import { CategoryDeleteModal } from "@/components/ui/shared/categories/category-delete-modal";
import {
  AppDialog,
  DialogAction,
} from "@/components/shared/dialog-system/AppDialog";

// We will build this in Step 3. Importing it now as a placeholder.
// import { CategoryAnalyticsModal } from '@/components/settings/category-analytics-modal';

export default function CategoriesSettingsScreen() {
  const { theme } = useContext(ThemeContext);
  const {
    categories,
    updateUserCategory,
    deleteUserCategory,
    getCategoryUsageForAll,
    trackMetric,
  } = useData();
  const { reassignTaskCategoryLocal } = useTasks();
  const { reassignHabitCategoryLocal } = useHabits();
  const { reassignEventCategoryLocal } = useEvents();
  const { reassignLogCategoryLocal } = useLogs();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    title: string;
    description?: string;
    actions: DialogAction[];
  } | null>(null);

  // 1. Filter by Search, then Sort by Color (Hex Code String Comparison)
  const displayCategories = useMemo(() => {
    let filtered = categories;

    if (searchQuery) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Sort by color to group similar hues together aesthetically
    return [...filtered].sort((a, b) => a.color.localeCompare(b.color));
  }, [categories, searchQuery]);

  // Get the actual object for editing
  const editData = useMemo(
    () => categories.find((c) => c.id === categoryToEdit),
    [categoryToEdit, categories],
  );

  // --- HANDLERS ---

  const handleEdit = (id: string) => {
    setSelectedCategoryId(null); // Close analytics modal
    setCategoryToEdit(id); // Open edit modal
  };

  const handleDeleteRequest = async (id: string) => {
    // 1. Fetch real stats to see if we need to reassign
    const data = await getCategoryUsageForAll(id);
    const stats = { total: data.total };

    setSelectedCategoryId(null); // Close analytics modal

    if (stats.total === 0) {
      // Safe to hard delete immediately

      showEmptyCategoryDeleteDialog(id);
      //TODO this doesnt work if the category has been assgined once already and then maybe changed, so current allotment is 0, but total is not 0
    } else {
      // Needs reassignment
      showCategoryInUseDialog(id, stats.total);
    }
  };

  const handleDeleteRequestHelper = async (
    id: string,
    fallbackId?: string | null,
  ) => {
    trackMetric(["categoriesDeleted"], 1);
    if (fallbackId === undefined) {
      await deleteUserCategory(id);
      return;
    }
    await deleteUserCategory(id, fallbackId);
  };

  const showEmptyCategoryDeleteDialog = (id: string) => {
    setDialog({
      title: "Delete Category",
      description:
        "This category is empty. Are you sure you want to delete it?",
      actions: [
        {
          label: "Delete",
          variant: "destructive",
          onPress: async () => {
            setDialog(null);
            await handleDeleteRequestHelper(id);
          },
        },
        {
          label: "Cancel",
          variant: "text",
          onPress: () => {
            setDialog(null);
          },
        },
      ],
    });
  };

  const showCategoryInUseDialog = (id: string, total: number) => {
    setDialog({
      title: "Category in Use",
      description: `This category is attached to ${total} items. What would you like to do?`,
      actions: [
        {
          label: "Delete",
          variant: "destructive",
          onPress: async () => {
            setDialog(null);
            await handleDeleteRequestHelper(id, null);
          },
        },
        {
          label: "Reassign Items",
          onPress: () => {
            (setCategoryToDelete(id), setDialog(null));
          },
        },
        {
          label: "Cancel",
          variant: "text",
          onPress: () => {
            setDialog(null);
          },
        },
      ],
    });
  };

  const executeReassignment = async (fallbackId: string) => {
    if (!categoryToDelete) return;
    trackMetric(["categoriesDeleted"], 1);
    await deleteUserCategory(categoryToDelete, fallbackId);
    reassignTaskCategoryLocal(categoryToDelete, fallbackId);
    reassignEventCategoryLocal(categoryToDelete, fallbackId);
    reassignHabitCategoryLocal(categoryToDelete, fallbackId);
    reassignLogCategoryLocal(categoryToDelete, fallbackId);
    setCategoryToDelete(null);
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* 1. Header Area */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={theme.whiteBase} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.whiteBase }]}>
          Categories
        </Text>
        <View style={{ width: 24 }} /* Spacer for centering */ />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 2. Description */}
        <Text style={[styles.description, { color: theme.greyBasePrimary }]}>
          Manage your categories, view their usage history, and customize your
          organization system. Tap any category to view its details.
        </Text>

        {/* 3. Search Bar */}
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
            placeholder="Search categories..."
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

        {/* 4. The FlexWrap Pill Grid */}
        <View style={styles.wrapContainer}>
          {displayCategories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategoryId(cat.id)}
              style={styles.pillWrapper}
            >
              <CategoryBadge category={cat} size="medium" />
            </Pressable>
          ))}

          {displayCategories.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.greyBasePrimary }]}>
              No categories found.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* 5. The Analytics Modal Placeholder (Step 3) */}
      <CategoryEditModal
        categoryId={selectedCategoryId!}
        onClose={() => setSelectedCategoryId(null)}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />
      {categoryToEdit && editData && (
        <CategoryCreator
          isCreating={true}
          onClose={() => setCategoryToEdit(null)}
          onCreateCategory={async (name, color, icon) => {
            trackMetric(["categoriesEdited"], 1);
            await updateUserCategory({ ...editData, name, color, icon });
            setCategoryToEdit(null);
          }}
          editingCategory={editData}
        />
      )}
      {/* Reassignment Modal */}
      {categoryToDelete && (
        <CategoryDeleteModal
          categories={categories}
          categoryToDelete={categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onReassign={executeReassignment}
        />
      )}
      {dialog && (
        <AppDialog
          visible
          title={dialog.title}
          description={dialog.description}
          onDismiss={() => setDialog(null)}
          dismissable={false}
          actions={dialog.actions}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12, // Provides consistent grid spacing matching your mockups
  },
  pillWrapper: {
    // We wrap the CategoryBadge in a Touchable/Pressable to handle the modal trigger
  },
  emptyText: {
    marginTop: 20,
    fontStyle: "italic",
  },
});
