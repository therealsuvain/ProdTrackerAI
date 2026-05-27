import Ionicons from "@expo/vector-icons/Ionicons";
import {
  ArrowSquareRight,
  ArrowSquareRightIcon,
  Tag,
} from "@phosphor-icons/react";
import { format } from "date-fns";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TagList } from "../shared/tags/tag-list";
import { CategoryBadge } from "../shared/categories/category-badge";

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
  //console.log("ACTION CHIP", action.args);
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

  /* const doWeHaveTags =
    (action.args.tags && action.args.tags.length > 0) ||
    (action.args.tagIds && action.args.tagIds.length > 0) ||
    false; */
  return (
    <View style={[styles.chip, { borderLeftColor: action.color }]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={getActionIcon(action.name)}
          size={20}
          color={action.color}
        />
      </View>
      <View
        style={{
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", gap: 4 }}>
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
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            width: "85%",
          }}
        >
          {action.args.tags && action.args.tags.length > 0 && (
            <TagList tags={action.args.tags} holeColor={"#ffffff"} />
          )}
        </View>
        <Text style={styles.extraInfo}>{getActionSubtitle(action)}</Text>
      </View>

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
  actionTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  extraInfo: { fontSize: 11, color: "#8E8E93", marginTop: 2 },
  removeBtn: { padding: 4, marginLeft: 10, alignItems: "flex-end" },
});
