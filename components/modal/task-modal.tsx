import React, { useContext, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Button,
  Modal,
  TextInput,
  SegmentedButtons,
  Switch,
} from "react-native-paper";
import { ThemeContext } from "@/context/ThemeContext";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  state: any;
  updateField: (field: any, value: any) => void;
  onSubmit: () => Promise<void> | void;
}

export default function TaskModal({
  visible,
  onDismiss,
  state,
  updateField,
  onSubmit,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      updateField("dueDate", selectedDate.toISOString());
      setDueDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);

    if (selectedDate)
      updateField(
        "reminderDate",
        dueDate.toISOString().split("T")[0] +
          "T" +
          selectedDate.toISOString().split("T")[1],
      );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        {
          backgroundColor: theme.taskDarkPrimary,
          borderColor: theme.taskDarkSecondary,
        },
      ]}
    >
      <TextInput
        mode="outlined"
        label="Title"
        defaultValue={state.title}
        onChangeText={(text) => updateField("title", text)}
        textColor={theme.text}
        style={{ backgroundColor: theme.background }}
        theme={{
          colors: {
            //primary: theme.text, // Color when focused
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
      />
      {state.errors?.title && (
        <Text style={[styles.error, { color: theme.error }]}>
          {state.errors.title}
        </Text>
      )}
      <TextInput
        mode="outlined"
        label="Description"
        defaultValue={state.description}
        onChangeText={(text) => updateField("description", text)}
        textColor={theme.text}
        style={{ backgroundColor: theme.background }}
        theme={{
          colors: {
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
        multiline
      />
      <SegmentedButtons
        value={state.priority}
        onValueChange={(v) =>
          updateField("priority", v as "low" | "medium" | "high")
        }
        buttons={[
          {
            value: "low",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.taskBase,
            style: { backgroundColor: theme.taskDarkSecondary },
            label: "Low",
          },
          {
            value: "medium",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.taskBase,
            style: { backgroundColor: theme.taskDarkSecondary },
            label: "Medium",
          },
          {
            value: "high",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.taskBase,
            style: { backgroundColor: theme.taskDarkSecondary },
            label: "High",
          },
        ]}
        style={{ marginVertical: 8 }}
      />
      <Button
        mode="elevated"
        textColor={theme.taskLightPrimary}
        style={[
          styles.verticalMargin,
          { backgroundColor: theme.taskDarkSecondary },
        ]}
        onPress={() => setShowDatePicker(true)}
      >
        Pick Due Date
      </Button>
      {state.dueDate && (
        <Text style={[styles.date, { color: theme.taskDarkSecondary }]}>
          {new Date(state.dueDate).toDateString()}
        </Text>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={new Date(state.dueDate) || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
      <View style={styles.switchContainer}>
        <Text style={[styles.text, { color: theme.taskDarkSecondary }]}>
          Set Reminder
        </Text>
        <Switch
          value={state.reminder}
          thumbColor={theme.taskLightPrimary}
          trackColor={{ false: theme.whiteBase, true: theme.taskDarkSecondary }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
        {state.reminder && (
          <>
            <Button
              mode="elevated"
              textColor={theme.taskLightPrimary}
              style={[
                styles.verticalMargin,
                { backgroundColor: theme.taskDarkSecondary },
              ]}
              onPress={() => setShowTimePicker(true)}
            >
              Pick Time
            </Button>

            <Text style={[styles.text, { color: theme.taskLightPrimary }]}>
              {state.reminderDate &&
                new Date(state.reminderDate).toLocaleTimeString()}
            </Text>
            {state.errors?.reminderDate && (
              <Text style={[styles.error, { color: theme.error }]}>
                {state.errors.reminderDate}
              </Text>
            )}
            {showTimePicker && (
              <DateTimePicker
                value={
                  (state.reminderDate && new Date(state.reminderDate)) ||
                  new Date()
                }
                mode="time"
                onChange={onTimeChange}
              />
            )}
          </>
        )}
      </View>
      <Button
        mode="elevated"
        textColor={theme.taskLightPrimary}
        style={[
          styles.verticalMargin,
          { backgroundColor: theme.taskDarkSecondary },
        ]}
        onPress={onSubmit}
      >
        Save
      </Button>
      <Button
        mode="elevated"
        textColor={theme.taskLightPrimary}
        style={[
          styles.verticalMargin,
          { backgroundColor: theme.taskDarkSecondary },
        ]}
        onPress={onDismiss}
      >
        Cancel
      </Button>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    marginHorizontal: 5,
  },
  date: {
    alignSelf: "center",
    marginVertical: 2.5,
    fontSize: 20,
  },
  error: { fontSize: 12 },
  text: { marginLeft: 10 },
  verticalMargin: { marginVertical: 2.5 },
});
