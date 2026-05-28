import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { CategoryRow } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { cat } from "@huggingface/transformers";

export type CategoryBadgeVariant = "default" | "iconOnly";
interface CategoryBadgeProps {
  category: CategoryRow | null | undefined;
  size?: "small" | "medium" | "big";
  variant?: CategoryBadgeVariant;
}

export const CategoryBadge = ({
  category,
  size = "small",
  variant = "default",
}: CategoryBadgeProps) => {
  const { theme } = useContext(ThemeContext);

  if (!category) return null;

  const height = size === "small" ? 24 : size === "medium" ? 32 : 48;
  const fontSize = size === "small" ? 12 : size === "medium" ? 14 : 18;

  if (variant === "iconOnly") {
    return (
      <View
        style={[
          styles.iconOnlyContainer,
          {
            backgroundColor: `${category.color}33`,
            borderColor: category.color,
            borderWidth: 1,
          },
        ]}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={12}
          color={category.color}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, borderColor: category.color }]}>
      <View
        style={[
          styles.iconOnlyContainer,
          size === "big" && styles.bigIconOnlyContainer,
          { backgroundColor: `${category.color}33`, marginRight: 6 },
        ]}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={size === "big" ? 24 : 15}
          color={category.color}
        />
      </View>
      <Text
        style={[
          styles.text,
          { fontSize, color: size === "big" ? "black" : theme.whiteBase },
        ]}
      >
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
  bigIconOnlyContainer: {
    width: 36,
    height: 36,
    borderRadius: 18, // Perfect circle
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontWeight: "600",
  },
});
