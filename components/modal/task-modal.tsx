import { ThemeContext } from "@/context/ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useContext, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Button,
  Modal,
  SegmentedButtons,
  Switch,
  TextInput,
} from "react-native-paper";

/* import { TagInput } from "../ui/shared/tags/tag-input";
import { CategorySelector } from "../ui/shared/categories/category-selector";
import { Category } from "@/types/category";
import { randomUUID } from "expo-crypto";
import { useData } from "@/hooks/use-data";
 */
import { TagsAndCategorySection } from "@/components/ui/shared/tags-and-categories-addon";
import { useTagsAndCategories } from "@/hooks/use-tags-and-categories";
import { useData } from "@/hooks/context-hooks/use-data";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  state: any;
  updateField: (field: any, value: any) => void;
  onSubmit: (tagIDs: string[]) => Promise<void> | void;
  isNew?: boolean;
}

export default function TaskModal({
  visible,
  onDismiss,
  state,
  updateField,
  onSubmit,
  isNew,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const { trackMetric } = useData();
  /*   const {
    tags,
    addTags,
    categories,
    addCategory,
    incrementCategoryUsage,
    deleteUserCategory,
  } = useData(); */

  const tagsAndCategoryEditor = useTagsAndCategories({
    visible,
    initialTags: state.tags,
    initialCategory: state.category,
    updateField,
  });
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  //const [taskTags, setTaskTags] = useState<string[]>([]);
  /*   const [category, setCategory] = useState<string | null>(null);
  const [sessionCatIds, setSessionCatIds] = useState<Set<string>>(
    new Set<string>(),
  );
  const [tagNames, setTagNames] = useState<string[]>([]);
  const originalTagIdsRef = useRef<string[]>([]);
  const originalCategoryRef = useRef<string>(null); */
  //const taskTagsRef = useRef<string[]>([]);
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

  const onSubmitWithTags = async () => {
    /*    let finalIds: string[];

    if (originalTagIdsRef.current && originalTagIdsRef.current.length > 0) {
      // Get original tag names from the tags store using editingTask's IDs
      const originalNames = originalTagIdsRef.current
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[];

      // Diff: only names that are NEW (not in original)
      const newNames = tagNames.filter((name) => !originalNames.includes(name));

      // Names that already existed on this task (no addTags needed for these)
      const existingNames = tagNames.filter((name) =>
        originalNames.includes(name),
      );

      // Get IDs for existing names from the tags store (they're already in DB)
      const existingIds = existingNames
        .map((name) => tags.find((t) => t.name === name)?.id)
        .filter(Boolean) as string[];

      // Only call addTags for the diff — this avoids double-counting
      const newIds = newNames.length > 0 ? await addTags(newNames) : [];

      finalIds = [...existingIds, ...newIds];
    } else {
      // New task — all tagNames are new, pass everything to addTags
      finalIds = tagNames.length > 0 ? await addTags(tagNames) : [];
    }

    if (state.category !== originalCategoryRef.current) {
      await incrementCategoryUsage(state.category);
    } */
    console.log("orig Tags", state.tags);
    const finalTagIds = await tagsAndCategoryEditor.processMetadataOnSave(
      state.category,
    );
    console.log("final Tags", finalTagIds);
    await onSubmit(finalTagIds);
    if (isNew) trackMetric(["tasksAdded"], 1);
    else trackMetric(["tasksEdited"], 1);
  };

  /*   const addTagToTask = (tag: string) => {
    setTagNames((prev) => [...prev, tag]);
  };

  const removeTagFromTask = (tag: string) => {
    setTagNames((prev) => prev.filter((t) => t !== tag));
  };

  const handleCreateCategory = async (
    name: string,
    color: string,
    icon: string,
  ) => {
    const id = await addCategory(name, color, icon);
    setSessionCatIds((prevSet) => {
      const newSet = new Set(prevSet);
      newSet.add(id);
      return newSet;
    });
    setCategory(id);
  };

  const handleDeleteCateogry = async (draftId: string) => {
    if (!sessionCatIds.has(draftId)) {
      console.log("What Category, not in sessionCreatedCatIds");
    }
    setSessionCatIds((prevSet) => {
      const newSet = new Set(prevSet);
      newSet.delete(draftId);
      return newSet;
    });
    if (category === draftId) {
      setCategory(null);
      updateField("category", null);
    }
    await deleteUserCategory(draftId);
  };

  useEffect(() => {
    // Assuming 'isVisible' dictates if the modal is open, and 'task' is the passed item
    if (visible) {
      // Populate the draft state when opening an existing task
      //setTaskTags(state.tags ?? []);
      originalTagIdsRef.current = state.tags ?? [];
      originalCategoryRef.current = state.category ?? null;
      if (state.tags && state.tags.length > 0) {
        // tags = your TagRow[] from useData()
        const names = state.tags
          .map((id: string) => tags.find((t) => t.id === id)?.name)
          .filter(Boolean) as string[];
        setTagNames(names);
      } else {
        setTagNames([]);
      }
      setCategory(state.category ?? null);
    } else if (!visible) {
      // Clean up the draft state when the modal closes to prevent memory leaks
      // and stop old data from flashing on the next open.
      //setTaskTags([]);
      originalTagIdsRef.current = [];
      setTagNames([]);
      setCategory(null);
    }
  }, [visible, state.tags]); */

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
      <TagsAndCategorySection
        editor={tagsAndCategoryEditor}
        itemType="task"
        updateField={updateField}
      />
      {/*  <CategorySelector
        categoriesDb={categories}
        sessionCategories={sessionCatIds}
        selectedCategory={category}
        onSelectCategory={setCategory}
        onCreateCategory={handleCreateCategory}
        onDeleteCategory={handleDeleteCateogry}
        updateField={updateField}
      />
      <TagInput
        itemType="task"
        currentTags={tagNames}
        userTagsDb={tags} // [{ name: 'high-energy', count: 5 }, ...]
        onAddTag={addTagToTask}
        onRemoveTag={removeTagFromTask}
      /> */}
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
        <Text style={[styles.date, { color: theme.taskLightPrimary }]}>
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
        <Text style={[styles.text, { color: theme.taskLightPrimary }]}>
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
        onPress={onSubmitWithTags}
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
