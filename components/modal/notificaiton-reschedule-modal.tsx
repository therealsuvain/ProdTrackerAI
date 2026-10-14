import { useSync } from "@/context/SyncContext";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import React, { useState } from "react";
import {
  Button,
  Modal,
  Text,
  Switch,
  View,
  StyleSheet,
  Pressable,
} from "react-native";

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
                thumbColor={theme.taskBase}
                trackColor={{
                  false: theme.whiteBase,
                  true: theme.taskBaseTrans,
                }}
                style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
                onValueChange={(v) => setChoice((c) => ({ ...c, tasks: v }))}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLable, { color: theme.text }]}>
                Habits
              </Text>
              <Switch
                value={choice.habits}
                thumbColor={theme.habitBase}
                trackColor={{
                  false: theme.whiteBase,
                  true: theme.habitBaseTrans,
                }}
                style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
                onValueChange={(v) => setChoice((c) => ({ ...c, habits: v }))}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLable, { color: theme.text }]}>
                Events
              </Text>
              <Switch
                value={choice.events}
                thumbColor={theme.eventBase}
                trackColor={{
                  false: theme.whiteBase,
                  true: theme.eventBaseTrans,
                }}
                style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
                onValueChange={(v) => setChoice((c) => ({ ...c, events: v }))}
              />
            </View>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Pressable
              style={styles.button}
              onPress={() => submitNotificationReschedule(choice)}
            >
              <Text style={[styles.buttonText]}>Reschedule selected</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={dismissNotificationPrompt}
            >
              <Text style={[styles.buttonText]}>Skip for now</Text>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: "#1c1b19a9",
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
    fontSize: 20,
  },
  switchContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    alignSelf: "center",
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 0.375,
    borderColor: "white",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
});
