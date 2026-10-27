import React, { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";

import type { GlobalSearchDocument } from "@/types/global-search";
import type {
  RecentGlobalSearch,
  RecentGlobalSearchItem,
  SavedGlobalSearchScope,
} from "@/types/global-search-convenience";

interface Props {
  savedScopes: readonly SavedGlobalSearchScope[];
  recentSearches: readonly RecentGlobalSearch[];
  recentItems: readonly RecentGlobalSearchItem[];
  shortcuts: readonly GlobalSearchDocument[];
  isLoaded: boolean;

  onApplyScope: (scope: SavedGlobalSearchScope) => void;
  onManageScopes: () => void;

  onRestoreSearch: (search: RecentGlobalSearch) => void;
  onRemoveSearch: (id: string) => void;
  onClearSearches: () => void;

  onOpenRecentItem: (item: RecentGlobalSearchItem) => void;
  onRemoveRecentItem: (key: string) => void;
  onClearRecentItems: () => void;

  onActivateShortcut: (document: GlobalSearchDocument) => void;
  onOpenShortcuts: () => void;
}

const KIND_LABELS: Record<string, string> = {
  task: "Task",
  event: "Event",
  habit: "Habit",
  log: "Timer log",
  tag: "Tag",
  category: "Category",
  achievement: "Achievement",
  setting: "Setting",
  chart: "Chart",
  action: "Action",
};

function ScopeSummary({ scope }: { scope: SavedGlobalSearchScope }) {
  const type = scope.filters.type === "all" ? "Everything" : scope.filters.type;

  const parts = [type];

  if (scope.filters.categoryIds.length) {
    parts.push(`${scope.filters.categoryIds.length} categories`);
  }

  if (scope.filters.tagIds.length) {
    parts.push(`${scope.filters.tagIds.length} tags`);
    parts.push(
      scope.filters.tagMatchMode === "all" ? "Match all" : "Match any",
    );
  }

  return <>{parts.join(" · ")}</>;
}

function SectionHeading({
  title,
  action,
  onAction,
  accentColor,
  textColor,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  accentColor: string;
  textColor: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text
        variant="titleSmall"
        style={{ color: textColor, fontWeight: "700" }}
      >
        {title}
      </Text>

      {action && onAction && (
        <Button compact textColor={accentColor} onPress={onAction}>
          {action}
        </Button>
      )}
    </View>
  );
}

export function GlobalSearchConveniencePanel({
  savedScopes,
  recentSearches,
  recentItems,
  shortcuts,
  isLoaded,
  onApplyScope,
  onManageScopes,
  onRestoreSearch,
  onRemoveSearch,
  onClearSearches,
  onOpenRecentItem,
  onRemoveRecentItem,
  onClearRecentItems,
  onActivateShortcut,
  onOpenShortcuts,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const muted = withAlpha(theme.text, "A8");

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open shortcuts, quick actions and saved scopes"
        onPress={onOpenShortcuts}
        style={({ pressed }) => [
          styles.shortcutsButton,
          {
            backgroundColor: withAlpha(theme.taskBase, "0D"),
            borderColor: withAlpha(theme.taskBase, "40"),
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.shortcutsIcon,
            { backgroundColor: withAlpha(theme.taskBase, "20") },
          ]}
        >
          <MaterialCommunityIcons
            name="lightning-bolt-outline"
            size={22}
            color={theme.taskBase}
          />
        </View>

        <View style={styles.shortcutsCopy}>
          <Text
            variant="titleSmall"
            style={{ color: theme.text, fontWeight: "700" }}
          >
            Shortcuts
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: withAlpha(theme.text, "A8") }}
          >
            {shortcuts.length} quick action
            {shortcuts.length === 1 ? "" : "s"} · {savedScopes.length} saved
            scope
            {savedScopes.length === 1 ? "" : "s"}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={withAlpha(theme.text, "A8")}
        />
      </Pressable>

      {/*  //OLD! Version of quick action shortcuts and save scopes */}
      {/*  {shortcuts.length > 0 && (
        <View style={styles.section}>
          <SectionHeading
            title="Quick actions"
            textColor={theme.text}
            accentColor={theme.taskBase}
          />

          <View style={styles.actionWrap}>
            {shortcuts.map((document) => {
              const iconName =
                document.display.presentation?.icon?.name ??
                "lightning-bolt-outline";

              return (
                <Pressable
                  key={document.key}
                  accessibilityRole="button"
                  accessibilityLabel={document.display.title}
                  onPress={() => onActivateShortcut(document)}
                  style={({ pressed }) => [
                    styles.actionChip,
                    {
                      backgroundColor: withAlpha(theme.taskBase, "14"),
                      borderColor: withAlpha(theme.taskBase, "55"),
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      iconName as React.ComponentProps<
                        typeof MaterialCommunityIcons
                      >["name"]
                    }
                    size={19}
                    color={theme.taskBase}
                  />

                  <Text variant="labelLarge" style={{ color: theme.text }}>
                    {document.display.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      
      <View style={styles.section}>
        <SectionHeading
          title="Saved scopes"
          action="Manage"
          onAction={onManageScopes}
          textColor={theme.text}
          accentColor={theme.taskBase}
        />

        {!isLoaded ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            Loading saved scopes…
          </Text>
        ) : savedScopes.length === 0 ? (
          <Text variant="bodySmall" style={{ color: muted }}>
            Save a category, tag, or type combination for quick access.
          </Text>
        ) : (
          <View style={styles.scopeWrap}>
            {savedScopes.map((scope) => (
              <Pressable
                key={scope.id}
                accessibilityRole="button"
                accessibilityLabel={`Apply saved scope ${scope.name}`}
                onPress={() => onApplyScope(scope)}
                style={({ pressed }) => [
                  styles.scopeChip,
                  {
                    borderColor: withAlpha(theme.taskBase, "55"),
                    backgroundColor: withAlpha(theme.taskBase, "0D"),
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="bookmark-outline"
                  size={16}
                  color={theme.taskBase}
                />

                <View style={styles.scopeCopy}>
                  <Text
                    variant="labelLarge"
                    numberOfLines={1}
                    style={{ color: theme.text }}
                  >
                    {scope.name}
                  </Text>

                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={{ color: muted }}
                  >
                    <ScopeSummary scope={scope} />
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View> */}

      {/* Recent searches remain session-only. */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <SectionHeading
            title="Recent searches"
            action="Clear"
            onAction={onClearSearches}
            textColor={theme.text}
            accentColor={theme.taskBase}
          />

          {recentSearches.map((search) => (
            <View key={search.id} style={styles.recentRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Repeat search ${search.query}`}
                onPress={() => onRestoreSearch(search)}
                style={styles.recentMain}
              >
                <MaterialCommunityIcons
                  name="history"
                  size={19}
                  color={muted}
                />

                <View style={styles.recentCopy}>
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    style={{ color: theme.text }}
                  >
                    {search.query}
                  </Text>

                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={{ color: muted }}
                  >
                    <ScopeSummary
                      scope={{
                        id: search.id,
                        name: "",
                        filters: search.filters,
                        createdAt: search.searchedAt,
                        updatedAt: search.searchedAt,
                      }}
                    />
                  </Text>
                </View>
              </Pressable>

              <IconButton
                icon="close"
                size={17}
                iconColor={muted}
                onPress={() => onRemoveSearch(search.id)}
                accessibilityLabel={`Remove recent search ${search.query}`}
              />
            </View>
          ))}
        </View>
      )}

      {/* Recent destinations and records */}
      {recentItems.length > 0 && (
        <View style={styles.section}>
          <SectionHeading
            title="Recently opened"
            action="Clear"
            onAction={onClearRecentItems}
            textColor={theme.text}
            accentColor={theme.taskBase}
          />

          {recentItems.slice(0, 6).map((item) => (
            <View key={item.key} style={styles.recentRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open recent ${KIND_LABELS[item.kind] ?? "item"} ${item.title}`}
                onPress={() => onOpenRecentItem(item)}
                style={styles.recentMain}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={19}
                  color={muted}
                />

                <View style={styles.recentCopy}>
                  <Text
                    variant="bodyMedium"
                    numberOfLines={1}
                    style={{ color: theme.text }}
                  >
                    {item.title}
                  </Text>

                  <Text
                    variant="bodySmall"
                    numberOfLines={1}
                    style={{ color: muted }}
                  >
                    {KIND_LABELS[item.kind] ?? "Item"}
                    {item.subtitle ? ` · ${item.subtitle}` : ""}
                  </Text>
                </View>
              </Pressable>

              <IconButton
                icon="close"
                size={17}
                iconColor={muted}
                onPress={() => onRemoveRecentItem(item.key)}
                accessibilityLabel={`Remove ${item.title} from recent items`}
              />
            </View>
          ))}
        </View>
      )}

      <Text
        variant="bodySmall"
        style={[styles.footerHint, { color: withAlpha(theme.text, "80") }]}
      >
        Search any item, apply filters, or jump straight to a recent
        destination.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 20,
  },
  section: {
    gap: 9,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
  },
  //!OLD VERSION STYLES VIEW VERSION
  /* actionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  scopeWrap: {
    gap: 8,
  },
  scopeChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scopeCopy: {
    flex: 1,
    gap: 2,
  }, */
  shortcutsButton: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shortcutsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutsCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
  },
  recentMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 10,
    paddingVertical: 6,
  },
  recentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footerHint: {
    textAlign: "center",
    marginTop: 2,
  },
});
