import Ionicons from "@expo/vector-icons/Ionicons";
import { format, set } from "date-fns";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TagList } from "../shared/tags/tag-list";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagBadge } from "../shared/tags/tag-badge";
import { resolveIcon } from "@/utils/AI-utils/agentic-handlers/tags-and-categories-handlers";
import { Category } from "@/types/category";
import { CategoryCreator } from "../shared/categories/category-creation-view";
import { TagsEditModal } from "../shared/tags/tags-edit-modal";

interface Props {
  action: any;
  onRemove: () => void;
  isConfirmed?: boolean;
  isExpired?: boolean;
}
export const ActionChip = ({
  action,
  onRemove,
  isConfirmed,
  isExpired,
}: Props) => {
  const [openCategoryEditor, setOpenCategoryEditor] = useState(false);
  const [openTagEditor, setOpenTagEditor] = useState(false);
  const [tagName, setTagName] = useState("");

  const getActionSubtitle = (action: any) => {
    const data = { ...action.extraInfo, ...action.args }; // Use extraInfo for existing, args for new
    const parts: string[] = [];
    if (action.name.includes("Task")) {
      if (data.dueDate)
        parts.push(`Due: ${new Date(data.dueDate).toLocaleDateString()}`);
      if (data.priority) parts.push(`Priority: ${data.priority}`);
    } else if (action.name.includes("Habit")) {
      if (data.streak !== undefined) parts.push(`Streak: ${data.streak}`);
      if (data.goal) parts.push(`Goal: ${data.goal}`);
    } else if (action.name.includes("Event")) {
      if (data.startDate)
        parts.push(
          `${format(new Date(data.startDate), "MMM ,d")} - ${format(new Date(data.startDate), "MMM") === format(new Date(data.endDate), "MMM") ? format(new Date(data.endDate), "d") : format(new Date(data.endDate), "MMM ,d")}`,
        );
      if (data.startTime)
        //parts.push(`${data.startTime}`)
        parts.push(
          `${typeof data.startTime === "string" ? data.startTime : format(data.startTime, "h:mm a")} - ${typeof data.endTime === "string" ? data.endTime : data.endTime ? format(data.endTime, "h:mm a") : ""}`,
        );
    }

    return parts.join(" | ");
  };

  const getActionIcon = (name: string) => {
    if (name.includes("add")) return "add-circle-outline";
    if (name.includes("delete")) return "trash-outline";
    return "pencil"; // Edit
  };

  const getActionItemType = (name: string) => {
    if (name.includes("Task")) return "Task";
    if (name.includes("Habit")) return "Habit";
    if (name.includes("Event")) return "Event";
    if (name.includes("Log")) return "Log";
    if (name.includes("Category")) return "Category";
    if (name.includes("Tag")) return "Tag";

    return "Other";
  };

  const getPropsedIconConcept = (name?: string) => {
    return resolveIcon(name);
  };

  const actionItemType = getActionItemType(action.name);

  useEffect(() => {
    if (actionItemType === "Tag") {
      setTagName(action.args.name);
    }
  }, [actionItemType, action.args.name]);

  return (
    <View style={[styles.chip, { borderLeftColor: action.color }]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={getActionIcon(action.name)}
          size={20}
          color={action.color}
        />
      </View>
      {actionItemType === "Category" ? (
        <>
          <Pressable onPress={() => setOpenCategoryEditor(true)}>
            <CategoryBadge
              category={
                {
                  name: action.args.name || action.extraInfo.name,
                  color:
                    action.args.hexColor || action.extraInfo?.color || "black",
                  icon:
                    action.extraInfo?.icon ||
                    getPropsedIconConcept(action.args.proposedIconConcept) ||
                    "folder",
                } as Category
              }
              size="big"
            />
          </Pressable>
          {action.args.fallbackCategoryId &&
            action.extraInfo?.fallbackCategory && (
              <>
                <Ionicons
                  name="arrow-redo-circle-outline"
                  size={30}
                  style={{ marginHorizontal: 5 }}
                  color={"black"}
                />
                <CategoryBadge
                  category={action.extraInfo.fallbackCategory}
                  size="big"
                />
              </>
            )}
          {!isConfirmed && !isExpired && openCategoryEditor && (
            <CategoryCreator
              isCreating={true}
              onClose={() => setOpenCategoryEditor(false)}
              onCreateCategory={
                async (/* name, color, icon */) => {
                  /*  await updateUserCategory({ ...editData, name, color, icon });
            setCategoryToEdit(null); */
                }
              }
              editingCategory={
                {
                  name: action.args.name || action.extraInfo.name,
                  color:
                    action.args.hexColor || action.extraInfo?.color || "black",
                  icon:
                    action.extraInfo?.icon ||
                    getPropsedIconConcept(action.args.proposedIconConcept) ||
                    "folder",
                } as Category
              }
              mode="ai"
            />
          )}
        </>
      ) : actionItemType === "Tag" ? (
        <>
          <View style={styles.tagList}>
            {action.args.names ? (
              action.args.names.map((name: string, index: any) => (
                <Pressable key={index} onPress={() => setOpenTagEditor(true)}>
                  <TagBadge tagName={name} holeColor={"white"} mode="big" />
                </Pressable>
              ))
            ) : (
              <TagBadge tagId={action.args.id} holeColor={"white"} mode="big" />
            )}
          </View>
          {!isConfirmed && !isExpired && openTagEditor && (
            <TagsEditModal
              tagToEdit="true"
              editNameValue={tagName}
              setEditNameValue={setTagName}
              onSave={() => {}}
              onClose={() => setOpenTagEditor(false)}
              mode="ai"
            />
          )}
        </>
      ) : (
        <View style={styles.actionContainer}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle} numberOfLines={1}>
              {action.args.title ||
                action.args.t ||
                action.extraInfo?.title ||
                "Deleted Item"}
            </Text>
            {action.extraInfo?.category && (
              <CategoryBadge
                category={action.extraInfo.category}
                variant="iconOnly"
              />
            )}
          </View>
          <View style={styles.tagList}>
            {action.args.tags && action.args.tags.length > 0 && (
              <TagList tags={action.args.tags} holeColor={"#ffffff"} />
            )}
          </View>
          <Text style={styles.extraInfo}>{getActionSubtitle(action)}</Text>
        </View>
      )}

      {!isConfirmed && !isExpired && (
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Ionicons name="close" size={20} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
    borderLeftWidth: 12,
    // Soft shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  //content: { flex: 1 },
  iconContainer: { marginRight: 10 },
  actionContainer: {
    flexDirection: "column",
    justifyContent: "space-between",
  },
  actionHeader: { flexDirection: "row", gap: 4 },
  actionTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  extraInfo: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  tagList: {
    //flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  removeBtn: { padding: 4, marginLeft: 10, alignItems: "flex-end" },
});
