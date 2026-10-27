import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import { useContext } from "react";

import type { GlobalSearchFilters } from "@/types/global-search";
import type { SavedGlobalSearchScope } from "@/types/global-search-convenience";

interface Props {
  visible: boolean;
  scopes: readonly SavedGlobalSearchScope[];
  currentFilters: GlobalSearchFilters;
  canSaveCurrentFilters: boolean;

  onClose: () => void;
  onSaveScope: (name: string) => Promise<string | null>;
  onApplyScope: (scope: SavedGlobalSearchScope) => void;
  onRenameScope: (scope: SavedGlobalSearchScope, name: string) => Promise<void>;
  onUpdateScopeFilters: (scope: SavedGlobalSearchScope) => Promise<void>;
  onDeleteScope: (id: string) => Promise<void>;
  onClearScopes: () => Promise<void>;
}

function describeScope(filters: GlobalSearchFilters): string {
  const type = filters.type === "all" ? "Everything" : filters.type;
  const categories = filters.categoryIds.length;
  const tags = filters.tagIds.length;

  const parts = [type];

  if (categories > 0) {
    parts.push(`${categories} categor${categories === 1 ? "y" : "ies"}`);
  }

  if (tags > 0) {
    parts.push(`${tags} tag${tags === 1 ? "" : "s"}`);
    parts.push(filters.tagMatchMode === "all" ? "Match all" : "Match any");
  }

  return parts.join(" · ");
}

export function GlobalSearchSavedScopesModal({
  visible,
  scopes,
  currentFilters,
  canSaveCurrentFilters,
  onClose,
  onSaveScope,
  onApplyScope,
  onRenameScope,
  onUpdateScopeFilters,
  onDeleteScope,
  onClearScopes,
}: Props) {
  const { theme } = useContext(ThemeContext);

  const [newScopeName, setNewScopeName] = useState("");
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSave = async () => {
    const name = newScopeName.trim();

    if (!name) {
      setErrorMessage("Enter a name for this scope.");
      return;
    }

    const id = await onSaveScope(name);

    if (!id) {
      setErrorMessage(
        "Couldn't save this scope. Check the name or scope limit.",
      );
      return;
    }

    setNewScopeName("");
    setErrorMessage("");
  };

  const handleRename = async (scope: SavedGlobalSearchScope) => {
    const name = editingName.trim();

    if (!name) {
      setErrorMessage("Enter a name for this scope.");
      return;
    }

    await onRenameScope(scope, name);
    setEditingScopeId(null);
    setEditingName("");
    setErrorMessage("");
  };

  const confirmUpdate = (scope: SavedGlobalSearchScope) => {
    Alert.alert(
      "Update saved scope?",
      `Replace "${scope.name}" with your currently selected filters?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: () => {
            void onUpdateScopeFilters(scope);
          },
        },
      ],
    );
  };

  const confirmDelete = (scope: SavedGlobalSearchScope) => {
    Alert.alert(
      "Delete saved scope?",
      `"${scope.name}" will be removed from Saved Scopes.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void onDeleteScope(scope.id);
          },
        },
      ],
    );
  };

  const confirmClearAll = () => {
    Alert.alert(
      "Clear saved scopes?",
      "All saved search scopes will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void onClearScopes();
          },
        },
      ],
    );
  };

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
          accessibilityLabel="Close saved scopes"
        />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text
                variant="titleLarge"
                style={{ color: theme.text, fontWeight: "700" }}
              >
                Saved scopes
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: withAlpha(theme.text, "A8") }}
              >
                Save useful filter combinations for quick reuse.
              </Text>
            </View>

            <IconButton
              icon="close"
              iconColor={theme.text}
              onPress={onClose}
              accessibilityLabel="Close saved scopes"
            />
          </View>

          <View style={styles.saveArea}>
            <TextInput
              value={newScopeName}
              onChangeText={(value) => {
                setNewScopeName(value);
                setErrorMessage("");
              }}
              placeholder="Name this scope"
              placeholderTextColor={withAlpha(theme.text, "80")}
              style={[
                styles.nameInput,
                {
                  color: theme.text,
                  borderColor: withAlpha(theme.text, "28"),
                },
              ]}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel="New saved scope name"
            />

            <Button
              mode="contained"
              onPress={handleSave}
              disabled={!canSaveCurrentFilters || !newScopeName.trim()}
              buttonColor={theme.taskBase}
              textColor={theme.whiteBase}
            >
              Save current filters
            </Button>

            {!canSaveCurrentFilters && (
              <Text
                variant="bodySmall"
                style={{ color: withAlpha(theme.text, "80") }}
              >
                Select a type, category, or tag filter first.
              </Text>
            )}

            {!!errorMessage && (
              <Text variant="bodySmall" style={{ color: theme.eventBase }}>
                {errorMessage}
              </Text>
            )}
          </View>

          <View style={styles.listHeader}>
            <Text
              variant="titleMedium"
              style={{ color: theme.text, fontWeight: "700" }}
            >
              Your scopes ({scopes.length})
            </Text>

            {scopes.length > 0 && (
              <Button
                compact
                textColor={theme.eventBase}
                onPress={confirmClearAll}
              >
                Clear all
              </Button>
            )}
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {scopes.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons
                  name="bookmark-outline"
                  size={34}
                  color={withAlpha(theme.text, "70")}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: withAlpha(theme.text, "A8"),
                    textAlign: "center",
                  }}
                >
                  No saved scopes yet.
                </Text>
              </View>
            ) : (
              scopes.map((scope) => {
                const isEditing = editingScopeId === scope.id;

                return (
                  <View
                    key={scope.id}
                    style={[
                      styles.scopeCard,
                      {
                        borderColor: withAlpha(theme.text, "16"),
                        backgroundColor: withAlpha(theme.text, "05"),
                      },
                    ]}
                  >
                    {isEditing ? (
                      <TextInput
                        autoFocus
                        value={editingName}
                        onChangeText={setEditingName}
                        maxLength={60}
                        style={[
                          styles.nameInput,
                          {
                            color: theme.text,
                            borderColor: withAlpha(theme.text, "28"),
                          },
                        ]}
                        accessibilityLabel={`Rename ${scope.name}`}
                      />
                    ) : (
                      <Text
                        variant="titleSmall"
                        style={{ color: theme.text, fontWeight: "700" }}
                      >
                        {scope.name}
                      </Text>
                    )}

                    <Text
                      variant="bodySmall"
                      style={{
                        color: withAlpha(theme.text, "A8"),
                        marginTop: 3,
                      }}
                    >
                      {describeScope(scope.filters)}
                    </Text>

                    <View style={styles.scopeActions}>
                      {isEditing ? (
                        <>
                          <Button
                            compact
                            onPress={() => void handleRename(scope)}
                          >
                            Save name
                          </Button>
                          <Button
                            compact
                            onPress={() => {
                              setEditingScopeId(null);
                              setEditingName("");
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            compact
                            mode="contained"
                            buttonColor={theme.taskBase}
                            textColor={theme.whiteBase}
                            onPress={() => {
                              onApplyScope(scope);
                              onClose();
                            }}
                          >
                            Apply
                          </Button>

                          <Button compact onPress={() => confirmUpdate(scope)}>
                            Update filters
                          </Button>

                          <IconButton
                            icon="pencil-outline"
                            size={18}
                            iconColor={theme.text}
                            onPress={() => {
                              setEditingScopeId(scope.id);
                              setEditingName(scope.name);
                              setErrorMessage("");
                            }}
                            accessibilityLabel={`Rename ${scope.name}`}
                          />

                          <IconButton
                            icon="delete-outline"
                            size={18}
                            iconColor={theme.eventBase}
                            onPress={() => confirmDelete(scope)}
                            accessibilityLabel={`Delete ${scope.name}`}
                          />
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
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
    height: "85%",
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
  saveArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 45,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  scopeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  scopeActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
    marginTop: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingBottom: 20,
    alignItems: "flex-end",
  },
});
