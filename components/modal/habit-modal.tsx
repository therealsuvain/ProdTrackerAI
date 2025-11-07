import React, { useState, forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View, Text } from "react-native";
import {
  Button,
  Modal,
  SegmentedButtons,
  Switch,
  TextInput,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";


interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  setTitle: (s: string) => void;
  frequency: "daily" | "weekly";
  setFrequency: (v: "daily" | "weekly") => void;
  goal: string;
  setGoal: (s: string) => void;
  reminder: boolean;
  setReminder: (b: boolean) => void;
  reminderDate?: Date;
  showTimePicker: boolean;
  setShowTimePicker: (b: boolean) => void;
  onTimeChange: (event: any, selected?: Date) => void;
  handleSave: () => Promise<void> | void;
}

export default function HabitModal({
  visible,
  onDismiss,
  title,
  setTitle,
  frequency,
  setFrequency,
  goal,
  setGoal,
  reminder,
  setReminder,
  reminderDate,
  showTimePicker,
  setShowTimePicker,
  onTimeChange,
  handleSave,
}: Props) {
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modal}
    >
      <TextInput
        style={{ marginVertical: 2.5 }}
        label="Habit Name"
        mode="outlined"
        activeOutlineColor="#f1b718ff"
        value={title}
        onChangeText={setTitle}
      />

      <SegmentedButtons
        style={{ marginVertical: 2.5 }}
        value={frequency}
        onValueChange={(val) => setFrequency(val as "daily" | "weekly")}
        buttons={[
          {
            value: "daily",
            label: "Daily",
            checkedColor: "#f1b718ff",
            style: { backgroundColor: "#423205ff" },
          },
          {
            value: "weekly",
            label: "Weekly",
            checkedColor: "#f1b718ff",
            style: { backgroundColor: "#423205ff" },
          },
        ]}
      />
      <TextInput
        style={{ marginVertical: 2.5 }}
        label="Goal"
        mode="outlined"
        activeOutlineColor="#f1b718ff"
        value={goal}
        onChangeText={setGoal}
        keyboardType="numeric"
      />
      <View style={styles.switchContainer}>
        <Text style={styles.text}>Set Reminder</Text>
        <Switch
          value={reminder}
          thumbColor="#f1b718ff"
          trackColor={{ false: "#ffffff", true: "#f1b7187a" }}
          onValueChange={(val) => {
            setReminder(val);
          }}
        />
        {reminder && (
          <>
            <Button
              mode="elevated"
              buttonColor="#503c06ff"
              textColor="#f1b718ff"
              style={{ marginVertical: 2.5 }}
              onPress={() => setShowTimePicker(true)}
            >
              Pick Time
            </Button>

            <Text style={styles.text}>
              {reminderDate?.toLocaleTimeString()}
            </Text>
            {showTimePicker && (
              <DateTimePicker
                value={reminderDate || new Date()}
                mode="time"
                onChange={onTimeChange}
              />
            )}
          </>
        )}
      </View>
      <Button
        style={{ marginVertical: 2.5 }}
        mode="elevated"
        buttonColor="#503c06ff"
        textColor="#f1b718ff"
        onPress={handleSave}
      >
        Save
      </Button>
      <Button
        style={{ marginVertical: 2.5 }}
        mode="elevated"
        buttonColor="#503c06ff"
        textColor="#f1b718ff"
        onPress={onDismiss}
      >
        Cancel
      </Button>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: "#3b3525ff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2b2001ff",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 5,
  },
  text: { color: "#f1b718ff", marginLeft: 10 },
});
