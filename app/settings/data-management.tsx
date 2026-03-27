import React, { useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/use-theme-colors";
import { SettingsGroup } from "@/components/ui/settings/settings-group";
import { SettingsRow } from "@/components/ui/settings/settings-row";
import { SettingItem } from "@/types/settings-ui";
import { ConfirmationModal } from "@/components/modal/confirmation-modal";
import { useData } from "@/hooks/use-data";
import { clearStorage } from "@/utils/storage-utils"; // Make sure clearStorage is exported

const DATA_SETTINGS: SettingItem[] = [
  {
    id: "deleteTasks",
    label: "Delete Task History",
    icon: "checkmark-circle-outline",
    type: "action",
  },
  {
    id: "deleteHabits",
    label: "Delete Habit History",
    icon: "leaf-outline",
    type: "action",
  },
  {
    id: "resetAchievements",
    label: "Reset Achievements",
    icon: "trophy-outline",
    type: "action",
  },
  {
    id: "deleteAllData",
    label: "Delete All Data",
    icon: "warning-outline",
    type: "action",
    destructive: true, // This will turn the row text red!
  },
];

export default function DataManagementScreen() {
  const { theme } = useTheme();
  // We bring in the setters from your DataContext to clear the UI state instantly
  const { setTasks, setHabits, setEvents, setTimerLogs, setMessages } = useData();

  // Unified Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    description: "",
    isDestructive: false,
    onConfirm: () => {},
  });

  const openModal = (
    title: string,
    description: string,
    isDestructive: boolean,
    onConfirm: () => void
  ) => {
    setModalConfig({ title, description, isDestructive, onConfirm });
    setModalVisible(true);
  };

  const handlePress = (id: string) => {
    switch (id) {
      case "deleteTasks":
        openModal(
          "Delete Tasks?",
          "This will permanently delete all your tasks. Your achievements will not be affected.",
          false,
          () => {
            setTasks([]); // Clears from UI (your DataContext useEffect will sync this to storage)
            setModalVisible(false);
          }
        );
        break;
      case "deleteHabits":
        openModal(
          "Delete Habits?",
          "This will permanently delete all habit tracking history and streaks.",
          false,
          () => {
            setHabits([]);
            setModalVisible(false);
          }
        );
        break;
      case "deleteAllData":
        openModal(
          "Delete All Data?",
          "WARNING: This will wipe all tasks, habits, events and timer logs. This action cannot be undone.",
          true, // Triggers the red destructive UI
          async () => {
            await clearStorage();
            // Reset all in-memory state
            setTasks([]);
            setHabits([]);
            setEvents([]);
            setTimerLogs([]);
           // setMessages([]);
            setModalVisible(false);
          }
        );
        break;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.headerText, { color: theme.text}]}>
        Manage how your local data is stored on this device.
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingsGroup title="Local Storage">
          {DATA_SETTINGS.map((item, index) => (
            <SettingsRow
              key={item.id}
              item={item}
              isLast={index === DATA_SETTINGS.length - 1}
              onPress={handlePress}
            />
          ))}
        </SettingsGroup>
      </ScrollView>

      <ConfirmationModal
        visible={modalVisible}
        title={modalConfig.title}
        description={modalConfig.description}
        isDestructive={modalConfig.isDestructive}
        onCancel={() => setModalVisible(false)}
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.isDestructive ? "Delete" : "Confirm"}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerText: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    paddingBottom: 40,
  },
});