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
import { useTasks } from "@/hooks/use-tasks";
import { useHabits } from "@/hooks/use-habits";
import { useEvents } from "@/hooks/use-events";
import { useChat } from "@/hooks/use-chat";
import { useLogs } from "@/hooks/use-logs";
import { isDate } from "date-fns";

//TODOX 105: Reset achievements, resets the achievements table in DB and in React State, but progress doesnt reset as it is maintained by app metrics , so after reseting and then performing a action that leads to any progress for achievements, the progress just continues and all resetted unlocked achievements, immediately unlock again , effectively making reseting them useless  resetting metrics with achievements doesnt make sense, maybe we need a seperate duplicate metrics for achievements progress.
//TODO 110 : add loading indicator for dark mode atleast
const DATA_SETTINGS: SettingItem[] = [
  {
    id: "deleteTasks",
    label: "Clear Task History",
    icon: "checkmark-circle-outline",
    type: "action",
  },
  {
    id: "deleteHabits",
    label: "Clear Habit History",
    icon: "bars-progress",
    type: "action",
  },
  {
    id: "deleteEvents",
    label: "Clear Event History",
    icon: "calendar-xmark",
    type: "action",
  },
  {
    id: "deleteTimerLogs",
    label: "Clear Log History",
    icon: "timer",
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
    label: "Clear All Data",
    icon: "warning-outline",
    type: "action",
    destructive: true, // This will turn the row text red!
  },
];

export default function DataManagementScreen() {
  const { theme } = useTheme();
  // We bring in the setters from your DataContext to clear the UI state instantly
  //const { setTasks, setHabits, setEvents, setTimerLogs, setMessages } = useData();-
  const { resetMetrics, resetAchievements } = useData();
  const { removeTasks, taskCount } = useTasks();
  const { removeHabits, habitCount } = useHabits();
  const { removeEvents, eventCount } = useEvents();
  const { removeLogs, logCount } = useLogs();
  const { removeMessages, messageCount } = useChat();
  // Unified Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    description: "",
    isDestructive: false,
    itemLabel: "",
    onConfirm: () => {},
    itemCount: 0,
  });

  const openModal = (
    title: string,
    description: string,
    isDestructive: boolean,
    itemLabel: string,
    onConfirm: () => void,
    itemCount?: number | undefined,
  ) => {
    const itemCountFinal = itemCount ?? 0;
    setModalConfig({
      title,
      description,
      isDestructive,
      itemLabel,
      onConfirm,
      itemCount: itemCountFinal,
    });
    setModalVisible(true);
  };

  const handlePress = async (id: string) => {
    switch (id) {
      case "deleteTasks":
        const countT = await taskCount();
        openModal(
          "Delete Tasks?",
          "This will permanently delete all your tasks. Your achievements will not be affected.",
          true,
          "tasks",
          async () => {
            await removeTasks();
            setModalVisible(false);
          },
          countT,
        );
        break;
        
      case "deleteHabits":
        const countH = await habitCount();
        openModal(
          "Delete Habits?",
          "This will permanently delete all habit tracking history and streaks.",
          true,
          "habits",
          async () => {
            await removeHabits();
            setModalVisible(false);
          },
          countH,
        );
        break;

      case "deleteEvents":
        const countE = await eventCount();
        openModal(
          "Delete Events?",
          "This will permanently delete all event tracking history.",
          true,
          "events",
          async () => {
            await removeEvents();
            setModalVisible(false);
          },
          countE,
        );
        break;

      case "deleteTimerLogs":
        const countL = await logCount();
        openModal(
          "Delete Timer Logs?",
          "This will permanently delete all timer log history.",
          true,
          "logs",
          async () => {
            await removeLogs();
            setModalVisible(false);
          },
          countL,
        );
        break;

      case "resetAchievements":
        openModal(
          "Reset Achievements?",
          "This will reset all your achievements and lock all unlocked badges.",
          false,
          "achievements",
          async () => {
            await resetAchievements();
            setModalVisible(false);
          },
        );
        break;

      case "deleteAllData":
        openModal(
          "Delete All Data?",
          "WARNING: This will wipe all tasks, habits, events and timer logs. This action cannot be undone.",
          true, // Triggers the red destructive UI
          "All_Data",
          async () => {
            await clearStorage();
            await resetMetrics();
            await resetAchievements();
            await removeTasks();
            await removeHabits();
            await removeEvents();
            await removeLogs();
            setModalVisible(false);
          },
        );
        break;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/*     <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
      > */}
      <Text style={[styles.headerText, { color: theme.text }]}>
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
        confirmText={modalConfig.isDestructive ? "Delete" : "Reset"}
        isDestructive={modalConfig.isDestructive}
        onCancel={() => setModalVisible(false)}
        onConfirm={modalConfig.onConfirm}
        itemLabel={modalConfig.itemLabel}
        itemCount={modalConfig.itemCount}
      />
      {/* </SafeAreaView> */}
    </View>
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
