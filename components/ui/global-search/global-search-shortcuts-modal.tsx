import React, { useContext } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";

import type { GlobalSearchDocument } from "@/types/global-search";
import type { SavedGlobalSearchScope } from "@/types/global-search-convenience";

interface Props {
  visible: boolean;
  shortcuts: readonly GlobalSearchDocument[];
  savedScopes: readonly SavedGlobalSearchScope[];
  isLoaded: boolean;

  onClose: () => void;
  onActivateShortcut: (document: GlobalSearchDocument) => void;
  onApplyScope: (scope: SavedGlobalSearchScope) => void;
  onManageScopes: () => void;
}

function describeScope(scope: SavedGlobalSearchScope) {
  const filters = scope.filters;
  const parts = [filters.type === "all" ? "Everything" : filters.type];

  if (filters.categoryIds.length) {
    parts.push(`${filters.categoryIds.length} categories`);
  }

  if (filters.tagIds.length) {
    parts.push(`${filters.tagIds.length} tags`);
    parts.push(filters.tagMatchMode === "all" ? "Match all" : "Match any");
  }

  return parts.join(" · ");
}

export function GlobalSearchShortcutsModal({
  visible,
  shortcuts,
  savedScopes,
  isLoaded,
  onClose,
  onActivateShortcut,
  onApplyScope,
  onManageScopes,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const muted = withAlpha(theme.text, "A8");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close shortcuts"
        />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text
                variant="titleLarge"
                style={{ color: theme.text, fontWeight: "700" }}
              >
                Shortcuts
              </Text>
              <Text variant="bodySmall" style={{ color: muted }}>
                Quick actions and saved filter combinations.
              </Text>
            </View>

            <IconButton
              icon="close"
              iconColor={theme.text}
              onPress={onClose}
              accessibilityLabel="Close shortcuts"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text
                variant="titleMedium"
                style={{ color: theme.text, fontWeight: "700" }}
              >
                Quick actions
              </Text>

              {shortcuts.length === 0 ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  No quick actions are available.
                </Text>
              ) : (
                shortcuts.map((document) => {
                  const iconName =
                    document.display.presentation?.icon?.name ??
                    "lightning-bolt-outline";

                  return (
                    <Pressable
                      key={document.key}
                      accessibilityRole="button"
                      accessibilityLabel={document.display.title}
                      onPress={() => {
                        onClose();
                        onActivateShortcut(document);
                      }}
                      style={({ pressed }) => [
                        styles.actionRow,
                        {
                          backgroundColor: withAlpha(theme.taskBase, "0D"),
                          borderColor: withAlpha(theme.taskBase, "3A"),
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          iconName as React.ComponentProps<
                            typeof MaterialCommunityIcons
                          >["name"]
                        }
                        size={22}
                        color={theme.taskBase}
                      />

                      <View style={styles.rowCopy}>
                        <Text
                          variant="titleSmall"
                          style={{ color: theme.text, fontWeight: "600" }}
                        >
                          {document.display.title}
                        </Text>
                        {!!document.display.subtitle && (
                          <Text variant="bodySmall" style={{ color: muted }}>
                            {document.display.subtitle}
                          </Text>
                        )}
                      </View>

                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={muted}
                      />
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.text, fontWeight: "700" }}
                >
                  Saved scopes
                </Text>

                <Button
                  compact
                  textColor={theme.taskBase}
                  onPress={() => {
                    onClose();
                    onManageScopes();
                  }}
                >
                  Manage
                </Button>
              </View>

              {!isLoaded ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  Loading saved scopes…
                </Text>
              ) : savedScopes.length === 0 ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  Save a type, category, or tag combination to reuse it here.
                </Text>
              ) : (
                savedScopes.map((scope) => (
                  <Pressable
                    key={scope.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Apply saved scope ${scope.name}`}
                    onPress={() => {
                      onApplyScope(scope);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.scopeRow,
                      {
                        borderColor: withAlpha(theme.taskBase, "40"),
                        backgroundColor: withAlpha(theme.taskBase, "08"),
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="bookmark-outline"
                      size={20}
                      color={theme.taskBase}
                    />

                    <View style={styles.rowCopy}>
                      <Text
                        variant="titleSmall"
                        numberOfLines={1}
                        style={{ color: theme.text, fontWeight: "600" }}
                      >
                        {scope.name}
                      </Text>
                      <Text
                        variant="bodySmall"
                        numberOfLines={2}
                        style={{ color: muted }}
                      >
                        {describeScope(scope)}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={muted}
                    />
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: withAlpha(theme.text, "18") },
            ]}
          >
            <Button mode="outlined" onPress={onClose}>
              Done
            </Button>
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
    height: "78%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 22,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 62,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingBottom: 20,
    alignItems: "flex-end",
  },
});
