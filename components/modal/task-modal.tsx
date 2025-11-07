import React, { useState } from "react";
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
  state: any;
  updateField: (
    field:
      | "title"
      | "description"
      | "priority"
      | "dueDate"
      | "reminder"
      | "reminderDate"
      | "category"
      | "tags"
      | "errors",
    value: any
  ) => void;
  onSubmit: () => Promise<void> | void;
}

export default function TaskModal({
  visible,
  onDismiss,
  state,
  updateField,
  onSubmit,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) updateField("dueDate", selectedDate);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) updateField("reminderDate", selectedDate);
  };
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modal}
    >
      <TextInput
        mode="outlined"
        label="Title"
        value={state.title}
        onChangeText={(text) => updateField("title", text)}
      />
      <TextInput
        mode="outlined"
        label="Description"
        value={state.description}
        onChangeText={(text) => updateField("description", text)}
        multiline
      />
      <SegmentedButtons
        value={state.priority}
        onValueChange={(v) =>
          updateField("priority", v as "low" | "medium" | "high")
        }
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
      {state.dueDate && (
        <Text
          style={{
            alignSelf: "center",
            marginVertical: 2.5,
            fontSize: 20,
            color: "#c7b6f1ff",
          }}
        >
          {state.dueDate.toDateString()}
        </Text>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={state.dueDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
      <View style={styles.switchContainer}>
        <Text style={styles.text}>Set Reminder</Text>
        <Switch
          value={state.reminder}
          thumbColor="#c7b6f1ff"
          trackColor={{ false: "#ffffff", true: "#7957b383" }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
        {state.reminder && (
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
              {state.reminderDate?.toLocaleTimeString()}
            </Text>
            {showTimePicker && (
              <DateTimePicker
                value={state.reminderDate || new Date()}
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
        onPress={onSubmit}
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
