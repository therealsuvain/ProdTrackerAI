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
  card: isDark ? "#252525" : "#d6d6d6",
  header: isDark ? "#252525" : "#d6d6d6",
});

// tag counts per card — static, no random, deterministic render
const TASK_CARDS = [
  { tags: 1 },
  { tags: 2 },
  { tags: 3 },
  { tags: 0 },
  { tags: 2 },
  { tags: 0 },
  { tags: 1 },
];

// Tag widths cycle — avoids all tags looking identical
const TAG_WIDTHS = [52, 68, 48, 60, 44];

interface EntityCardProps {
  tags: number;
  base: string;
  shimmer: string;
  card: string;
}
const EntityCard = ({ tags, base, shimmer, card }: EntityCardProps) => (
  <View style={[styles.card, { backgroundColor: card }]}>
    {/* Checkbox */}
    <ShimmerBlock
      width={22}
      height={22}
      borderRadius={4}
      baseColor={base}
      shimmerColor={shimmer}
      style={styles.checkbox}
    />

    {/* Content block */}
    <View style={styles.cardContent}>
      {/* Title row: name + category icon + status badge */}
      <View style={styles.titleRow}>
        <ShimmerBlock
          width={120}
          height={16}
          borderRadius={5}
          baseColor={base}
          shimmerColor={shimmer}
        />
        <ShimmerBlock
          width={22}
          height={22}
          borderRadius={11}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.titleBadge}
        />
        <ShimmerBlock
          width={52}
          height={16}
          borderRadius={5}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.titleBadge}
        />
      </View>
      {/* Due date */}
      <ShimmerBlock
        width={160}
        height={13}
        borderRadius={4}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.dueDate}
      />
      {/* Tags */}
      {tags > 0 && (
        <View style={styles.tagRow}>
          {Array.from({ length: tags }).map((_, i) => (
            <ShimmerBlock
              key={i}
              width={TAG_WIDTHS[i % TAG_WIDTHS.length]}
              height={22}
              borderRadius={11}
              baseColor={base}
              shimmerColor={shimmer}
            />
          ))}
        </View>
      )}
    </View>

    {/* Action buttons */}
    <View style={styles.actions}>
      <ShimmerBlock
        width={40}
        height={40}
        borderRadius={20}
        baseColor={base}
        shimmerColor={shimmer}
      />
      <ShimmerBlock
        width={40}
        height={40}
        borderRadius={20}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.actionGap}
      />
    </View>
  </View>
);

export const EntitySkeleton = ({ isDark }: Props) => {
  const { base, shimmer, bg, card, header } = useShimmerColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Purple header bar */}
      <View style={[styles.header, { backgroundColor: header }]}>
        <ShimmerBlock
          width={24}
          height={24}
          borderRadius={4}
          baseColor="rgba(255,255,255,0.25)"
          shimmerColor="rgba(255,255,255,0.4)"
        />
        <ShimmerBlock
          width={70}
          height={24}
          borderRadius={6}
          baseColor="rgba(255,255,255,0.25)"
          shimmerColor="rgba(255,255,255,0.4)"
          style={styles.headerTitle}
        />
      </View>

      <View style={styles.body}>
        {/* Search bar */}
        <ShimmerBlock
          width="100%"
          height={44}
          borderRadius={22}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.searchBar}
        />

        {/* Sort label */}
        <ShimmerBlock
          width={60}
          height={14}
          borderRadius={4}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.sortLabel}
        />

        {/* Task cards */}
        {TASK_CARDS.map((t, i) => (
          <EntityCard
            key={i}
            tags={t.tags}
            base={base}
            shimmer={shimmer}
            card={card}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 16,
  },
  headerTitle: { marginLeft: 12 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  searchBar: { marginBottom: 12 },
  sortLabel: { alignSelf: "center", marginBottom: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  checkbox: { marginRight: 12 },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  titleBadge: { marginLeft: 8 },
  dueDate: { marginBottom: 6 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  actions: { flexDirection: "column", gap: 8, marginLeft: 10 },
  actionGap: { marginTop: 0 },
});
