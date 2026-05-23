import React, { useContext, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";
import { CategoryCreator } from "@/components/ui/shared/categories/category-creation-view"; // Adjust path as needed

export const CategorySettingsWidget = () => {
  const { theme } = useContext(ThemeContext);
  const { categories, addCategory } = useData(); // Or wherever your DAO/Context lives
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);

  // 1. Fetch Top 7 Categories
  const topCategories = useMemo(() => {
    return [...categories].sort((a, b) => b.count - a.count).slice(0, 7);
  }, [categories]);

  // 2. Handle Creation directly from Settings
  const handleCreateCategory = async (
    name: string,
    color: string,
    icon: string,
  ) => {
    // Call your actual DAO insertion here
    if (addCategory) {
      await addCategory(name, color, icon);
    }
    setIsCreating(false);
  };

  return (
    <View style={styles.container}>
      {/* 1. The Anchor Header */}
      {/*    <Pressable
        style={styles.headerAnchor}
        onPress={() => router.push("/settings/category/category-settings")}
      >
        <Text style={[styles.headerTitle, { color: theme.whiteBase }]}>
          CATEGORY MANAGEMENT
        </Text>
        <Ionicons name="chevron-forward" size={25} color={theme.whiteBase} />
      </Pressable> */}

      {/* 2. The Inline Icon Palette */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.paletteContainer}
      >
        {topCategories.map((category) => (
          <Pressable
            key={category.id}
            style={[
              styles.iconCircle,
              {
                backgroundColor: `${category.color}26`,
                borderColor: category.color,
                borderWidth: 1,
              },
            ]}
            // Optional: If they tap one here, you could navigate directly to its detail modal,
            // or just let it be decorative and force them to the main page to edit.
            //onPress={() => router.push(`/settings/categories?openId=${category.id}`)}
          >
            <Ionicons
              name={category.icon as any}
              size={25}
              color={category.color}
            />
          </Pressable>
        ))}

        {/* 3. The (+) Add Button */}
        <Pressable
          style={[
            styles.iconCircle,
            styles.addButton,
            { borderColor: theme.greyBasePrimary },
          ]}
          onPress={() => setIsCreating(true)}
        >
          <Ionicons name="add" size={24} color={theme.whiteBase} />
        </Pressable>
      </ScrollView>

      {/* 4. The Creation Modal Overlay */}
      {isCreating && (
        <View style={styles.creationOverlay}>
          <View
            style={[styles.creationCard, { backgroundColor: theme.background }]}
          >
            <CategoryCreator
              isCreating={true}
              onClose={() => setIsCreating(false)}
              onCreateCategory={handleCreateCategory}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16, // Assuming your Settings page has edge padding
  },
  headerAnchor: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  paletteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // Spacing between circles
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22, // Perfect circle
    justifyContent: "center",
    alignItems: "center",
    // Optional: Add a subtle shadow or border here if your dark mode needs contrast
  },
  addButton: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
    borderStyle: "dashed", // Gives it that "empty slot" feel
  },
  creationOverlay: {
    position: "absolute",
    top: -100,
    bottom: -500,
    left: -20,
    right: -20, // Covers the screen
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  creationCard: {
    width: "90%",
    borderRadius: 16,
    padding: 20,
  },
});
