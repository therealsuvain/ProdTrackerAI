import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
} from "react-native";
import { format } from "date-fns";
import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useData } from "@/hooks/context-hooks/use-data";
import { CategoryBadge } from "../../shared/categories/category-badge";
import { TagBadge } from "../../shared/tags/tag-badge";
import { ActionChipProps } from "./chip-props";
import { TagSelectionModal } from "./taxonomy-selection-modals-for-chat/tag-selection-modal";
import { CategorySelectionModal } from "./taxonomy-selection-modals-for-chat/category-selection-modal";
import { EnumSelectionModal } from "./taxonomy-selection-modals-for-chat/enum-selection-modal";
import { Category } from "@/types/category";
//TODO : Chat screen doesnt revert back in pos after keyboard opens via item chip or when picker is opened.
// TODO: Preview for description or any other field , that I dont really add in development
export const ItemChip = ({
  action,
  onUpdateAction,
  isConfirmed,
  isExpired,
}: ActionChipProps) => {
  const isReadOnly = isConfirmed || isExpired;
  const isEdit = action.name.toLowerCase().includes("edit");
  const args = action.args;
  const { categories, tags: allTags } = useData();
  /*   if (args.title === "Running" || action.extraInfo?.title === "Running") {
    console.log(action);
  } */
  // Local UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [dateForPicker, setDateForPicker] = useState(new Date());
  const [modeForPicker, setModeForPicker] = useState<"date" | "time">("date");
  const [updateFieldForPicker, setUpdateFieldForPicker] = useState("dueDate");

  // Enum dictionaries based on your requirements
  const ENUM_OPTIONS: Record<string, string[]> = {
    priority: ["low", "medium", "high"],
    frequency: ["daily", "weekly", "monthly"],
    recurrence: ["none", "daily", "weekly"],
  };
  const existingTags: string[] = action.extraInfo?.tags || [];
  const addedTags: string[] = action.args.addTagIds || [];
  const removedTags: string[] = action.args.removeTagIds || [];
  // For new creations (addTask)
  const newActionTags: string[] = action.args.tags || action.args.tagIds || [];

  // Calculate Delta
  let activeTags: string[] = [];
  let crossedOutTags: string[] = [];

  if (isEdit) {
    // Final Active Tags: (Existing  Added) minus Removed
    const combinedTags = new Set([...existingTags, ...addedTags]);
    activeTags = Array.from(combinedTags).filter(
      (id) => !removedTags.includes(id),
    );

    // -Removed Tags: Only show as crossed out if they actually existed on the item before
    crossedOutTags = removedTags.filter((id) => existingTags.includes(id));
  } else {
    activeTags = newActionTags;
  }

  const updateArg = (key: string, value: any) => {
    onUpdateAction({ ...args, [key]: value });
  };

  const handleTagRemove = (tagId: string) => {
    if (isEdit) {
      if (addedTags.includes(tagId)) {
        updateArg(
          "addTagIds",
          addedTags.filter((id) => id !== tagId),
        );
      } else {
        updateArg("removeTagIds", [...new Set([...removedTags, tagId])]);
      }
    } else {
      updateArg(
        "tags",
        newActionTags.filter((id) => id !== tagId),
      );
    }
  };

  const handleTagsSave = (selectedIds: string[]) => {
    setShowTagModal(false);
    if (isEdit) {
      const newlyAdded = selectedIds.filter((id) => !existingTags.includes(id));
      const newlyRemoved = existingTags.filter(
        (id) => !selectedIds.includes(id),
      );
      onUpdateAction({
        ...args,
        addTagIds: newlyAdded,
        removeTagIds: newlyRemoved,
      });
    } else {
      updateArg("tags", selectedIds);
    }
  };

  const handleDatePickerChange = (
    mode: "date" | "time",
    date: Date,
    field: string,
  ) => {
    setModeForPicker(mode);
    setDateForPicker(date);
    setUpdateFieldForPicker(field);
    setShowDatePicker(true);
  };
  // 1. Add this to your state declarations inside ItemChip:
  const [enumConfig, setEnumConfig] = useState<{
    field: string;
    value: string;
    options: string[];
  } | null>(null);

  // 2. The new simplified EditableEnum Trigger
  const EditableEnumTrigger = ({
    fieldName,
    value,
  }: {
    fieldName: string;
    value: string;
  }) => {
    return (
      <Pressable
        onPress={() =>
          setEnumConfig({
            field: fieldName,
            value: value,
            options: ENUM_OPTIONS[fieldName] || [],
          })
        }
        disabled={isReadOnly}
      >
        <Text style={[styles.enumText, isReadOnly && styles.disabledEnumText]}>
          {value} {!isReadOnly && "▾"}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { alignItems: "center" }]}>
        {args.reminder && (
          <Feather
            name="bell"
            size={14}
            color="#FF9500"
            style={{ marginTop: 2 }}
          />
        )}
        {action.args.title || action.args.t || action.extraInfo?.title ? (
          <TextInput
            style={styles.titleInput}
            defaultValue={args.title || action.extraInfo?.title}
            onChangeText={(text) => updateArg("title", text)}
            multiline={false}
            placeholder="Title..."
            placeholderTextColor="#8E8E93"
            editable={!isReadOnly}
          />
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {"Deleted Item"}
          </Text>
        )}
        {action.extraInfo?.category && (
          <Pressable
            onPress={() => {
              args.categoryId ? {} : setShowCategoryModal(true);
            }}
            disabled={isReadOnly}
          >
            <CategoryBadge
              category={action.extraInfo.category}
              variant="iconOnly"
            />
          </Pressable>
        )}
        {args.category ? (
          <>
            <Text style={styles.arrow}>➔</Text>
            <Pressable
              onPress={() => setShowCategoryModal(true)}
              disabled={isReadOnly}
            >
              <CategoryBadge
                category={{ id: action.args.category } as any}
                variant="iconOnly"
              />
            </Pressable>
          </>
        ) : action.extraInfo?.category ? (
          <></>
        ) : (
          !isReadOnly && (
            <Pressable
              onPress={() => setShowCategoryModal(true)}
              style={styles.addIconWrap}
            >
              <Feather name="folder-plus" size={16} color="#8E8E93" />
            </Pressable>
          )
        )}
      </View>
      {action.args.description || action.extraInfo?.description ? (
        <TextInput
          style={styles.descriptionInput}
          defaultValue={
            action.args.description || action.extraInfo?.description
          }
          onChangeText={(text) => updateArg("description", text)}
          multiline={true}
          editable={!isReadOnly}
        />
      ) : (
        <Text style={styles.descriptionInput} numberOfLines={1}>
          {"Deleted Item"}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={styles.tagsContainer}>
          {/* Render Final Active Tags */}
          {activeTags.map((tagId) => (
            <TagBadge
              key={`active-${tagId}`}
              tagId={tagId}
              holeColor="#ffffff"
            />
          ))}

          {/* Render Removed Tags with a Strikethrough Overlay */}
          {crossedOutTags.map((tagId) => (
            <View key={`removed-${tagId}`} style={styles.strikethroughWrapper}>
              <TagBadge tagId={tagId} holeColor="#ffffff" />
              <View style={styles.strikethroughLine} />
            </View>
          ))}
          {/* Add Tag Icon */}
          {!isReadOnly && (
            <Pressable
              //style={{ width: "auto" }}
              onPress={() => setShowTagModal(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#8E8E93" />
            </Pressable>
          )}
        </View>
      </View>
      {/* <Text style={styles.subtitle}>{getActionSubtitle()}</Text> */}
      <View style={styles.detailsRow}>
        {(args.dueDate || action.extraInfo?.dueDate) && (
          <Pressable
            onPress={() =>
              handleDatePickerChange(
                "date",
                args.dueDate || action.extraInfo?.dueDate,
                "dueDate",
              )
            }
            disabled={isReadOnly}
          >
            <Text style={styles.subtitle}>
              Due: {format(args.dueDate || action.extraInfo?.dueDate, "MMM d")}
            </Text>
          </Pressable>
        )}
        {(args.startDate || action.extraInfo?.startDate) && (
          <Pressable
            onPress={() =>
              handleDatePickerChange(
                "date",
                args.startDate || action.extraInfo?.startDate,
                "startDate",
              )
            }
            disabled={isReadOnly}
          >
            <Text style={styles.subtitle}>
              Start:{" "}
              {format(args.startDate || action.extraInfo?.startDate, "MMM d")}
            </Text>
          </Pressable>
        )}
        {(args.startTime || action.extraInfo?.startTime) && (
          <Pressable
            onPress={() =>
              handleDatePickerChange(
                "time",
                args.startTime || action.extraInfo?.startTime,
                "startTime",
              )
            }
            disabled={isReadOnly}
          >
            <Text style={styles.subtitle}>
              Time:{" "}
              {format(args.startTime || action.extraInfo?.startTime, "h:mm a")}
            </Text>
          </Pressable>
        )}
        {(args.endDate || action.extraInfo?.endDate) && (
          <Pressable
            onPress={() =>
              handleDatePickerChange(
                "date",
                args.endDate || action.extraInfo?.endDate,
                "endDate",
              )
            }
            disabled={isReadOnly}
          >
            <Text style={styles.subtitle}>
              End: {format(args.endDate || action.extraInfo?.endDate, "MMM ,d")}
            </Text>
          </Pressable>
        )}
        {(args.endTime || action.extraInfo?.endTime) && (
          <Pressable
            onPress={() =>
              handleDatePickerChange(
                "time",
                args.endTime || action.extraInfo?.endTime,
                "endTime",
              )
            }
            disabled={isReadOnly}
          >
            <Text style={styles.subtitle}>
              Time:{" "}
              {format(args.endTime || action.extraInfo?.endTime, "h:mm a")}
            </Text>
          </Pressable>
        )}
        {/* Dynamic Enums */}
        {(args.priority || action.extraInfo?.priority) && (
          <EditableEnumTrigger
            fieldName="priority"
            value={args.priority || action.extraInfo?.priority}
          />
        )}
        {(args.frequency || action.extraInfo?.frequency) && (
          <EditableEnumTrigger
            fieldName="frequency"
            value={args.frequency || action.extraInfo?.frequency}
          />
        )}
        {(args.recurrence || action.extraInfo?.recurrence) && (
          <EditableEnumTrigger
            fieldName="recurrence"
            value={args.recurrence || action.extraInfo?.recurrence}
          />
        )}
        {(args.targetDays || action.extraInfo?.targetDays) && (
          <Pressable onPress={() => {}} disabled={isReadOnly}>
            <Text style={styles.subtitle}>
              {"Target Days: "}{" "}
              {args.targetDays || action.extraInfo?.targetDays}
            </Text>
          </Pressable>
        )}
      </View>
      {/* Date Picker Native Component */}
      {showDatePicker && (
        <DateTimePicker
          mode={modeForPicker}
          value={new Date(dateForPicker)}
          display="default"
          onChange={(event, selectedDate) => {
            if (Platform.OS === "android") setShowDatePicker(false);
            if (selectedDate && event.type !== "dismissed") {
              updateArg(updateFieldForPicker, selectedDate.toISOString());
              if (Platform.OS === "ios") setShowDatePicker(false);
            }
          }}
        />
      )}

      {/* Modals */}
      <CategorySelectionModal
        categories={categories}
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelect={(catId) => {
          updateArg("category", catId);
          setShowCategoryModal(false);
        }}
      />
      <TagSelectionModal
        tags={allTags}
        initialSelected={activeTags}
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSave={handleTagsSave}
      />
      <EnumSelectionModal
        visible={!!enumConfig}
        fieldName={enumConfig?.field || null}
        currentValue={enumConfig?.value || null}
        options={enumConfig?.options || []}
        onClose={() => setEnumConfig(null)}
        onSelect={(selectedValue) => {
          if (enumConfig) updateArg(enumConfig.field, selectedValue);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    //maxWidth: "99%",
  },
  header: { flexDirection: "row", gap: 4 },
  title: { fontSize: 14, fontWeight: "600", color: "#333" },
  subtitle: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  arrow: { fontSize: 12, color: "#8E8E93", marginHorizontal: 2 },
  tagsContainer: {
    // ← takes all space the add-btn doesn't need
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    maxWidth: "97.5%",
    gap: 4,
  },

  // Strikethrough Styles
  strikethroughWrapper: {
    position: "relative",
    opacity: 0.4,
  },
  strikethroughLine: {
    position: "absolute",
    height: 1.5,
    backgroundColor: "#FF3B30",
    top: "50%",
    left: 4,
    right: 4,
    zIndex: 1,
  },
  enumText: { fontSize: 11, color: "#007AFF", fontWeight: "500" },
  disabledEnumText: { color: "#8E8E93" },
  enumDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    backgroundColor: "#FFF",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 80,
    paddingVertical: 4,
  },
  enumOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  enumOptionText: { fontSize: 12, color: "#333", textTransform: "capitalize" },
  addIconWrap: {
    opacity: 0.8,
  },
  titleInput: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    padding: 0,
    margin: 0,
  },
  descriptionInput: {
    fontSize: 12,
    color: "#8E8E93",
    padding: 0,
    margin: 0,
    fontStyle: "italic",
  },
  detailsRow: {
    flexDirection: "row",
    rowGap: 0,
    columnGap: 4,
    alignItems: "center",
    flexWrap: "wrap",
    zIndex: 10, // Important for Enum dropdown overlaps
  },
});
