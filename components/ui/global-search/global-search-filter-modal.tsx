import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import type { GlobalSearchFilters } from "@/types/global-search";

import { normalizeSearchText } from "@/utils/Search-utils/text-normalization";

// Adjust these two paths to the actual locations of your existing components.
import { TagBadge } from "@/components/ui/shared/tags/tag-badge";
import { CategoryBadge } from "@/components/ui/shared/categories/category-badge";

export interface GlobalSearchFilterPalette {
  background: string;
  surface: string;
  text: string;
  secondaryText: string;
  border: string;
  accent: string;
  selectedSurface: string;
}

const DEFAULT_PALETTE: GlobalSearchFilterPalette = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  text: "#202124",
  secondaryText: "#666666",
  border: "#DADCE0",
  accent: "#5265D5",
  selectedSurface: "#EEF0FF",
};

interface GlobalSearchFilterModalProps {
  visible: boolean;
  categories: Category[];
  tags: Tag[];

  // Pass draftFilters from useGlobalSearchFilters(), not applied filters.
  draftFilters: GlobalSearchFilters;

  onToggleCategory: (categoryId: string) => void;
  onToggleTag: (tagId: string) => void;
  onTagMatchModeChange: (mode: "all" | "any") => void;
  onClearFacets: () => void;
  onApply: () => void;
  onCancel: () => void;

  palette?: GlobalSearchFilterPalette;
}

export function GlobalSearchFilterModal({
  visible,
  categories,
  tags,
  draftFilters,
  onToggleCategory,
  onToggleTag,
  onTagMatchModeChange,
  onClearFacets,
  onApply,
  onCancel,
  palette = DEFAULT_PALETTE,
}: GlobalSearchFilterModalProps) {
  const [pickerQuery, setPickerQuery] = useState("");

  useEffect(() => {
    if (visible) {
      // This is intentionally independent of the main search query.
      setPickerQuery("");
    }
  }, [visible]);

  const normalizedPickerQuery = normalizeSearchText(pickerQuery);

  const visibleCategories = useMemo(() => {
    if (!normalizedPickerQuery) return categories;

    return categories.filter((category) =>
      normalizeSearchText(category.name).includes(normalizedPickerQuery),
    );
  }, [categories, normalizedPickerQuery]);

  const visibleTags = useMemo(() => {
    if (!normalizedPickerQuery) return tags;

    return tags.filter((tag) =>
      normalizeSearchText(tag.name).includes(normalizedPickerQuery),
    );
  }, [tags, normalizedPickerQuery]);

  const selectedCategories = useMemo(
    () =>
      categories.filter((category) =>
        draftFilters.categoryIds.includes(category.id),
      ),
    [categories, draftFilters.categoryIds],
  );

  const selectedTags = useMemo(
    () => tags.filter((tag) => draftFilters.tagIds.includes(tag.id)),
    [tags, draftFilters.tagIds],
  );

  const hasSelectedFacets =
    draftFilters.categoryIds.length > 0 || draftFilters.tagIds.length > 0;

  const renderSectionHeading = (title: string, count: number) => (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {title}
      </Text>
      <Text style={[styles.count, { color: palette.secondaryText }]}>
        {count}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filter picker"
          style={styles.backdrop}
          onPress={onCancel}
        />

        <View style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: palette.text }]}>
                Filter Search
              </Text>
              <Text style={[styles.subtitle, { color: palette.secondaryText }]}>
                Choose categories and tags to narrow your results.
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filters"
              hitSlop={10}
              onPress={onCancel}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={23} color={palette.text} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={19}
              color={palette.secondaryText}
            />
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Find a category or tag"
              placeholderTextColor={palette.secondaryText}
              style={[styles.searchInput, { color: palette.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search categories and tags"
            />
            {pickerQuery.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear picker search"
                hitSlop={8}
                onPress={() => setPickerQuery("")}
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={palette.secondaryText}
                />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {(selectedCategories.length > 0 || selectedTags.length > 0) && (
              <View
                style={[
                  styles.selectedSection,
                  { borderColor: palette.border },
                ]}
              >
                <View style={styles.selectedHeading}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Selected filters
                  </Text>

                  <Pressable accessibilityRole="button" onPress={onClearFacets}>
                    <Text style={[styles.linkText, { color: palette.accent }]}>
                      Clear all
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.badgeWrap}>
                  {selectedCategories.map((category) => (
                    <Pressable
                      key={`selected-category-${category.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove category ${category.name}`}
                      onPress={() => onToggleCategory(category.id)}
                      style={styles.selectedBadge}
                    >
                      <CategoryBadge
                        categoryId={category.id}
                        variant="default"
                        size="small"
                      />
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={palette.secondaryText}
                      />
                    </Pressable>
                  ))}

                  {selectedTags.map((tag) => (
                    <Pressable
                      key={`selected-tag-${tag.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove tag ${tag.name}`}
                      onPress={() => onToggleTag(tag.id)}
                      style={styles.selectedBadge}
                    >
                      <TagBadge
                        tagId={tag.id}
                        holeColor={palette.background}
                        mode="small"
                      />
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={palette.secondaryText}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* <View style={styles.section}>
              {renderSectionHeading("Categories", visibleCategories.length)}

              {visibleCategories.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: palette.secondaryText }]}
                >
                  No matching categories.
                </Text>
              ) : (
                visibleCategories.map((category) => {
                  const selected = draftFilters.categoryIds.includes(
                    category.id,
                  );

                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => onToggleCategory(category.id)}
                      style={[
                        styles.optionRow,
                        selected && {
                          backgroundColor: palette.selectedSurface,
                        },
                      ]}
                    >
                      <CategoryBadge
                        categoryId={category.id}
                        variant="default"
                        size="small"
                      />

                      <View style={styles.optionSpacer} />

                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={21}
                        color={
                          selected ? palette.accent : palette.secondaryText
                        }
                      />
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              {renderSectionHeading("Tags", visibleTags.length)}

              <Text
                style={[styles.helperText, { color: palette.secondaryText }]}
              >
                Choose whether results must match all selected tags or at least
                one.
              </Text>

              <View
                style={[styles.modeContainer, { borderColor: palette.border }]}
              >
                {(["all", "any"] as const).map((mode) => {
                  const selected = draftFilters.tagMatchMode === mode;

                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => onTagMatchModeChange(mode)}
                      style={[
                        styles.modeButton,
                        selected && {
                          backgroundColor: palette.selectedSurface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? palette.accent : palette.text,
                          fontWeight: selected ? "700" : "500",
                        }}
                      >
                        {mode === "all" ? "Match all" : "Match any"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {visibleTags.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: palette.secondaryText }]}
                >
                  No matching tags.
                </Text>
              ) : (
                visibleTags.map((tag) => {
                  const selected = draftFilters.tagIds.includes(tag.id);

                  return (
                    <Pressable
                      key={tag.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => onToggleTag(tag.id)}
                      style={[
                        styles.optionRow,
                        selected && {
                          backgroundColor: palette.selectedSurface,
                        },
                      ]}
                    >
                      <TagBadge
                        tagId={tag.id}
                        holeColor={palette.background}
                        mode="small"
                      />

                      <View style={styles.optionSpacer} />

                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={21}
                        color={
                          selected ? palette.accent : palette.secondaryText
                        }
                      />
                    </Pressable>
                  );
                })
              )}
            </View> */}
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Categories &amp; Tags
                </Text>

                <Text style={[styles.count, { color: palette.secondaryText }]}>
                  {visibleCategories.length} categories · {visibleTags.length}{" "}
                  tags
                </Text>
              </View>

              <Text
                style={[styles.helperText, { color: palette.secondaryText }]}
              >
                Select categories and tags to narrow your search.
              </Text>

              <View
                style={[styles.modeContainer, { borderColor: palette.border }]}
              >
                {(["all", "any"] as const).map((mode) => {
                  const selected = draftFilters.tagMatchMode === mode;

                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => onTagMatchModeChange(mode)}
                      style={[
                        styles.modeButton,
                        selected && {
                          backgroundColor: palette.selectedSurface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? palette.accent : palette.text,
                          fontWeight: selected ? "700" : "500",
                        }}
                      >
                        {mode === "all" ? "Match all tags" : "Match any tag"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {visibleCategories.length === 0 && visibleTags.length === 0 ? (
                <Text
                  style={[styles.emptyText, { color: palette.secondaryText }]}
                >
                  No matching categories or tags.
                </Text>
              ) : (
                <View style={styles.taxonomyOptionsWrap}>
                  {visibleCategories.map((category) => {
                    const selected = draftFilters.categoryIds.includes(
                      category.id,
                    );

                    return (
                      <Pressable
                        key={`category-${category.id}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Category ${category.name}`}
                        onPress={() => onToggleCategory(category.id)}
                        style={[
                          styles.taxonomyOption,
                          selected && {
                            backgroundColor: palette.selectedSurface,
                            borderColor: palette.accent,
                          },
                        ]}
                      >
                        <CategoryBadge
                          categoryId={category.id}
                          variant="default"
                          size="small"
                        />
                      </Pressable>
                    );
                  })}

                  {visibleTags.map((tag) => {
                    const selected = draftFilters.tagIds.includes(tag.id);

                    return (
                      <Pressable
                        key={`tag-${tag.id}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`Tag ${tag.name}`}
                        onPress={() => onToggleTag(tag.id)}
                        style={[
                          styles.taxonomyOption,
                          selected && {
                            backgroundColor: palette.selectedSurface,
                            borderColor: palette.accent,
                          },
                        ]}
                      >
                        <TagBadge
                          tagId={tag.id}
                          holeColor={palette.background}
                          mode="small"
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[
                styles.footerButton,
                styles.cancelButton,
                { borderColor: palette.border },
              ]}
            >
              <Text style={[styles.cancelText, { color: palette.text }]}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onApply}
              style={[
                styles.footerButton,
                styles.applyButton,
                { backgroundColor: palette.accent },
              ]}
            >
              <Text style={styles.applyText}>Apply filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  sheet: {
    height: "88%",
    maxHeight: "94%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    padding: 6,
    marginLeft: 12,
  },
  searchContainer: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    paddingVertical: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectedSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  selectedHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 6,
  },
  section: {
    marginTop: 16,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  count: {
    fontSize: 13,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  optionRow: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  optionSpacer: {
    flex: 1,
  },
  modeContainer: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  modeButton: {
    minHeight: 34,
    minWidth: 94,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 10,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cancelButton: {
    borderWidth: 1,
    flex: 1,
  },
  applyButton: {
    flex: 1.5,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  applyText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  taxonomyOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    columnGap: 6,
    rowGap: 8,
  },

  taxonomyOption: {
    alignSelf: "flex-start",
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
});
