import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/context-hooks/use-data";

interface TagProps {
  tagId?: string;
  tagName?: string;
  holeColor: string;
  mode?: "small" | "big";
}

export const TagBadge = ({
  tagId,
  tagName,
  holeColor,
  mode = "small",
}: TagProps) => {
  const { theme } = useContext(ThemeContext);
  const { tags } = useData();
  let label;
  if (tagId) {
    const tag = tags.find((t) => t.id === tagId);
    if (tag) {
      label = tag.name;
    } else {
      return;
    }
  } else if (tagName) {
    label = tagName;
  } else return;

  return (
    /*   <View style={[styles.tagContainer, { backgroundColor: "#404040" }]}>
      <View style={[styles.dot, { backgroundColor: "#A0A0A0" }]} />
      <Text style={[styles.tagText, { color: "#FFFFFF" }]}>{label}</Text>
    </View> */
    <View style={styles.tagContainer}>
      {/* The pointed left edge created via border manipulation */}
      <View
        style={[
          mode === "small" ? styles.triangle : styles.triangleBig,
          { borderRightColor: "#A0A0A0" },
        ]}
      />

      {/* The main rectangular body of the tag */}
      <View
        style={[
          mode === "small" ? styles.body : styles.bodyBig,
          { backgroundColor: "#A0A0A0" },
        ]}
      >
        <Text style={mode === "small" ? styles.text : styles.textBig}>
          {label}
        </Text>
      </View>

      {/* The punched hole overlapping the triangle */}
      <View
        style={[
          mode === "small" ? styles.hole : styles.holeBig,
          { backgroundColor: holeColor },
        ]}
      />
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
  triangleBig: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderRightWidth: 12, // Controls the depth of the point
    borderTopWidth: 12, // Half of the total height
    borderBottomWidth: 12, // Half of the total height
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  bodyBig: {
    height: 24, // Must equal borderTopWidth + borderBottomWidth
    justifyContent: "center",
    textAlign: "center",
    alignContent: "center",
    alignItems: "center",
    paddingRight: 8,
    paddingLeft: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  textBig: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  holeBig: {
    position: "absolute",
    left: 5, // Aligns the hole inside the triangle point
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
