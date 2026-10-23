import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { CategoryRow } from "@/db/schema";
import { Ionicons } from "@expo/vector-icons";
import { Category } from "@/types/category";
import { useCategoryStore } from "@/stores/use-category-store";

export type CategoryBadgeVariant = "default" | "iconOnly";
interface CategoryBadgeProps {
  categoryId: string | null | undefined;
  size?: "small" | "medium" | "big";
  variant?: CategoryBadgeVariant;
  dummyData?: Category;
}

export const CategoryBadge = ({
  categoryId,
  size = "small",
  variant = "default",
  dummyData,
}: CategoryBadgeProps) => {
  const { theme } = useContext(ThemeContext);

  /* const categoryId = category?.id; */

  const storeIcon = useCategoryStore((state) =>
    categoryId ? state.categoriesById[categoryId]?.icon : undefined,
  );

  const storeColor = useCategoryStore((state) =>
    categoryId ? state.categoriesById[categoryId]?.color : undefined,
  );

  const storeName = useCategoryStore((state) =>
    categoryId ? state.categoriesById[categoryId]?.name : undefined,
  );

  if (!dummyData && (!categoryId || !storeName)) return null;
  const icon = storeIcon ?? dummyData?.icon ?? "folder";
  const color = storeColor ?? dummyData?.color ?? theme.text;
  const name = storeName ?? dummyData?.name ?? "No name";
  const height = size === "small" ? 24 : size === "medium" ? 32 : 48;
  const fontSize = size === "small" ? 12 : size === "medium" ? 14 : 18;

  if (variant === "iconOnly") {
    return (
      <View
        style={[
          styles.iconOnlyContainer,
          {
            backgroundColor: `${color}33`,
            borderColor: color,
            borderWidth: 1,
          },
        ]}
      >
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={12}
          color={color}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, borderColor: color }]}>
      <View
        style={[
          styles.iconOnlyContainer,
          size === "big" && styles.bigIconOnlyContainer,
          { backgroundColor: `${color}33`, marginRight: 6 },
        ]}
      >
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={size === "big" ? 24 : 15}
          color={color}
        />
      </View>
      <Text
        style={[
          styles.text,
          { fontSize, color: size === "big" ? "black" : theme.whiteBase },
        ]}
      >
        {storeName}
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
