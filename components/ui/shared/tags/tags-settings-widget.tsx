import React, { useContext, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/context-hooks/use-data"; // Adjust to your context
import { TagBadge } from "./tag-badge";

export const TagSettingsWidget = () => {
  const { theme } = useContext(ThemeContext);
  const { tags } = useData();

  // 1. Fetch Top Tags (e.g., top 14 to ensure we have enough for 2 rows)
  const topTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 14);
  }, [tags]);

  // 2. Split into two rows for the staggered horizontal scroll
  const { row1, row2 } = useMemo(() => {
    const mid = Math.ceil(topTags.length / 2);
    return {
      row1: topTags.slice(0, mid),
      row2: topTags.slice(mid),
    };
  }, [topTags]);

  const renderTagPill = (tag: any) => (
    <Pressable key={tag.id}>
      <TagBadge
        key={tag.id}
        tagId={tag.id}
        tagName={tag.name}
        holeColor={theme.background}
        mode={"big"}
      />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.rowsContainer}>
          <View style={styles.row}>{row1.map(renderTagPill)}</View>
          <View style={styles.row}>{row2.map(renderTagPill)}</View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16,
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
  scrollContent: {
    paddingRight: 16,
  },
  rowsContainer: {
    gap: 6, // Vertical space between the two rows
  },
  row: {
    flexDirection: "row",
    gap: 4, // Horizontal space between pills
  },
  tagPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
