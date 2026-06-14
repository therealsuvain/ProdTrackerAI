import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { SlideOutLeft } from "react-native-reanimated";

interface ChipContainerProps {
  color: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onRemove: () => void;
  isConfirmed?: boolean;
  isExpired?: boolean;
  children: React.ReactNode;
}

export const ChipContainer = ({
  color,
  iconName,
  onRemove,
  isConfirmed,
  isExpired,
  children,
}: ChipContainerProps) => {
  return (
    <Animated.View
      exiting={SlideOutLeft.duration(250).withInitialValues({
        transform: [{ translateX: 0 }],
      })}
      style={[styles.chip, { borderLeftColor: color }]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={iconName} size={20} color={color} />
      </View>

      {children}

      {!isConfirmed && !isExpired && (
        /*     <View
          style={{
            //flex: 1,
            borderWidth: 1,
            borderColor: "black",
            justifyContent: "flex-end",
          }}
        > */
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Ionicons name="close-circle" size={25} color="#FF3B30" />
        </TouchableOpacity>
        /* </View> */
      )}
    </Animated.View>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: { marginRight: 10 },
  contentContainer: {
    flexDirection: "row", // Force the reset back to row!
    alignItems: "center",
  },
  removeBtn: {
    //marginLeft: "auto",
    position: "absolute", // ← taken out of flow completely
    top: 4,
    right: 4,
    padding: 2,
  },
});
