import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Searchbar } from "react-native-paper";

import { SettingsGroup } from "@/components/ui/settings/settings-group";
import { SettingsRow } from "@/components/ui/settings/settings-row";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import {
  SettingItem,
  SETTINGS_LAYOUT,
  SettingsSection,
} from "@/types/settings-ui";
import SettingsSkeleton from "@/components/shared/loading-indicators/screen-loaders/settings-skeleton";
import { useSync } from "@/context/SyncContext";
import { getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";
import { AppDialog } from "@/components/shared/dialog-system/AppDialog";
import { ConfirmDialog } from "@/components/shared/dialog-system/ConfirmDialog";
import { SyncResolutionModal } from "@/components/shared/dialog-system/SyncResolutionDialog";
import { useWorkspaceSyncModeStore } from "@/utils/Account-utils/workspace-sync-mode-store";
import {
  resetSettingsWithEffects,
  updateSettingWithEffects,
} from "@/utils/Data-services/settings-services/settings-actions";
import { useSettingsStore } from "@/stores/use-settings-store";
import {
  GlobalSearchFocusHighlight,
  type GlobalSearchFocusHighlightRequest,
} from "@/components/ui/global-search/global-search-focus-highlight";
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

export default function SettingsScreen() {
  const { theme, preference, toggleTheme, setThemeToSystemTheme } = useTheme();
  const settings = useSettingsStore((state) => state.settings);
  const {
    restoreFromRecovery,
    mergeRecoveryWithCloud,
    syncNow,
    setAutoSyncEnabled,
  } = useSync();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [multiDialogVisible, setMultiDialogVisible] = useState(false);
  const handledSettingsFocusRequest = useRef<string | null>(null);
  const [filteredSections, setFilteredSections] =
    useState<SettingsSection[]>(SETTINGS_LAYOUT);
  const { focusSettingId, focusRequestId } = useLocalSearchParams<{
    focusSettingId?: string;
    focusRequestId?: string;
  }>();
  const [pendingScrollId, setPendingScrollId] = useState<SettingItem | null>(
    null,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const settingsContentRef = useRef<View>(null);

  const settingRowRefs = useRef<Record<string, View | null>>({});
  const pendingSettingHighlight =
    useRef<GlobalSearchFocusHighlightRequest | null>(null);

  const [highlightedSetting, setHighlightedSetting] =
    useState<GlobalSearchFocusHighlightRequest | null>(null);

  const settingPositions = useRef<
    Record<string, { y: number; height: number }>
  >({});

  const settingsScrollY = useRef(0);
  const settingsViewportHeight = useRef(0);

  const maybeHighlightVisibleSetting = useCallback(() => {
    const pending = pendingSettingHighlight.current;
    if (!pending) return;

    const position = settingPositions.current[pending.id];
    const viewportHeight = settingsViewportHeight.current;

    if (!position || viewportHeight <= 0) return;

    const viewportTop = settingsScrollY.current;
    const viewportBottom = viewportTop + viewportHeight;

    const isVisible =
      position.y + position.height > viewportTop && position.y < viewportBottom;

    if (!isVisible) return;

    pendingSettingHighlight.current = null;
    setHighlightedSetting(pending);
  }, []);

  const handleToggle = (id: string, newValue: boolean) => {
    // Type assertion is safe here because our SETTINGS_LAYOUT strictly maps to SettingsConfig keys
    if (id === "autoCloudSync") {
      setAutoSyncEnabled(newValue);
    }
    if (id === "isDarkMode") {
      toggleTheme();
    }
    if (id === "isSystemTheme") {
      setThemeToSystemTheme();
    }
    updateSettingWithEffects(id as any, newValue);
  };

  const handleRestore = async () => {
    const summary = await getRecoverySnapshotSummary();
    if (!summary) return;

    await restoreFromRecovery(summary.id);
  };

  /*   if (isLoading) {
    return <SettingsSkeleton isDark={isDarkMode} />; // Or your existing <LoadingIndicator />
  } */
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
  const visibleItems = (items: SettingItem[]) =>
    preference === "system"
      ? items.filter((i) => i.id !== "isDarkMode")
      : items;

  useEffect(() => {
    setFilteredSections(filterSettings(SETTINGS_LAYOUT, searchQuery));
  }, [searchQuery]);
  const workspaceSyncMode = useWorkspaceSyncModeStore((state) => state.mode);

  /* const scrollToSetting = useCallback((setting: SettingItem): boolean => {
    if (setting.href) {
      router.push(setting.href as any);
      return true;
    } // Approximate Y position based on section index
    const index = SETTINGS_LAYOUT.map((section) => section.data)
      .flat()
      .map((item) => item.id)
      .indexOf(setting.id);
    const parentIndex = SETTINGS_LAYOUT.indexOf(
      SETTINGS_LAYOUT.find((section) => section.data.includes(setting))!,
    );
    const itemIndex = SETTINGS_LAYOUT[parentIndex].data.indexOf(setting);
    //const targetY = parentIndex * 100 + itemIndex * 60; // Adjust these multipliers based on your layout
    //console.log(index, "index");
    const targetY = index * 50; // Adjust this multiplier based on your layout

    // IMPORTANT: Check for undefined, NOT !targetY (because the 1st item has y === 0!)
    if (targetY === undefined || !scrollViewRef.current) {
      return false;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetY - 20),
        animated: true,
      });
    });

    return true;
  }, []); */

  const scrollToSetting = useCallback(
    (setting: SettingItem): boolean => {
      // Preserve existing behavior for settings with their own destination.
      if (setting.href) {
        router.push(setting.href as any);
        return true;
      }

      const row = settingRowRefs.current[setting.id];
      const content = settingsContentRef.current;

      if (!row || !content || !scrollViewRef.current) {
        return false;
      }

      row.measureLayout(
        content,
        (_x, y, width, height) => {
          settingPositions.current[setting.id] = { y, height };

          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - 20),
            animated: true,
          });

          // Clear the request only after the measurement succeeds.
          setPendingScrollId((current) =>
            current?.id === setting.id ? null : current,
          );
          requestAnimationFrame(maybeHighlightVisibleSetting);
        },
        () => {
          // Leave the target pending if measurement fails.
          // The layout can be measured again after a subsequent render.
        },
      );

      return true;
    },
    [router],
  );

  useEffect(() => {
    if (
      !focusSettingId ||
      !focusRequestId ||
      handledSettingsFocusRequest.current === focusRequestId
    ) {
      return;
    }

    const setting = SETTINGS_LAYOUT.flatMap((section) => section.data).find(
      (item) => item.id === focusSettingId,
    );

    if (!setting) return;

    handledSettingsFocusRequest.current = focusRequestId;

    // Clear any Settings screen search filter so the target row is rendered.
    setSearchQuery("");

    if (setting.href) {
      // Settings with their own destination navigate normally.
      router.setParams({
        focusSettingId: undefined,
        focusRequestId: undefined,
      });

      router.push(setting.href as any);
      return;
    }

    // The pending-target effect below handles the actual scroll.
    setPendingScrollId(setting);
    pendingSettingHighlight.current = {
      id: setting.id,
      requestId: focusRequestId,
    };
    router.setParams({
      focusSettingId: undefined,
      focusRequestId: undefined,
    });
  }, [focusSettingId, focusRequestId, router]);

  useEffect(() => {
    if (!pendingScrollId) return;

    scrollToSetting(pendingScrollId);
  }, [pendingScrollId, scrollToSetting]);

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
        ref={scrollViewRef}
        scrollEventThrottle={16}
        onScroll={(event) => {
          settingsScrollY.current = event.nativeEvent.contentOffset.y;
          maybeHighlightVisibleSetting();
        }}
        onLayout={(event) => {
          settingsViewportHeight.current = event.nativeEvent.layout.height;
          maybeHighlightVisibleSetting();
        }}
      >
        <View ref={settingsContentRef} collapsable={false}>
          {filteredSections.map((section, sectionIndex) => (
            <SettingsGroup key={sectionIndex} title={section.title}>
              {visibleItems(section.data).map((item, itemIndex, arr) => (
                <View
                  key={item.id}
                  ref={(node) => {
                    settingRowRefs.current[item.id] = node;
                  }}
                  collapsable={false}
                >
                  <GlobalSearchFocusHighlight
                    request={
                      highlightedSetting?.id === item.id
                        ? highlightedSetting
                        : null
                    }
                    accentColor={"white"}
                    borderRadius={10}
                  >
                    <SettingsRow
                      key={item.id}
                      item={item}
                      value={settings[item.id as keyof typeof settings] as any}
                      onToggle={handleToggle}
                      onPress={handlePress}
                      isLast={itemIndex === arr.length - 1}
                    />
                  </GlobalSearchFocusHighlight>
                </View>
              ))}
            </SettingsGroup>
          ))}
        </View>
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
            resetSettingsWithEffects();
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
