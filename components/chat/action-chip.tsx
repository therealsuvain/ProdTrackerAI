import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { format } from 'date-fns';


interface Props{
  action: any;
  onRemove: ()=>void;
  isConfirmed?:boolean
}
export const ActionChip = ({ action, onRemove, isConfirmed }: Props) => {

  const getActionSubtitle = (action: any) => {
    const data = action.extraInfo || action.args; // Use extraInfo for existing, args for new
    const parts: string[] = [];


    if (action.name.includes("task")) {
      if (data.dueDate)
        parts.push(`Due: ${new Date(data.dueDate).toLocaleDateString()}`);
      if (data.priority) parts.push(`Priority: ${data.priority}`);
    }
    else if (action.name.includes("habit")) {
      if (data.streak !== undefined) parts.push(`Streak: ${data.streak}`);
      if (data.goal) parts.push(`Goal: ${data.goal}`);
    }
    else if (action.name.includes("event")) {
       if(data.startDate)
        parts.push(`${format(new Date(data.startDate),"MMM ,d")} - ${format(new Date(data.startDate),"MMM")===format(new Date(data.endDate),"MMM")?format(new Date(data.endDate),"d"):format(new Date(data.endDate),"MMM ,d")}`)
      if (data.startTime)
        //parts.push(`${data.startTime}`)
        parts.push(`${typeof(data.startTime)==='string'?data.startTime:format(data.startTime,'h:mm a')} - ${typeof(data.endTime)==='string'?data.endTime:data.endTime?format(data.endTime,'h:mm a'):""}`);
    }

    return parts.join(" | ");
  };

  const getActionIcon = (name: string) => {
    if (name.includes("add")) return "add-circle-outline"; 
    if (name.includes("delete")) return "trash-outline";
    return "pencil"; // Edit
  };

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
      //style={styles.content}
      >
        <Text style={styles.actionTitle} numberOfLines={1}>
          {action.extraInfo?.title || action.args.title || action.args.t || "New Item"}
        </Text>
        <Text style={styles.extraInfo}>{getActionSubtitle(action)}</Text>
        
      </View>

     {( !isConfirmed && <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
        <Ionicons name="close" size={20} color="#FF3B30" />
      </TouchableOpacity>)}
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
  removeBtn: { padding: 4, marginLeft: 10, alignItems:'flex-end' },
});
