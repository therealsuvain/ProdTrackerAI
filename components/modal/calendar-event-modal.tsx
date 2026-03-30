import React, { useContext, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Modal,
  TextInput,
  Button,
  SegmentedButtons,
  Switch,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ThemeContext } from "@/context/ThemeContext";

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
  const { theme } = useContext(ThemeContext);
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
    if (selected) updateField("startDate", selected);
  };

  const onStartTimeChangeAndroid = (event: any, selected?: Date) => {
    setShowAndroidStartTimerPicker(false);
    let varTime;
    if (selected)
      varTime = androidDate
        ? androidDate
        : state.startDate.split("T")[0] +
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
      varTime = androidDate
        ? androidDate
        : state.startDate.split("T")[0] +
          "T" +
          selected.toISOString().split("T")[1];
    updateField("endTime", new Date(varTime!));
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        {
          backgroundColor: theme.eventDarkPrimary,
          borderColor: theme.eventDarkSecondary,
        },
      ]}
    >
      <TextInput
        label="Title"
        defaultValue={state.title}
        mode="outlined"
        style={styles.verticalMargin}
        activeOutlineColor={theme.eventBase}
        onChangeText={(text) => updateField("title", text)}
      />
      {state.errors?.title && (
        <Text style={[styles.error,{color:theme.error}]}>{state.errors.title}</Text>
      )}
      <Button
        mode="elevated"
        buttonColor={theme.eventDarkSecondary}
        textColor={theme.eventBase}
        style={styles.verticalMargin}
        onPress={() => {
          setShowStartPicker(true);
        }}
      >
        Pick Date
      </Button>
      <Text style={[styles.text,{color:theme.eventBase}]}>
        Start: {new Date(state.startDate).toDateString() || ""}
      </Text>
      {state.errors?.startDate && (
        <Text style={[styles.error,{color:theme.error}]}>{state.errors.startDate}</Text>
      )}
      {showStartPicker && (
        <DateTimePicker
          value={(state.startDate && new Date(state.startDate)) || new Date()}
          mode="date"
          onChange={onStartChange}
        />
      )}
      <View style={{ flexDirection: "row" }}>
        <Button
          mode="elevated"
          buttonColor={theme.eventDarkSecondary}
          textColor={theme.eventBase}
          style={{ marginVertical: 2.5, width: "50%" }}
          onPress={() => {
            setShowAndroidStartTimerPicker(true);
          }}
        >
          Pick Start Time
        </Button>
        <Button
          mode="elevated"
          buttonColor={theme.eventDarkSecondary}
          textColor={theme.eventBase}
          style={{ marginVertical: 2.5, width: "50%" }}
          onPress={() => {
            setShowAndroidEndTimerPicker(true);
          }}
        >
          Pick End Time
        </Button>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[styles.text,{color:theme.eventBase}]}>
          Start: {new Date(state.startTime).toLocaleTimeString() || ""}
        </Text>
        {state.errors?.startTime && (
          <Text style={[styles.error,{color:theme.error}]}>{state.errors.startTime}</Text>
        )}
        <Text style={[styles.text,{color:theme.eventBase}]}>
          End: {new Date(state.endTime).toLocaleTimeString() || ""}
        </Text>
        {state.errors?.endTime && (
          <Text style={[styles.error,{color:theme.error}]}>{state.errors.endTime}</Text>
        )}
      </View>
      {showAndroidStartTimePicker && (
        <DateTimePicker
          value={(state.startTime && new Date(state.startTime)) || new Date()}
          mode="time"
          onChange={onStartTimeChangeAndroid}
        />
      )}
      {showAndroidEndTimePicker && (
        <DateTimePicker
          value={(state.endTime && new Date(state.endTime)) || new Date()}
          mode="time"
          onChange={onEndTimeChangeAndroid}
        />
      )}
      <Button
        mode="elevated"
        buttonColor={theme.eventDarkSecondary}
        textColor={theme.eventBase}
        style={styles.verticalMargin}
        onPress={() => {
          setShowEndPicker(true);
        }}
      >
        Pick End Date
      </Button>
      <Text style={[styles.text,{color:theme.eventBase}]}>
        End: {new Date(state.endDate).toDateString() || ""}
      </Text>
      {state.errors?.endDate && (
        <Text style={[styles.error,{color:theme.error}]}>{state.errors.endDate}</Text>
      )}
      {showEndPicker && (
        <DateTimePicker
          value={(state.endDate && new Date(state.endDate)) || new Date()}
          mode="date"
          onChange={onEndChange}
        />
      )}
      <TextInput
        label="Description"
        defaultValue={state.description || ""}
        mode="outlined"
        activeOutlineColor={theme.eventBase}
        style={styles.verticalMargin}
        onChangeText={(text) => updateField("description", text)}
        multiline
      />
      <View style={styles.switchContainer}>
        <Text style={[styles.text,{color:theme.eventBase}]}>Set Reminder</Text>
        <Switch
          value={state.reminder}
          thumbColor={theme.eventBase}
          trackColor={{ false: theme.whiteBase, true: theme.eventBase }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
      </View>
      <Text style={[styles.text,{color:theme.eventBase}]}>Recurrence</Text>
      <SegmentedButtons
        style={styles.verticalMargin}
        value={state.recurrence ? state.recurrence : "none"}
        onValueChange={(val) =>
          updateField("recurrence", val as "none" | "daily" | "weekly")
        }
        buttons={[
          {
            value: "none",
            label: "None",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.eventBase,
            style: { backgroundColor: theme.eventDarkSecondary },
          },
          {
            value: "daily",
            label: "Daily",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.eventBase,
            style: { backgroundColor: theme.eventDarkSecondary },
          },
          {
            value: "weekly",
            label: "Weekly",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.eventBase,
            style: { backgroundColor: theme.eventDarkSecondary },
          },
        ]}
      />
      <TextInput
        label="Category"
       defaultValue={state.category || ""}
        mode="outlined"
        activeOutlineColor={theme.eventBase}
        style={styles.verticalMargin}
        onChangeText={(text) => updateField("category", text)}
      />
      <Button
        mode="elevated"
        buttonColor={theme.eventDarkSecondary}
        textColor={theme.eventBase}
        style={styles.verticalMargin}
        onPress={onSubmit}
      >
        Save
      </Button>
      <Button
        mode="elevated"
        buttonColor={theme.eventDarkSecondary}
        textColor={theme.eventBase}
        style={styles.verticalMargin}
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
  error: { fontSize: 12 },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  text: { marginVertical: 2.5 },
  verticalMargin: { marginVertical: 2.5 },
});
