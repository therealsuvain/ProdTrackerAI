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
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Searchbar } from "react-native-paper";

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

import { GlobalSearchConveniencePanel } from "@/components/ui/global-search/global-search-convenience-panel";
import { GlobalSearchSavedScopesModal } from "@/components/ui/global-search/global-search-saved-scopes-modal";
import { GlobalSearchShortcutsModal } from "@/components/ui/global-search/global-search-shortcuts-modal";
import type {
  RecentGlobalSearchItem,
  SavedGlobalSearchScope,
} from "@/types/global-search-convenience";
import { Alert, Linking } from "react-native";

import { GlobalSearchEasterEggRow } from "@/components/ui/global-search/search-result-row-easter-egg";
import { matchGlobalSearchEasterEggs } from "@/utils/Search-utils/easter-egg-matcher";
import { GLOBAL_SEARCH_EASTER_EGGS_BY_ID } from "@/utils/Search-utils/easter-egg-registry";
import { recordGlobalSearchEasterEggDiscovery } from "@/utils/Search-utils/easter-egg-discovery";

import { createGlobalSearchSelectionRequest } from "@/utils/Search-utils/selection-dispatcher";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagBadge } from "../shared/tags/tag-badge";

type SearchFilter = "all" | GlobalSearchFilterKind;

type SearchSection = {
  title: string;
  type: GlobalSearchKind;
  data: GlobalSearchResult[];
};

const TYPE_LABELS: Record<GlobalSearchFilterKind, string> = {
  task: "Tasks",
  event: "Events",
  habit: "Habits",
  log: "Logs",
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
  { label: "Logs", value: "log" },
  { label: "Tags", value: "tag" },
  { label: "Categories", value: "category" },
  { label: "Achievements", value: "achievement" },
  { label: "Settings", value: "setting" },
  { label: "Charts", value: "chart" },
  { label: "Actions", value: "action" },
];

type Props = {
  visible: boolean;
  query: string;
  results?: SearchResult[];
  onQueryChange: (query: string) => void;
  onDismiss: () => void;
  onItemPress: (request: GlobalSearchSelectionRequest) => void;
};

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
  const [showSavedScopesModal, setShowSavedScopesModal] = useState(false);
  const openFilterModal = useCallback(() => {
    controller.openFilterPicker();
    setShowFilterModal(true);
  }, [controller.openFilterPicker]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const activeEggActivationRef = useRef<string | null>(null);
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

  const easterEggResults = useMemo(
    () => matchGlobalSearchEasterEggs(query),
    [query],
  );

  const sections = useMemo<SearchSection[]>(() => {
    const next: SearchSection[] = [];

    if (easterEggResults.length > 0) {
      next.push({
        title: "Easter eggs",
        type: "easterEgg",
        data: easterEggResults,
      });
    }

    const ordinaryTypes = [
      ...new Set(filteredResults.map((result) => result.document.kind)),
    ].filter((kind) => kind !== "easterEgg");

    for (const kind of ordinaryTypes) {
      next.push({
        title: TYPE_LABELS[kind as keyof typeof TYPE_LABELS] ?? "Results",
        type: kind,
        data: filteredResults.filter((result) => result.document.kind === kind),
      });
    }

    return next;
  }, [easterEggResults, filteredResults]);

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

  const handleApplySavedScope = useCallback(
    (scope: SavedGlobalSearchScope) => {
      // Only replace filters. Current query remains untouched.
      controller.applySavedScope(scope);
    },
    [controller.applySavedScope],
  );

  const handleSaveScope = useCallback(
    (name: string) => controller.saveScope(name, controller.filters),
    [controller.saveScope, controller.filters],
  );

  const handleRenameScope = useCallback(
    (scope: SavedGlobalSearchScope, name: string) =>
      controller.updateScope(scope.id, name, scope.filters),
    [controller.updateScope],
  );

  const handleUpdateScopeFilters = useCallback(
    (scope: SavedGlobalSearchScope) =>
      controller.updateScope(scope.id, scope.name, controller.filters),
    [controller.updateScope, controller.filters],
  );

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

  const handleEasterEggPress = useCallback(
    async (eggId: string) => {
      // Ignore concurrent taps while an activation is being handed off.
      if (activeEggActivationRef.current) return;

      const egg = GLOBAL_SEARCH_EASTER_EGGS_BY_ID.get(eggId);
      if (!egg) return;

      // These four effects remain intentionally disabled until their designs
      // are approved. Do not mark them discovered during this staging period.
      if (egg.activation.kind === "animation") {
        Alert.alert(
          "Surprise still in development",
          "This Easter egg's effect is being designed. It isn't activated yet.",
        );
        return;
      }

      activeEggActivationRef.current = eggId;

      // If the user submits or activates an egg, retain their current query.
      controller.recordSubmittedSearch();

      try {
        // Discovery is recorded on tap, before trying to open the URL.
        // A failed external URL still counts as an explicit activation tap.
        try {
          await recordGlobalSearchEasterEggDiscovery(eggId);
        } catch (storageError) {
          console.warn(
            "[Global Search] Couldn't persist Easter egg discovery.",
            storageError,
          );
        }

        try {
          // Rickroll only: external navigation happens after the explicit tap.
          await Linking.openURL(egg.activation.url);
        } catch {
          Alert.alert(
            "Couldn't open YouTube",
            "The surprise was activated, but the external link couldn't be opened.",
          );
        }
      } finally {
        activeEggActivationRef.current = null;
      }
    },
    [controller.recordSubmittedSearch],
  );
  const visibleResultCount = filteredResults.length + easterEggResults.length;

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
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                Search Everything
              </Text>

              <Text
                numberOfLines={1}
                style={{ color: withAlpha(theme.text, "A8") }}
              >
                {isQueryEmpty && !hasActiveFilters
                  ? "Search across your app"
                  : `${visibleResultCount} result${
                      visibleResultCount === 1 ? "" : "s"
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
            onSubmitEditing={controller.recordSubmittedSearch}
          />

          {/* Type filters */}
          <View style={styles.filterControlsWrap}>
            <View style={styles.filterChipsWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  controller.activeFacetCount > 0
                    ? `Edit filters, ${controller.activeFacetCount} active`
                    : "Edit search filters"
                }
                onPress={openFilterModal}
                style={[
                  styles.filterButton,
                  {
                    backgroundColor: withAlpha(theme.text, "08"),
                    borderColor: withAlpha(theme.text, "24"),
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={16}
                  color={theme.text}
                />

                {controller.activeFacetCount > 0 && (
                  <View
                    style={[
                      styles.filterCountBadge,
                      { backgroundColor: theme.taskBase },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.whiteBase,
                        fontSize: 10,
                        fontWeight: "500",
                      }}
                    >
                      {controller.activeFacetCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              {FILTERS.map((filter) => {
                const selected = controller.filters.type === filter.value;
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
                          : withAlpha(theme.text, "18"),
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: selected ? theme.whiteBase : theme.text,
                        fontWeight: selected ? "700" : "500",
                        fontSize: 12,
                      }}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/**
           * //OLD! SCROLL VIEW VERSION
           * */}
          {/*  <View style={styles.typeFilterRow}>
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
          </View> */}
          {controller.hasActiveFilters && (
            // <ScrollView
            //   horizontal
            //   showsHorizontalScrollIndicator={false}
            //   keyboardShouldPersistTaps="handled"
            //   contentContainerStyle={styles.activeFiltersContent}
            //   style={styles.activeFiltersScroll}
            // >
            <View style={styles.activeFiltersWrap}>
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
                  <CategoryBadge categoryId={category.id} variant="iconOnly" />
                  <MaterialCommunityIcons
                    name="close"
                    size={12}
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
                    size={12}
                    color={theme.text}
                  />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save current filters as a scope"
                onPress={() => setShowSavedScopesModal(true)}
                style={styles.clearFiltersButton}
              >
                <Text style={{ color: theme.taskBase, fontWeight: "600" }}>
                  Save scope
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={controller.clearAllFilters}
                style={styles.clearFiltersButton}
              >
                <Text style={{ color: theme.taskBase, fontWeight: "600" }}>
                  Clear all
                </Text>
              </Pressable>
            </View>
          )}

          {/* Grouped results */}
          <SectionList<GlobalSearchResult, SearchSection>
            sections={sections}
            keyExtractor={(item, index) =>
              `${String(item.document.key ?? index)}`
            }
            ListHeaderComponent={
              isQueryEmpty && !controller.hasActiveFilters ? (
                <GlobalSearchConveniencePanel
                  savedScopes={controller.savedScopes}
                  recentSearches={controller.recentSearches}
                  recentItems={controller.recentItems}
                  shortcuts={controller.documents.filter(
                    (document) => document.kind === "action",
                  )}
                  isLoaded={controller.isConvenienceStoreLoaded}
                  onApplyScope={handleApplySavedScope}
                  onManageScopes={() => setShowSavedScopesModal(true)}
                  onRestoreSearch={controller.restoreRecentSearch}
                  onRemoveSearch={controller.removeRecentSearch}
                  onClearSearches={controller.clearRecentSearches}
                  onOpenShortcuts={() => setShowShortcutsModal(true)}
                  onOpenRecentItem={(recent: RecentGlobalSearchItem) => {
                    const document = controller.documents.find(
                      (candidate) => candidate.key === recent.key,
                    );

                    if (!document) {
                      void controller.removeRecentItem(recent.key);
                      return;
                    }

                    controller.recordSelectedResult(document);

                    onItemPress(
                      createGlobalSearchSelectionRequest(document.target),
                    );
                  }}
                  onRemoveRecentItem={controller.removeRecentItem}
                  onClearRecentItems={controller.clearRecentItems}
                  onActivateShortcut={(document) => {
                    controller.recordSelectedResult(document);

                    onItemPress(
                      createGlobalSearchSelectionRequest(document.target),
                    );
                  }}
                />
              ) : null
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
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {section.title}
                </Text>

                <Text
                  style={{
                    color: withAlpha(
                      section.type === "easterEgg"
                        ? "#ed62ff"
                        : getAccentColor(section.type),
                      "FF",
                    ),
                    fontWeight: "500",
                    fontSize: 16,
                  }}
                >
                  {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              if (item.document.kind === "easterEgg") {
                const eggId = item.document.target.eggId;
                const activationEnabled = eggId === "rickroll";

                return (
                  <GlobalSearchEasterEggRow
                    result={item}
                    activationEnabled={activationEnabled}
                    onPress={() => {
                      void handleEasterEggPress(eggId);
                    }}
                  />
                );
              }
              return (
                <SearchResultRow
                  result={item}
                  query={query}
                  onPress={() => {
                    controller.recordSelectedResult(item.document);
                    onItemPress(
                      createGlobalSearchSelectionRequest(item.document.target),
                    );
                  }}
                />
              );
            }}
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

                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {emptyTitle}
                </Text>

                <Text
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
          <GlobalSearchSavedScopesModal
            visible={showSavedScopesModal}
            scopes={controller.savedScopes}
            currentFilters={controller.filters}
            canSaveCurrentFilters={controller.hasActiveFilters}
            onClose={() => setShowSavedScopesModal(false)}
            onSaveScope={handleSaveScope}
            onApplyScope={handleApplySavedScope}
            onRenameScope={handleRenameScope}
            onUpdateScopeFilters={handleUpdateScopeFilters}
            onDeleteScope={controller.deleteScope}
            onClearScopes={controller.clearScopes}
          />
          <GlobalSearchShortcutsModal
            visible={showShortcutsModal}
            shortcuts={controller.documents.filter(
              (document) => document.kind === "action",
            )}
            savedScopes={controller.savedScopes}
            isLoaded={controller.isConvenienceStoreLoaded}
            onClose={() => setShowShortcutsModal(false)}
            onManageScopes={() => setShowSavedScopesModal(true)}
            onApplyScope={(scope) => {
              controller.applySavedScope(scope);
            }}
            onActivateShortcut={(document) => {
              controller.recordSelectedResult(document);

              onItemPress(createGlobalSearchSelectionRequest(document.target));
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
    fontSize: 22,
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    elevation: 0,
  },
  //!OLD FILTER CHIP SCROLL VIEW VERSION
  /*   typeFilterRow: {
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
  }, */

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
    fontSize: 16,
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
    fontSize: 22,
  },
  emptyDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
    fontSize: 14,
  },
  emptyAction: {
    marginTop: 10,
  },

  filtersButton: {
    flexDirection: "row",
    gap: 6,
  },
  //!OLD FILTER CHIP SCROLL VIEW VERSION
  /*  filterCountBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  }, */
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
    gap: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 16,
  },
  clearFiltersButton: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  filterControlsWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },

  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  filterChipsWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },

  filterChip: {
    minHeight: 30,
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountBadge: {
    position: "absolute",
    right: -3,
    top: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  activeFiltersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
});
