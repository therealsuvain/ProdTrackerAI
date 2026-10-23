import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Searchbar, Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import { SearchResult } from "@/utils/search-utils";
import { SearchResultRow } from "@/components/ui/global-search/search-result-row";
import {
  selectCategoryList,
  useCategoryStore,
} from "@/stores/use-category-store";
import { selectTagList, useTagStore } from "@/stores/use-tag-store";
import { useShallow } from "zustand/shallow";
import { GlobalSearchFilterModal } from "./global-search-filter-modal";
import { useGlobalSearchController } from "@/hooks/use-global-search-controller";
import type {
  GlobalSearchSelectionRequest,
  GlobalSearchTarget,
  GlobalSearchFilterKind,
  GlobalSearchKind,
  GlobalSearchResult,
} from "@/types/global-search";

import { createGlobalSearchSelectionRequest } from "@/utils/Search-utils/selection-dispatcher";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagBadge } from "../shared/tags/tag-badge";

type SearchFilter = "all" | GlobalSearchFilterKind;

type SearchSection = {
  title: string;
  type: GlobalSearchFilterKind;
  data: GlobalSearchResult[];
};

const TYPE_LABELS: Record<GlobalSearchFilterKind, string> = {
  task: "Tasks",
  event: "Events",
  habit: "Habits",
  log: "Timer logs",
  tag: "Tags",
  category: "Categories",
  achievement: "Achievements",
  setting: "Settings",
  chart: "Charts",
  action: "Actions",
};

const FILTERS: { label: string; value: SearchFilter }[] = [
  { label: "Everything", value: "all" },
  { label: "Tasks", value: "task" },
  { label: "Events", value: "event" },
  { label: "Habits", value: "habit" },
  { label: "Timer logs", value: "log" },
  { label: "Tags", value: "tag" },
  { label: "Categories", value: "category" },
  { label: "Achievements", value: "achievement" },
];

type Props = {
  visible: boolean;
  query: string;
  results?: SearchResult[];
  onQueryChange: (query: string) => void;
  onDismiss: () => void;
  onItemPress: (request: GlobalSearchSelectionRequest) => void;
};

function getGlobalSearchTarget(result: SearchResult): GlobalSearchTarget {
  const id = String(result.item.id);

  switch (result.type) {
    case "task":
      return { kind: "task", id };

    case "event":
      return { kind: "event", id };

    case "habit":
      return { kind: "habit", id };

    case "log":
      return { kind: "log", id };
  }
}

export function GlobalSearchScreen({
  visible,
  query,
  onQueryChange,
  onDismiss,
  onItemPress,
}: Props) {
  const { theme } = useContext(ThemeContext);

  const searchInputRef = useRef<TextInput>(null);

  const categories = useCategoryStore(useShallow(selectCategoryList));
  const tags = useTagStore(useShallow(selectTagList));

  const controller = useGlobalSearchController({
    query,
    onQueryChange,
  });

  const [showFilterModal, setShowFilterModal] = useState(false);

  const openFilterModal = useCallback(() => {
    controller.openFilterPicker();
    setShowFilterModal(true);
  }, [controller.openFilterPicker]);

  // Resolve the ranked document targets back to their live source records.
  // This compatibility adapter lets the current SearchResultRow and
  // onItemPress continue to work while the richer dispatcher is deferred.
  const filteredResults = controller.results;

  const selectedType = controller.filters.type as SearchFilter;

  const activeCategoryFilters = useMemo(
    () =>
      controller.filters.categoryIds.map((id) => ({
        id,
        label:
          categories.find((category) => category.id === id)?.name ??
          "Unknown category",
      })),
    [controller.filters.categoryIds, categories],
  );

  const activeTagFilters = useMemo(
    () =>
      controller.filters.tagIds.map((id) => ({
        id,
        label: tags.find((tag) => tag.id === id)?.name ?? "Unknown tag",
      })),
    [controller.filters.tagIds, tags],
  );

  const sections = useMemo<SearchSection[]>(() => {
    const types = [
      ...new Set(filteredResults.map((result) => result.document.kind)),
    ].filter((type): type is GlobalSearchFilterKind => type !== "easterEgg");

    return types
      .map((type) => ({
        type,
        title: TYPE_LABELS[type],
        data: filteredResults.filter((result) => result.document.kind === type),
      }))
      .filter((section) => section.data.length > 0);
  }, [filteredResults]);

  const getAccentColor = (type: SearchFilter) => {
    switch (type) {
      case "task":
        return theme.taskBase;
      case "event":
        return theme.eventBase;
      case "habit":
        return theme.habitBase;
      case "log":
        return theme.timerBase;
      default:
        return theme.taskBase;
    }
  };

  const isQueryEmpty = query.trim().length === 0;
  const hasActiveFilters = controller.hasActiveFilters;

  const emptyTitle =
    isQueryEmpty && !hasActiveFilters
      ? "Your search starts here"
      : isQueryEmpty
        ? "No items match these filters"
        : "No matches found";

  const emptyDescription =
    isQueryEmpty && !hasActiveFilters
      ? "Search for tasks, events, habits and timer logs, all in one place."
      : isQueryEmpty
        ? "Try removing a category or tag filter, or choose a different type."
        : `We couldn't find anything for "${query.trim()}". Try another keyword or adjust your filters.`;

  const handleEmptyAction = () => {
    if (controller.hasActiveFilters) {
      controller.clearAllFilters();
      return;
    }

    controller.clearQuery();
  };

  useEffect(() => {
    if (!visible) return;

    const delay = Platform.OS === "android" ? 250 : 100;

    const timeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, delay);

    return () => clearTimeout(timeout);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onDismiss}
    >
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={[styles.screen, { backgroundColor: theme.background }]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              size={25}
              iconColor={theme.text}
              onPress={onDismiss}
              accessibilityLabel="Close search"
            />

            <View style={styles.headerCopy}>
              <Text
                variant="titleLarge"
                style={[styles.headerTitle, { color: theme.text }]}
              >
                Search Everything
              </Text>

              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{ color: withAlpha(theme.text, "A8") }}
              >
                {isQueryEmpty && !hasActiveFilters
                  ? "Search across your app"
                  : `${filteredResults.length} result${
                      filteredResults.length === 1 ? "" : "s"
                    } ${
                      isQueryEmpty
                        ? "matching current filters"
                        : `for "${query.trim()}"`
                    }`}
              </Text>
            </View>
          </View>

          {/* Search input */}
          <Searchbar
            placeholder="Search everything"
            ref={searchInputRef}
            value={query}
            onChangeText={controller.setQuery}
            iconColor={theme.text}
            placeholderTextColor={withAlpha(theme.text, "80")}
            inputStyle={{ color: theme.text }}
            style={[
              styles.searchbar,
              {
                backgroundColor: theme.taskBaseTransToo,
                borderColor: withAlpha(theme.text, "12"),
              },
            ]}
            accessibilityLabel="Search everything"
          />

          {/* Type filters */}
          <View style={styles.typeFilterRow}>
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingRight: 6,
                borderRightWidth: 1,
                borderRadius: 4,
                borderRightColor: withAlpha(theme.taskBase, "33"),
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  controller.activeFacetCount > 0
                    ? `Edit filters, ${controller.activeFacetCount} active`
                    : "Edit search filters"
                }
                onPress={openFilterModal}
                style={[
                  styles.taxnonomyChip,

                  {
                    backgroundColor: withAlpha(theme.text, "08"),
                    borderColor: withAlpha(theme.text, "24"),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={17}
                  color={theme.text}
                />
                {/*  <Text variant="labelLarge" style={{ color: theme.text }}>
                Filters
              </Text> */}

                {controller.activeFacetCount > 0 && (
                  <View
                    style={[
                      styles.filterCountBadge,
                      { backgroundColor: theme.taskBase },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: theme.whiteBase }}
                    >
                      {controller.activeFacetCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              contentContainerStyle={styles.filtersContent}
              style={styles.filtersScroll}
            >
              {FILTERS.map((filter) => {
                const selected = selectedType === filter.value;
                const accent = getAccentColor(filter.value);

                return (
                  <Pressable
                    key={filter.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => controller.setType(filter.value)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected
                          ? accent
                          : withAlpha(theme.text, "08"),
                        borderColor: selected
                          ? accent
                          : withAlpha(theme.text, "16"),
                      },
                    ]}
                  >
                    <Text
                      variant="labelLarge"
                      numberOfLines={1}
                      style={{
                        color: selected ? theme.whiteBase : theme.text,
                        fontWeight: selected ? "600" : "400",
                      }}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {(activeCategoryFilters.length > 0 ||
            activeTagFilters.length > 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.activeFiltersContent}
              style={styles.activeFiltersScroll}
            >
              {activeCategoryFilters.map((category) => (
                <Pressable
                  key={`active-category-${category.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove category filter ${category.label}`}
                  onPress={() => controller.removeCategoryFilter(category.id)}
                  style={[
                    styles.activeFilterChip,
                    {
                      backgroundColor: withAlpha(theme.taskBase, "12"),
                      borderColor: withAlpha(theme.taskBase, "40"),
                    },
                  ]}
                >
                  {/*  <Text
                    variant="labelMedium"
                    numberOfLines={1}
                    style={{ color: theme.text }}
                  >
                    {category.label}
                  </Text> */}
                  <CategoryBadge categoryId={category.id} />
                  <MaterialCommunityIcons
                    name="close"
                    size={15}
                    color={theme.text}
                  />
                </Pressable>
              ))}

              {activeTagFilters.map((tag) => (
                <Pressable
                  key={`active-tag-${tag.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag filter ${tag.label}`}
                  onPress={() => controller.removeTagFilter(tag.id)}
                  style={[
                    styles.activeFilterChip,
                    {
                      backgroundColor: withAlpha(theme.taskBase, "12"),
                      borderColor: withAlpha(theme.taskBase, "40"),
                    },
                  ]}
                >
                  {/* <Text
                    variant="labelMedium"
                    numberOfLines={1}
                    style={{ color: theme.text }}
                  >
                    {tag.label}
                  </Text> */}
                  <TagBadge tagId={tag.id} holeColor={theme.background} />
                  <MaterialCommunityIcons
                    name="close"
                    size={15}
                    color={theme.text}
                  />
                </Pressable>
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={controller.clearAllFilters}
                style={styles.clearFiltersButton}
              >
                <Text variant="labelMedium" style={{ color: theme.taskBase }}>
                  Clear all
                </Text>
              </Pressable>
            </ScrollView>
          )}

          {/* Grouped results */}
          <SectionList<GlobalSearchResult, SearchSection>
            sections={sections}
            keyExtractor={(item, index) =>
              `${String(item.document.key ?? index)}`
            }
            renderSectionHeader={({ section }) => (
              <View
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: theme.background,
                    borderBottomColor: withAlpha(theme.text, "12"),
                  },
                ]}
              >
                <Text
                  variant="titleMedium"
                  style={[styles.sectionTitle, { color: theme.text }]}
                >
                  {section.title}
                </Text>

                <Text
                  variant="labelMedium"
                  style={{
                    color: withAlpha(getAccentColor(section.type), "FF"),
                  }}
                >
                  {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <SearchResultRow
                result={item}
                query={query}
                onPress={() =>
                  onItemPress(
                    createGlobalSearchSelectionRequest(item.document.target),
                  )
                }
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View
                  style={[
                    styles.emptyIconContainer,
                    {
                      backgroundColor: withAlpha(theme.taskBase, "18"),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isQueryEmpty ? "magnify" : "text-search"}
                    size={34}
                    color={theme.taskBase}
                  />
                </View>

                <Text
                  variant="titleLarge"
                  style={[styles.emptyTitle, { color: theme.text }]}
                >
                  {emptyTitle}
                </Text>

                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyDescription,
                    { color: withAlpha(theme.text, "A8") },
                  ]}
                >
                  {emptyDescription}
                </Text>

                {(!isQueryEmpty || controller.hasActiveFilters) && (
                  <Button
                    mode="text"
                    textColor={theme.taskBase}
                    onPress={handleEmptyAction}
                    style={styles.emptyAction}
                  >
                    {isQueryEmpty ? "Clear filters" : "Clear search"}
                  </Button>
                )}
              </View>
            }
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
          />
          <GlobalSearchFilterModal
            visible={showFilterModal}
            categories={categories}
            tags={tags}
            draftFilters={controller.draftFilters ?? controller.filters}
            onToggleCategory={controller.toggleDraftCategory}
            onToggleTag={controller.toggleDraftTag}
            onTagMatchModeChange={controller.setDraftTagMatchMode}
            onClearFacets={controller.clearDraftFacets}
            onApply={() => {
              controller.applyFilterEditing();
              setShowFilterModal(false);
            }}
            onCancel={() => {
              controller.cancelFilterEditing();
              setShowFilterModal(false);
            }}
            palette={{
              background: theme.background,
              surface: theme.background,
              text: theme.text,
              secondaryText: theme.greyBasePrimary,
              border: theme.greyBaseTertiary,
              accent: theme.taskBase,
              selectedSurface: withAlpha(theme.taskBase, "08"),
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingVertical: 4,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontWeight: "700",
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    elevation: 0,
  },
  typeFilterRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  filtersScroll: {
    flex: 1,
    height: 50,
    // flexGrow: 0,
    flexShrink: 1,
    marginBottom: 8,
  },
  filtersContent: {
    height: 50,
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
    gap: 8,
  },
  filterChip: {
    height: 44,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taxnonomyChip: {
    height: 40,
    width: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  rowSeparator: {
    height: 2,
  },
  resultsContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 70,
    paddingBottom: 50,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    textAlign: "center",
    fontWeight: "700",
  },
  emptyDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
  },
  emptyAction: {
    marginTop: 10,
  },

  filtersButton: {
    flexDirection: "row",
    gap: 6,
  },
  filterCountBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFiltersScroll: {
    maxHeight: 42,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 6,
  },
  activeFiltersContent: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    alignItems: "center",
    gap: 8,
  },
  activeFilterChip: {
    maxWidth: 210,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 16,
  },
  clearFiltersButton: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 5,
  },
});
