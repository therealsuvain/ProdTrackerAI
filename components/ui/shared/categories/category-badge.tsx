import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { CategoryRow } from "@/db/schema";

interface CategoryBadgeProps {
  category: CategoryRow | null | undefined;
  size?: "small" | "medium";
}

export const CategoryBadge = ({
  category,
  size = "small",
}: CategoryBadgeProps) => {
  const { theme } = useContext(ThemeContext);

  if (!category) return null;

  const height = size === "small" ? 24 : 32;
  const fontSize = size === "small" ? 12 : 14;

  return (
    <View style={[styles.container, { height, borderColor: category.color }]}>
      <View style={[styles.dot, { backgroundColor: category.color }]} />
      <Text style={[styles.text, { fontSize, color: theme.whiteBase }]}>
        {category.name}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 6, // Slight rounding, distinct from the pill-shaped tags
    alignSelf: "flex-start", // Prevent stretching
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontWeight: "600",
  },
});
