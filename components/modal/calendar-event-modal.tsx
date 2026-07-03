import React, { useContext, useEffect, useState } from "react";
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
import { TagsAndCategorySection } from "@/components/ui/shared/tags-and-categories-addon";
import { useTagsAndCategories } from "@/hooks/use-tags-and-categories";
import { useData } from "@/hooks/context-hooks/use-data";
import { GlobalMetricKey } from "@/types/metrics";
// TODO date field managment for multi timezone users CHECK
//TODOX What in case when a user wants to schedule an overnight event, when the start time is later than the end time but of previous date, current logic breaks in case
interface Props {
  visible: boolean;
  onDismiss: () => void;
  state: any;
  updateField: (field: any, value: any) => void;
  onSubmit: (tagsIds: string[]) => Promise<void> | void;
  isNew?: boolean;
}

export default function CalendarEventModal({
  visible,
  onDismiss,
  state,
  updateField,
  onSubmit,
  isNew,
}: Props) {
  //console.log("sS", state.startTime);
  //console.log("sE", state.endTime);
  const { theme } = useContext(ThemeContext);
  const { trackMetric } = useData();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showAndroidStartTimePicker, setShowAndroidStartTimerPicker] =
    useState(false);
  const [showAndroidEndTimePicker, setShowAndroidEndTimerPicker] =
    useState(false);
  const [androidDate, setAndroidDate] = useState<Date>();
  const tagsAndCategoryEditor = useTagsAndCategories({
    visible,
    initialTags: state.tags,
    initialCategory: state.category,
    updateField,
  });
  const onStartChange = (event: any, selected?: Date) => {
    setShowStartPicker(false);
    setAndroidDate(selected);
    if (selected) updateField("startDate", selected.toISOString());
  };

  const onStartTimeChangeAndroid = (event: any, selected?: Date) => {
    setShowAndroidStartTimerPicker(false);
    let varTime =
      state.startDate.split("T")[0] + "T" + state.startTime.split("T")[1];
    if (selected)
      varTime = androidDate
        ? androidDate.toISOString().split("T")[0] +
          "T" +
          selected.toISOString().split("T")[1]
        : state.startDate.split("T")[0] +
          "T" +
          selected.toISOString().split("T")[1];
    updateField("startTime", varTime);
  };
  const onEndChange = (event: any, selected?: Date) => {
    setShowEndPicker(false);
    if (selected) updateField("endDate", selected.toISOString());
  };

  const onEndTimeChangeAndroid = (event: any, selected?: Date) => {
    setShowAndroidEndTimerPicker(false);

    let varTime =
      state.startDate.split("T")[0] + "T" + state.endTime.split("T")[1];

    if (selected) {
      varTime = androidDate
        ? androidDate.toISOString().split("T")[0] +
          "T" +
          selected.toISOString().split("T")[1]
        : state.startDate.split("T")[0] +
          "T" +
          selected.toISOString().split("T")[1];
    }

    updateField("endTime", varTime);
  };

  const onSubmitWithTags = async () => {
    const finalTagIds = await tagsAndCategoryEditor.processMetadataOnSave(
      state.category,
    );
    const metricsArr: GlobalMetricKey[] = [];
    if (state.recurrence === "daily" && state.endDate) {
      metricsArr.push("eventsDaily");
    } else if (state.recurrence === "weekly" && state.endDate) {
      metricsArr.push("eventsWeekly");
    } else if (state.recurrence === "none") {
      metricsArr.push("eventsSingleton");
    } else {
      metricsArr.push("eventsInfinite");
    }
    const start = new Date(state.startTime);
    const end = new Date(state.endTime);

    const startSeconds =
      start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds();

    const endSeconds =
      end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds();

    const SIX_AM = 6 * 3600;
    const NINE_AM = 9 * 3600;
    const NINE_PM = 21 * 3600;
    const END_OF_DAY = 23 * 3600 + 59 * 60 + 59;

    if (startSeconds >= SIX_AM && endSeconds <= NINE_AM) {
      metricsArr.push("eventsEarlymorning");
    } else if (startSeconds >= NINE_PM && endSeconds <= END_OF_DAY) {
      metricsArr.push("eventsLatenight");
    } else if (startSeconds >= NINE_PM || endSeconds <= SIX_AM) {
      metricsArr.push("eventsOvernight");
    }
    metricsArr.push("eventsAdded");
    isNew && trackMetric(metricsArr, 1);
    !isNew && trackMetric(["eventsEdited"], 1);
    await onSubmit(finalTagIds);
  };

  useEffect(() => {
    console.log("Auto Time Day Update - useEffect");
    if (state.startTime && state.endTime && androidDate) {
      updateField(
        "startTime",
        androidDate.toISOString().split("T")[0] +
          "T" +
          state.startTime.split("T")[1],
      );
      updateField(
        "endTime",
        androidDate.toISOString().split("T")[0] +
          "T" +
          state.endTime.split("T")[1],
      );
      console.log("Auto Time Day Update - useEffect - UPDATION");
    }
  }, [androidDate]);

  const hasStartTimeError = !!state.errors?.startTime;
  const hasEndTimeError = !!state.errors?.endTime;
  const hasValidStartTime = !!state.startTime && !hasStartTimeError;
  const hasValidEndTime = !!state.endTime && !hasEndTimeError;
  const shouldRenderTimeRow =
    hasStartTimeError ||
    hasEndTimeError ||
    hasValidStartTime ||
    hasValidEndTime;
  //console.log("state", state);
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
        style={[styles.verticalMargin, { backgroundColor: theme.background }]}
        textColor={theme.text}
        theme={{
          colors: {
            // primary: theme.text, // Color when focused
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
        activeOutlineColor={theme.eventBase}
        onChangeText={(text) => updateField("title", text)}
      />
      {state.errors?.title && (
        <Text style={[styles.error, { color: theme.error }]}>
          {state.errors.title}
        </Text>
      )}
      <TagsAndCategorySection
        editor={tagsAndCategoryEditor}
        itemType="event"
        updateField={updateField}
      />
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
      <Text
        style={[styles.text, { color: theme.eventBase, textAlign: "center" }]}
      >
        {new Date(state.startDate).toDateString() || ""}
      </Text>
      {state.errors?.startDate && (
        <Text style={[styles.error, { color: theme.error }]}>
          {state.errors.startDate}
        </Text>
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
      {shouldRenderTimeRow && (
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            {hasStartTimeError && (
              <Text style={[styles.error, { color: theme.error }]}>
                {state.errors.startTime}
              </Text>
            )}
            {hasValidStartTime && (
              <Text style={[styles.text, { color: theme.eventBase }]}>
                {new Date(state.startTime).toLocaleString()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            {hasEndTimeError && (
              <Text style={[styles.error, { color: theme.error }]}>
                {state.errors.endTime}
              </Text>
            )}
            {hasValidEndTime && (
              <Text style={[styles.text, { color: theme.eventBase }]}>
                {new Date(state.endTime).toLocaleString()}
              </Text>
            )}
          </View>
        </View>
      )}
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
        style={[styles.verticalMargin, { backgroundColor: theme.background }]}
        textColor={theme.text}
        theme={{
          colors: {
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
        onChangeText={(text) => updateField("description", text)}
        multiline
      />
      <View style={styles.switchContainer}>
        <Text style={[styles.text, { color: theme.eventBase }]}>
          Set Reminder
        </Text>
        <Switch
          value={state.reminder}
          thumbColor={theme.eventBase}
          trackColor={{ false: theme.whiteBase, true: theme.eventBase }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
      </View>
      <Text style={[styles.text, { color: theme.eventBase }]}>Recurrence</Text>
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
      {state.recurrence !== "none" && (
        <>
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

          {state.endDate && (
            <Text style={[styles.text, { color: theme.eventBase }]}>
              End: {new Date(state.endDate).toDateString()}
            </Text>
          )}
        </>
      )}
      <Button
        mode="elevated"
        buttonColor={theme.eventDarkSecondary}
        textColor={theme.eventBase}
        style={styles.verticalMargin}
        onPress={() => {
          setAndroidDate(undefined);
          onSubmitWithTags();
        }}
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
