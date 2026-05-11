import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { CategoryRow } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";

export type CategoryBadgeVariant = "default" | "iconOnly";
interface CategoryBadgeProps {
  category: CategoryRow | null | undefined;
  size?: "small" | "medium";
  variant?: CategoryBadgeVariant;
}

export const CategoryBadge = ({
  category,
  size = "small",
  variant = "default",
}: CategoryBadgeProps) => {
  const { theme } = useContext(ThemeContext);

  if (!category) return null;

  const height = size === "small" ? 24 : 32;
  const fontSize = size === "small" ? 12 : 14;

  if (variant === "iconOnly") {
    return (
      <View
        style={[styles.iconOnlyContainer, { backgroundColor: category.color }]}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={12}
          color="#FFFFFF"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, borderColor: category.color }]}>
      <View
        style={[
          styles.iconOnlyContainer,
          { backgroundColor: category.color, marginRight: 6 },
        ]}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={15}
          color="#FFFFFF"
        />
      </View>
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
  iconOnlyContainer: {
    width: 20,
    height: 20,
    borderRadius: 10, // Perfect circle
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
  },
});
