import React from "react";
import { View, StyleSheet } from "react-native";
import { ShimmerBlock } from "./shimmer-block";

interface Props {
  isDark: boolean;
}

const useShimmerColors = (isDark: boolean) => ({
  base: isDark ? "#333333" : "#b1b0b0",
  shimmer: isDark ? "#555555" : "#d4d4d4",
  bg: isDark ? "#1b1b1b" : "#c7c7c7",
});

// Static bubble config — widths/alignments baked in so no runtime computation
const BUBBLES = [
  { align: "flex-start", width: "72%", height: 56 },
  { align: "flex-end", width: "55%", height: 40 },
  { align: "flex-start", width: "80%", height: 72 },
  { align: "flex-end", width: "48%", height: 40 },
  { align: "flex-start", width: "65%", height: 56 },
  { align: "flex-end", width: "60%", height: 56 },
  { align: "flex-start", width: "75%", height: 40 },
] as const;

export const ChatSkeleton = ({ isDark }: Props) => {
  const { base, shimmer, bg } = useShimmerColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <ShimmerBlock
          width={24}
          height={24}
          borderRadius={4}
          baseColor={base}
          shimmerColor={shimmer}
        />
        <ShimmerBlock
          width={80}
          height={22}
          borderRadius={6}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.headerTitle}
        />
      </View>

      {/* Search bar */}
      <ShimmerBlock
        width="100%"
        height={44}
        borderRadius={22}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.searchBar}
      />

      {/* Chat bubbles */}
      <View style={styles.bubbleArea}>
        {BUBBLES.map((b, i) => (
          <View key={i} style={[styles.bubbleRow, { justifyContent: b.align }]}>
            <ShimmerBlock
              width={b.width}
              height={b.height}
              borderRadius={16}
              baseColor={base}
              shimmerColor={shimmer}
            />
          </View>
        ))}
      </View>

      {/* Input bar */}
      <View style={styles.inputRow}>
        <ShimmerBlock
          width="78%"
          height={44}
          borderRadius={22}
          baseColor={base}
          shimmerColor={shimmer}
        />
        <ShimmerBlock
          width={44}
          height={44}
          borderRadius={22}
          baseColor={base}
          shimmerColor={shimmer}
        />
        <ShimmerBlock
          width={44}
          height={44}
          borderRadius={22}
          baseColor={base}
          shimmerColor={shimmer}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 52 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerTitle: { marginLeft: 12 },
  searchBar: { marginBottom: 20 },
  bubbleArea: { flex: 1, gap: 12 },
  bubbleRow: { flexDirection: "row" },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
});
