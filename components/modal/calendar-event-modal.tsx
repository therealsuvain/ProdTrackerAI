import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Modal,
  TextInput,
  Button,
  SegmentedButtons,
  Switch,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  state: any;
  updateField: (
    field:
      | "title"
      | "startDate"
      | "endDate"
      | "startTime"
      | "endTime"
      | "description"
      | "reminder"
      | "recurrence"
      | "category"
      | "errors",
    value: any
  ) => void;
  onSubmit: () => Promise<void> | void;
}

export default function CalendarEventModal({
  visible,
  onDismiss,
  state,
  updateField,
  onSubmit,
}: Props) {
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showAndroidStartTimePicker, setShowAndroidStartTimerPicker] =
    useState(false);
  const [showAndroidEndTimePicker, setShowAndroidEndTimerPicker] =
    useState(false);
  const [androidDate, setAndroidDate] = useState<Date>();

  const onStartChange = (event: any, selected?: Date) => {
    setShowStartPicker(false);
    setAndroidDate(selected);
    console.log(selected);
    console.log(new Date(selected ? selected.toLocaleString() : ""));
    if (selected) updateField("startDate", selected);
  };

  const onStartTimeChangeAndroid = (event: any, selected?: Date) => {
    setShowAndroidStartTimerPicker(false);
    let varTime;
    console.log(selected);
    if (selected)
      varTime =
        androidDate?.toISOString().split("T")[0] +
        "T" +
        selected.toISOString().split("T")[1];
    updateField("startTime", new Date(varTime!));
  };
  const onEndChange = (event: any, selected?: Date) => {
    setShowEndPicker(false);
    setAndroidDate(selected);
    if (selected) updateField("endDate", selected);
  };

  const onEndTimeChangeAndroid = (event: any, selected?: Date) => {
    setShowAndroidEndTimerPicker(false);
    let varTime;
    if (selected)
      varTime =
        androidDate?.toISOString().split("T")[0] +
        "T" +
        selected.toISOString().split("T")[1];
    updateField("endTime", new Date(varTime!));
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={styles.modal}
    >
      <TextInput
        label="Title"
        value={state.title}
        mode="outlined"
        style={{ marginVertical: 2.5 }}
        activeOutlineColor="#F44336"
        onChangeText={(text) => updateField("title", text)}
      />
      {state.errors?.title && (
        <Text style={styles.error}>{state.errors.title}</Text>
      )}
      <Button
        mode="elevated"
        buttonColor="#411310ff"
        textColor="#F44336"
        style={{ marginVertical: 2.5 }}
        onPress={() => {
          setShowStartPicker(true);
        }}
      >
        Pick Date
      </Button>
      <Text style={styles.text}>
        Start: {state.startDate?.toDateString() || ""}
      </Text>
      {state.errors?.startDate && (
        <Text style={styles.error}>{state.errors.startDate}</Text>
      )}
      {showStartPicker && (
        <DateTimePicker
          value={state.startDate || new Date()}
          mode="date"
          onChange={onStartChange}
        />
      )}
      <View style={{ flexDirection: "row" }}>
        <Button
          mode="elevated"
          buttonColor="#411310ff"
          textColor="#F44336"
          style={{ marginVertical: 2.5, width: "50%" }}
          onPress={() => {
            setShowAndroidStartTimerPicker(true);
          }}
        >
          Pick Start Time
        </Button>
        <Button
          mode="elevated"
          buttonColor="#411310ff"
          textColor="#F44336"
          style={{ marginVertical: 2.5, width: "50%" }}
          onPress={() => {
            setShowAndroidEndTimerPicker(true);
          }}
        >
          Pick End Time
        </Button>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.text}>
          Start: {state.startTime?.toLocaleTimeString() || ""}
        </Text>
        {state.errors?.startTime && (
          <Text style={styles.error}>{state.errors.startTime}</Text>
        )}
        <Text style={styles.text}>
          End: {state.endTime?.toLocaleTimeString() || ""}
        </Text>
        {state.errors?.endTime && (
          <Text style={styles.error}>{state.errors.endTime}</Text>
        )}
      </View>
      {showAndroidStartTimePicker && (
        <DateTimePicker
          value={state.startTime || new Date()}
          mode="time"
          onChange={onStartTimeChangeAndroid}
        />
      )}
      {showAndroidEndTimePicker && (
        <DateTimePicker
          value={state.endTime || new Date()}
          mode="time"
          onChange={onEndTimeChangeAndroid}
        />
      )}
      <Button
        mode="elevated"
        buttonColor="#411310ff"
        textColor="#F44336"
        style={{ marginVertical: 2.5 }}
        onPress={() => {
          setShowEndPicker(true);
        }}
      >
        Pick End Date
      </Button>
      <Text style={styles.text}>
        End: {state.endDate?.toDateString() || ""}
      </Text>
      {state.errors?.endDate && (
        <Text style={styles.error}>{state.errors.endDate}</Text>
      )}
      {showEndPicker && (
        <DateTimePicker
          value={state.endDate || new Date()}
          mode="date"
          onChange={onEndChange}
        />
      )}
      <TextInput
        label="Description"
        value={state.description || ""}
        mode="outlined"
        activeOutlineColor="#F44336"
        style={{ marginVertical: 2.5 }}
        onChangeText={(text) => updateField("description", text)}
        multiline
      />
      <View style={styles.switchContainer}>
        <Text style={styles.text}>Set Reminder</Text>
        <Switch
          value={state.reminder}
          thumbColor="#F44336"
          trackColor={{ false: "#ffffff", true: "#f443367a" }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
      </View>
      <Text style={styles.text}>Recurrence</Text>
      <SegmentedButtons
        style={{ marginVertical: 2.5 }}
        value={state.recurrence ? state.recurrence : "none"}
        onValueChange={(val) =>
          updateField("recurrence", val as "none" | "daily" | "weekly")
        }
        buttons={[
          {
            value: "none",
            label: "None",
            checkedColor: "#F44336",
            style: { backgroundColor: "#411310ff" },
          },
          {
            value: "daily",
            label: "Daily",
            checkedColor: "#F44336",
            style: { backgroundColor: "#411310ff" },
          },
          {
            value: "weekly",
            label: "Weekly",
            checkedColor: "#F44336",
            style: { backgroundColor: "#411310ff" },
          },
        ]}
      />
      <TextInput
        label="Category"
        value={state.category || ""}
        mode="outlined"
        activeOutlineColor="#F44336"
        style={{ marginVertical: 2.5 }}
        onChangeText={(text) => updateField("category", text)}
      />
      <Button
        mode="elevated"
        buttonColor="#411310ff"
        textColor="#F44336"
        style={{ marginVertical: 2.5 }}
        onPress={onSubmit}
      >
        Save
      </Button>
      <Button
        mode="elevated"
        buttonColor="#411310ff"
        textColor="#F44336"
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
    backgroundColor: "#36100dff",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#411310ff",
  },
  error: { color: "red", fontSize: 12 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  text: { color: "#F44336", marginVertical: 2.5 },
});
