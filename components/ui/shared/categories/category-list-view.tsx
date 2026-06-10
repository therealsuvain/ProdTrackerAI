import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
} from "react-native";

import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { CategoryBadge } from "./category-badge";
import { Category } from "@/types/category";
import { CategoryItem } from "./category-item";

interface CategoryListProps {
  selectedCategory: string | null;
  selectedCategoryObject: Category | undefined;
  categoriesDb: Category[];
  sessionCategories: Set<string>;
  selectCategory: (categoryId: string) => void;
  deselectCategory: () => void;
  onDeleteCategory: (id: string) => Promise<void>;
  openCategoryCreator: () => void;
  onClose: () => void;
}
export const CategoryList = ({
  selectedCategory,
  selectedCategoryObject,
  categoriesDb,
  sessionCategories,
  selectCategory,
  deselectCategory,
  onDeleteCategory,
  openCategoryCreator,
  onClose,
}: CategoryListProps) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const topCategories = useMemo(
    () => [...categoriesDb].sort((a, b) => b.count - a.count).slice(0, 12),
    [categoriesDb],
  );

  const recentCategories = useMemo(
    () =>
      [...categoriesDb]
        .filter((c) => c.updatedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5),
    [categoriesDb],
  );

  // 3. Search Filtering
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return [];
    return categoriesDb.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery, categoriesDb]);

  const isDraft = useMemo(() => {
    if (!selectedCategory) return false;
    return sessionCategories.has(selectedCategory);
  }, [sessionCategories, selectedCategory]);
  const renderCategoryItem = ({ item }: { item: Category }) => {
    if (selectedCategory === item.id) return null;
    const isDraft = sessionCategories.has(item.id);
    return (
      <CategoryItem
        category={item}
        variant="list"
        handleSelect={selectCategory}
        handleDelete={onDeleteCategory}
        isNewlyCreated={isDraft}
      />
    );
  };

  return (
    <View>
      <View style={styles.listContainer}>
        <TextInput
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {selectedCategory && (
          <View style={styles.selectedCat}>
            <Text style={styles.sectionHeader}>Current Category :{"    "}</Text>
            <CategoryItem
              category={selectedCategoryObject!}
              variant="selected"
              handleDeSelect={deselectCategory}
              handleDeleteSecondary={() => onDeleteCategory(selectedCategory)}
              isNewlyCreated={isDraft}
            />
          </View>
        )}
        {searchQuery ? (
          // SEARCH VIEW
          <FlatList
            data={filteredCategories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.id}
          />
        ) : (
          // TOP / RECENT VIEW
          <View>
            {recentCategories.length > 0 && (
              <>
                <View style={styles.divider}>
                  <Text style={styles.sectionHeader}>Recently Used</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.wrapContainer}>
                  {recentCategories.map((item) => (
                    <React.Fragment key={item.id}>
                      {renderCategoryItem({ item })}
                    </React.Fragment>
                  ))}
                </View>
              </>
            )}
            <View style={styles.divider}>
              <Text style={styles.sectionHeader}>Top Categories</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.wrapContainer}>
              {topCategories.map((item) => (
                <React.Fragment key={item.id}>
                  {renderCategoryItem({ item })}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.createButton, { borderColor: theme.taskLightPrimary }]}
          onPress={openCategoryCreator}
        >
          <Ionicons name="add" size={20} color={theme.taskLightPrimary} />
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
        {selectedCategory && (
          <Pressable
            style={[
              styles.acceptButton,
              { borderColor: theme.taskLightPrimary },
            ]}
            onPress={onClose}
          >
            <Text
              style={{
                color: theme.taskLightPrimary,
                fontWeight: "800",
              }}
            >
              OK
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  listContainer: {
    flexShrink: 1, // Allows FlatList to scroll within the modal limits
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    borderColor: "#ffffff",
    color: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  selectedCat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginVertical: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ffffff",
  },
  wrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8, // Creates grid-like spacing for pills
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  createButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: "dashed",
  },

  acceptButton: {
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    borderWidth: 1,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
