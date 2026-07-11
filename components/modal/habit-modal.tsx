import { ThemeContext } from "@/context/ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useContext, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Button,
  Modal,
  SegmentedButtons,
  Switch,
  TextInput,
} from "react-native-paper";
import DaySelector from "../ui/habits/day-selector";
import { useTagsAndCategories } from "@/hooks/use-tags-and-categories";
import { TagsAndCategorySection } from "../ui/shared/tags-and-categories-addon";
import { GlobalMetricKey } from "@/types/metrics";
import { useData } from "@/hooks/context-hooks/use-data";

interface Props {
  visible: boolean;
  visibleInEditMode: boolean;
  onDismiss: () => void;
  state: any;
  updateField: (field: any, value: any) => void;
  onSubmit: (tagIDs: string[]) => Promise<void> | void;
}

export default function HabitModal({
  visible,
  visibleInEditMode,
  onDismiss,
  state,
  updateField,
  onSubmit,
}: Props) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { theme } = useContext(ThemeContext);
  const { trackMetric } = useData();

  const tagsAndCategoryEditor = useTagsAndCategories({
    visible,
    initialTags: state.tags,
    initialCategory: state.category,
    updateField,
  });

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    console.log("HABIT MODAL REMINDER DATE", selectedDate);
    console.log(selectedDate?.toLocaleString());
    if (selectedDate) updateField("reminderDate", selectedDate.toISOString());
  };

  const onSubmitWithTags = async () => {
    const finalTagIds = await tagsAndCategoryEditor.processMetadataOnSave(
      state.category,
    );
    const updateMetrics: GlobalMetricKey[] = [];
    if (state.frequency === "daily") {
      updateMetrics.push("habitsWithDailyGoals");
    } else {
      updateMetrics.push("habitsWithWeeklyGoals");
    }
    updateMetrics.push("habitsAdded");
    if (visibleInEditMode) trackMetric(["habitsEdited"], 1);
    else trackMetric(updateMetrics, 1);
    await onSubmit(finalTagIds);
  };
  //visibleInEditMode && console.log("visibleInEditMode", state.goal);
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        {
          backgroundColor: theme.habitDarkPrimary,
          borderColor: theme.habitDarkSecondary,
        },
      ]}
    >
      <TextInput
        style={[styles.verticalMargin, { backgroundColor: theme.background }]}
        textColor={theme.text}
        label="Habit Name"
        mode="outlined"
        activeOutlineColor={theme.habitBase}
        theme={{
          colors: {
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
        defaultValue={state.title}
        onChangeText={(text) => updateField("title", text)}
      />
      {state.errors?.title && (
        <Text style={[styles.error, { color: theme.error }]}>
          {state.errors.title}
        </Text>
      )}
      <TextInput
        style={[styles.verticalMargin, { backgroundColor: theme.background }]}
        textColor={theme.text}
        label="Habit Description"
        mode="outlined"
        activeOutlineColor={theme.habitBase}
        theme={{
          colors: {
            onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
          },
        }}
        defaultValue={state.description}
        onChangeText={(text) => updateField("description", text)}
      />
      <TagsAndCategorySection
        editor={tagsAndCategoryEditor}
        itemType="habit"
        updateField={updateField}
      />
      <SegmentedButtons
        style={styles.verticalMargin}
        value={state.frequency}
        onValueChange={(val) =>
          updateField("frequency", val as "daily" | "weekly")
        }
        buttons={[
          {
            value: "daily",
            label: "Daily",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.habitBase,
            style: { backgroundColor: theme.habitDarkSecondary },
          },
          {
            value: "weekly",
            label: "Weekly",
            uncheckedColor: theme.whiteBase,
            checkedColor: theme.habitBase,
            style: { backgroundColor: theme.habitDarkSecondary },
          },
        ]}
      />
      <DaySelector
        visible={state.frequency == "weekly"}
        selectedDays={state.targetDays}
        onDaysChange={updateField}
      />
      {!visibleInEditMode && (
        <>
          <TextInput
            style={[
              styles.verticalMargin,
              { backgroundColor: theme.background },
            ]}
            textColor={theme.text}
            label="Goal"
            mode="outlined"
            activeOutlineColor={theme.habitBase}
            theme={{
              colors: {
                onSurfaceVariant: theme.greyBasePrimary, // Color when unfocused
              },
            }}
            defaultValue={state.goal}
            onChangeText={(text) => updateField("goal", text)}
            keyboardType="numeric"
          />
          {state.errors?.goal && (
            <Text style={[styles.error, { color: theme.error }]}>
              {state.errors.goal}
            </Text>
          )}
        </>
      )}
      <View style={styles.switchContainer}>
        <Text style={[styles.text, { color: theme.habitBase }]}>
          Set Reminder
        </Text>
        <Switch
          value={state.reminder}
          thumbColor={theme.habitBase}
          trackColor={{
            false: theme.whiteBase,
            true: theme.habitDarkSecondary,
          }}
          onValueChange={(val) => {
            updateField("reminder", val);
          }}
        />
        {state.reminder && (
          <>
            <Button
              mode="elevated"
              buttonColor={theme.habitDarkSecondary}
              textColor={theme.habitBase}
              style={styles.verticalMargin}
              onPress={() => setShowTimePicker(true)}
            >
              Pick Time
            </Button>

            <Text style={[styles.text, { color: theme.habitBase }]}>
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
                value={state.reminderDate || new Date()}
                mode="time"
                onChange={onTimeChange}
              />
            )}
          </>
        )}
      </View>
      <Button
        style={styles.verticalMargin}
        mode="elevated"
        buttonColor={theme.habitDarkSecondary}
        textColor={theme.habitBase}
        onPress={onSubmitWithTags}
      >
        Save
      </Button>
      <Button
        style={styles.verticalMargin}
        mode="elevated"
        buttonColor={theme.habitDarkSecondary}
        textColor={theme.habitBase}
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
  text: { marginLeft: 10 },
  error: { fontSize: 12 },
  verticalMargin: { marginVertical: 2.5 },
});
