import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Searchbar } from "react-native-paper";

import { SettingsGroup } from "@/components/ui/settings/settings-group";
import { SettingsRow } from "@/components/ui/settings/settings-row";
import { useSettings } from "@/context/SettingsContext";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { SettingsSection } from "@/types/settings-ui";
import SettingsSkeleton from "@/components/shared/loading-indicators/screen-loaders/settings-skeleton";
import { useSync } from "@/context/SyncContext";
import { getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";
import { AppDialog } from "@/components/shared/dialog-system/AppDialog";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";
import { SyncResolutionModal } from "@/components/shared/dialog-system/SyncResolutionDialog";
import {
  getWorkspaceSyncMode,
  useWorkspaceSyncModeStore,
} from "@/utils/Account-utils/workspace-sync-mode-store";

// This is our Configuration map. Adding a new setting is as easy as adding a line here.

const filterSettings = (
  sections: SettingsSection[],
  query: string,
): SettingsSection[] => {
  if (!query.trim()) return sections;

  const q = query.toLowerCase();

  const filteredSections = sections
    .map((section) => {
      const titleMatch = section.title.toLowerCase().includes(q);

      if (titleMatch) {
        // keep full section
        return section;
      }

      // filter matching items
      const filteredItems = section.data.filter((item) =>
        item.label.toLowerCase().includes(q),
      );

      if (filteredItems.length > 0) {
        return {
          ...section,
          data: filteredItems,
        };
      }

      return null;
    })
    .filter(Boolean);
  return filteredSections as SettingsSection[];
};

const SETTINGS_LAYOUT: SettingsSection[] = [
  {
    title: "Profile",
    data: [
      {
        id: "soundEffectsEnabled",
        label: "ADMIN Mode",
        icon: "key",
        type: "link",
      },
      {
        id: "deleteProfile",
        label: "Delete Profle",
        icon: "trash",
        type: "link",
      },
      {
        id: "manualSyncEnabled",
        label: "Sync Now",
        icon: "cloud-upload-outline",
        type: "action",
        options: [
          {
            type: "widget",
            value: "ManualSyncWidget",
          },
        ],
      },
      {
        id: "restoreRecovery",
        label: "Restore Old Data",
        icon: "restore",
        type: "action",
        options: [
          {
            type: "widget",
            value: "RestoreRecoveryWidget",
          },
        ],
      },
      {
        id: "autoCloudSync",
        label: "Auto Cloud Sync",
        icon: "cloud-sync",
        type: "toggle",
      },
    ],
  },
  {
    title: "Appearance",
    data: [
      {
        id: "isSystemTheme",
        label: "Match System Theme",
        icon: "phonelink-setup",
        type: "toggle",
      },
      { id: "isDarkMode", label: "Dark Mode", icon: "moon", type: "toggle" },
    ],
  },
  {
    title: "Sound",
    data: [
      {
        id: "hapticsEnabled",
        label: "Haptic Feedback",
        icon: "vibration",
        type: "toggle",
      },
      {
        id: "soundEffectsEnabled",
        label: "Sound Effects",
        icon: "volume-high",
        type: "toggle",
      },
    ],
  },
  {
    title: "Data Mangement",
    data: [
      {
        id: "deleteAllData",
        label: "Delete All Data",
        icon: "folder-delete",
        type: "link",
        href: "/settings/data-management",
      },
      {
        id: "editCategories",
        label: "Categories Management",
        icon: "category",
        type: "link",
        options: [
          {
            type: "widget",
            value: "CategoryWidget",
          },
        ],
        href: "/settings/category/category-settings",
      },
      {
        id: "editTags",
        label: "Tags Management",
        icon: "pricetags-sharp",
        type: "link",
        options: [
          {
            type: "widget",
            value: "TagsWidget",
          },
        ],
        href: "/settings/tags/tags-settings",
      },
      {
        id: "resetAchievements",
        label: "Reset Achievements",
        icon: "trophy",
        type: "link",
      },
      {
        id: "resetSettings",
        label: "Reset to default settings",
        icon: "settings-backup-restore",
        type: "action",
      },
    ],
  },
];

export default function SettingsScreen() {
  const { theme, isDarkMode } = useTheme();
  const { settings, updateSetting, resetSettings, isLoading } = useSettings();
  const {
    restoreFromRecovery,
    mergeRecoveryWithCloud,
    syncNow,
    setAutoSyncEnabled,
  } = useSync();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [multiDialogVisible, setMultiDialogVisible] = useState(false);
  const [filteredSections, setFilteredSections] =
    useState<SettingsSection[]>(SETTINGS_LAYOUT);

  const handleToggle = (id: string, newValue: boolean) => {
    // Type assertion is safe here because our SETTINGS_LAYOUT strictly maps to SettingsConfig keys
    if (id === "autoCloudSync") {
      setAutoSyncEnabled(newValue);
    }
    updateSetting(id as any, newValue);
  };

  const handleRestore = async () => {
    const summary = await getRecoverySnapshotSummary();
    if (!summary) return;

    await restoreFromRecovery(summary.id);
  };

  if (isLoading) {
    return <SettingsSkeleton isDark={isDarkMode} />; // Or your existing <LoadingIndicator />
  }
  const handlePress = (id: string, type: string, href?: string) => {
    if (href) {
      router.push(href as any);
    }
    if (type === "action") {
      switch (id) {
        case "resetSettings":
          setConfirmDialogVisible(true);
          break;
        case "manualSyncEnabled":
          syncNow();
          break;
        case "restoreRecovery":
          setMultiDialogVisible(true);
          break;
        default:
          break;
      }
      //resetSettings();
    }
  };

  useEffect(() => {
    setFilteredSections(filterSettings(SETTINGS_LAYOUT, searchQuery));
  }, [searchQuery]);
  const workspaceSyncMode = useWorkspaceSyncModeStore((state) => state.mode);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Searchbar
        placeholder="Search Settings"
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.greyBasePrimary }]}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { backgroundColor: theme.background },
        ]}
      >
        {filteredSections.map((section, sectionIndex) => (
          <SettingsGroup key={sectionIndex} title={section.title}>
            {section.data.map((item, itemIndex) => (
              <SettingsRow
                key={item.id}
                item={item}
                value={settings[item.id as keyof typeof settings] as any}
                onToggle={handleToggle}
                onPress={handlePress}
                isLast={itemIndex === section.data.length - 1}
              />
            ))}
          </SettingsGroup>
        ))}
      </ScrollView>
      {confirmDialogVisible && (
        <ConfirmDialog
          visible={confirmDialogVisible}
          onDismiss={() => setConfirmDialogVisible(false)}
          title="Reset Settings"
          description="Are you sure you want to reset all settings to their default values?"
          confirmText="Reset"
          confirmVariant="destructive"
          onCancel={() => setConfirmDialogVisible(false)}
          onConfirm={() => {
            resetSettings();
            setConfirmDialogVisible(false);
          }}
        />
      )}
      {multiDialogVisible &&
        workspaceSyncMode === "detached_pending_choice" && (
          <SyncResolutionModal
            visible={multiDialogVisible}
            onClose={() => setMultiDialogVisible(false)}
          />
        )}
      {multiDialogVisible &&
        (workspaceSyncMode === "synced" || workspaceSyncMode === null) && (
          <AppDialog
            visible={multiDialogVisible}
            title="Restore Old Data"
            description="Are you sure you want to restore old data? You can either merge with the current workspace or replace the entire workspace with old data."
            onDismiss={() => setMultiDialogVisible(false)}
            dismissable={false}
            actions={[
              {
                label: "Merge",
                variant: "primary",
                onPress: async () => {
                  await mergeRecoveryWithCloud();
                  setMultiDialogVisible(false);
                },
              },
              {
                label: "Replace",
                variant: "destructive",
                onPress: async () => {
                  await handleRestore();
                  setMultiDialogVisible(false);
                },
              },
              {
                label: "Cancel",
                variant: "default",
                onPress: () => {
                  setMultiDialogVisible(false);
                },
              },
            ]}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    marginHorizontal: 16,
    marginVertical: 16,
    marginTop: 24,
  },
  content: {
    marginTop: 20,
    paddingBottom: 40,
  },
});
