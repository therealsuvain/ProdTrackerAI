import { useSync } from "@/context/SyncContext";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import React, { useState } from "react";
import { Button, Modal, Text, Switch, View, StyleSheet } from "react-native";

export type NotificationRescheduleChoice = {
  tasks: boolean;
  habits: boolean;
  events: boolean;
};

export default function NotificationRescheduleModal() {
  const {
    showNotificationPrompt,
    notificationPromptData,
    dismissNotificationPrompt,
    submitNotificationReschedule,
  } = useSync();
  const { theme } = useTheme();

  const [choice, setChoice] = useState<NotificationRescheduleChoice>({
    tasks: true,
    habits: true,
    events: true,
  });
  if (!notificationPromptData) return null;
  return (
    <Modal
      visible={showNotificationPrompt}
      onRequestClose={dismissNotificationPrompt}
      transparent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Reschedule reminders?
          </Text>
          <Text style={[styles.description, { color: theme.text }]}>
            Choose which reminders to reschedule on this device. Notification
            settings are per-device and don't sync automatically.
          </Text>
          <View style={styles.switchContainer}>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLable, { color: theme.text }]}>
                Tasks
              </Text>
              <Switch
                value={choice.tasks}
                onValueChange={(v) => setChoice((c) => ({ ...c, tasks: v }))}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLable, { color: theme.text }]}>
                Habits
              </Text>
              <Switch
                value={choice.habits}
                onValueChange={(v) => setChoice((c) => ({ ...c, habits: v }))}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLable, { color: theme.text }]}>
                Events
              </Text>
              <Switch
                value={choice.events}
                onValueChange={(v) => setChoice((c) => ({ ...c, events: v }))}
              />
            </View>
          </View>

          <Button
            title="Reschedule selected"
            onPress={() => submitNotificationReschedule(choice)}
          />
          <Button title="Skip for now" onPress={dismissNotificationPrompt} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: "#1c1b19",
    borderRadius: 20,
    padding: 20,
    maxHeight: "50%",
    width: "90%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  description: {
    marginTop: 8,
  },
  switchLable: {
    marginRight: 8,
  },
  switchContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    marginTop: 16,
    borderRadius: 10,
  },
});
