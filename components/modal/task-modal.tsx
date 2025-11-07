import React from "react";
import { View, Text, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Button,
  Modal,
  TextInput,
  SegmentedButtons,
  Switch,
} from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  setTitle: (s: string) => void;
  description: string;
  setDescription: (s: string) => void;
  priority: "low" | "medium" | "high";
  setPriority: (v: "low" | "medium" | "high") => void;
  dueDate?: Date;
  showDatePicker: boolean;
  setShowDatePicker: (b: boolean) => void;
  onDateChange: (event: any, selected?: Date) => void;
  reminder: boolean;
  setReminder: (b: boolean) => void;
  reminderDate?: Date;
  showTimePicker: boolean;
  setShowTimePicker: (b: boolean) => void;
  onTimeChange: (event: any, selected?: Date) => void;
  handleSave: () => void;
}

export default function TaskModal({
  visible,
  onDismiss,
  title,
  setTitle,
  description,
  setDescription,
  priority,
  setPriority,
  dueDate,
  showDatePicker,
  setShowDatePicker,
  onDateChange,
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
        mode="outlined"
        label="Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        mode="outlined"
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <SegmentedButtons
        value={priority}
        onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}
        buttons={[
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
        style={{ marginVertical: 8 }}
      />
      <Button
        mode="elevated"
        style={{ marginVertical: 2.5 }}
        onPress={() => setShowDatePicker(true)}
      >
        Pick Due Date
      </Button>
      {dueDate && (
        <Text
          style={{ alignSelf: "center", marginVertical: 2.5, fontSize: 20 , color:"#c7b6f1ff" }}
        >
          {dueDate.toDateString()}
        </Text>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
      <View style={styles.switchContainer}>
        <Text style={styles.text}>Set Reminder</Text>
        <Switch
          value={reminder}
          thumbColor="#c7b6f1ff"
          trackColor={{ false: "#ffffff", true: "#7957b383" }}
          onValueChange={(val) => {
            setReminder(val);
          }}
        />
        {reminder && (
          <>
            <Button
              mode="elevated"
              buttonColor="#2F2C37"
              textColor="#887CA6"
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
        mode="elevated"
        style={{ marginVertical: 2.5 }}
        onPress={handleSave}
      >
        Save
      </Button>
      <Button
        mode="elevated"
        style={{ marginVertical: 2.5 }}
        onPress={onDismiss}
      >
        Cancel
      </Button>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: "#2d2a30ff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 5,
  },
  text: { color: "#c7b6f1ff", marginLeft: 10 },
});
