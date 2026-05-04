import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";

interface TagProps {
  label: string;
  holeColor: string;
}

export const TagBadge = ({ label, holeColor }: TagProps) => {
  const { theme } = useContext(ThemeContext);

  return (
    /*   <View style={[styles.tagContainer, { backgroundColor: "#404040" }]}>
      <View style={[styles.dot, { backgroundColor: "#A0A0A0" }]} />
      <Text style={[styles.tagText, { color: "#FFFFFF" }]}>{label}</Text>
    </View> */
    <View style={styles.tagContainer}>
      {/* The pointed left edge created via border manipulation */}
      <View style={[styles.triangle, { borderRightColor: "#A0A0A0" }]} />

      {/* The main rectangular body of the tag */}
      <View style={[styles.body, { backgroundColor: "#A0A0A0" }]}>
        <Text style={styles.text}>{label}</Text>
      </View>

      {/* The punched hole overlapping the triangle */}
      <View style={[styles.hole, { backgroundColor: holeColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  tagContainer: {
    flexDirection: "row",
    alignItems: "center",
    // margin adjustments to allow flexWrap to work cleanly in lists
    marginVertical: 1,
    marginRight: 1,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderRightWidth: 8, // Controls the depth of the point
    borderTopWidth: 8, // Half of the total height
    borderBottomWidth: 8, // Half of the total height
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  body: {
    height: 16, // Must equal borderTopWidth + borderBottomWidth
    justifyContent: "center",
    textAlign: "center",
    alignContent: "center",
    alignItems: "center",
    paddingRight: 8,
    paddingLeft: 4,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  hole: {
    position: "absolute",
    left: 4, // Aligns the hole inside the triangle point
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
