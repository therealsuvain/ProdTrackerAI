import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
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
  accent: isDark ? "#3a3210" : "#e8dfc0",
});

// Heatmap grid: 3 rows x 18 columns, matches the "Activity for last 60 days" strip
const HEATMAP_ROWS = 3;
const HEATMAP_COLS = 18;

// Tile plan mirrors the bento layout in the reference screenshot:
// two half-width tiles, one full-width, two half-width, one full-width (partial)
const TILE_PLAN = [
  { type: "half-pair" as const, height: 320 },
  { type: "full" as const, height: 420 },
  { type: "half-pair" as const, height: 340 },
  { type: "full" as const, height: 260 }, // execution funnel, cut off at bottom
];

interface TileHeaderProps {
  base: string;
  shimmer: string;
  accent: string;
  titleWidth: number;
}

const TileHeader = ({ base, shimmer, accent, titleWidth }: TileHeaderProps) => (
  <View style={styles.tileHeaderRow}>
    <ShimmerBlock
      width={18}
      height={18}
      borderRadius={5}
      baseColor={accent}
      shimmerColor={shimmer}
    />
    <ShimmerBlock
      width={titleWidth}
      height={16}
      borderRadius={4}
      baseColor={base}
      shimmerColor={shimmer}
      style={styles.tileTitleSpacing}
    />
  </View>
);

interface ChartTileProps {
  base: string;
  shimmer: string;
  card: string;
  accent: string;
  height: number;
  titleWidth: number;
  style?: object;
}

const ChartTileSkeleton = ({
  base,
  shimmer,
  card,
  accent,
  height,
  titleWidth,
  style,
}: ChartTileProps) => (
  <View style={[styles.tile, { backgroundColor: card, height }, style]}>
    <TileHeader
      base={base}
      shimmer={shimmer}
      accent={accent}
      titleWidth={titleWidth}
    />
    <View style={styles.chartBody}>
      <ShimmerBlock
        width="100%"
        height={height - 70}
        borderRadius={10}
        baseColor={base}
        shimmerColor={shimmer}
      />
    </View>
  </View>
);

export const AnalyticsSkeleton = ({ isDark }: Props) => {
  const { base, shimmer, bg, card, header, accent } = useShimmerColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: header }]}>
        <ShimmerBlock
          width={28}
          height={28}
          borderRadius={6}
          baseColor={base}
          shimmerColor={shimmer}
        />
        <ShimmerBlock
          width={140}
          height={24}
          borderRadius={6}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.headerTitle}
        />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Activity summary label */}
        <ShimmerBlock
          width={220}
          height={14}
          borderRadius={4}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.sectionLabel}
        />
        <ShimmerBlock
          width={280}
          height={12}
          borderRadius={4}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.sectionSubLabel}
        />

        {/* Heatmap grid */}
        <View style={styles.heatmapGrid}>
          {Array.from({ length: HEATMAP_ROWS }).map((_, row) => (
            <View key={row} style={styles.heatmapRow}>
              {Array.from({ length: HEATMAP_COLS }).map((_, col) => (
                <ShimmerBlock
                  key={col}
                  width={16}
                  height={16}
                  borderRadius={4}
                  baseColor={base}
                  shimmerColor={shimmer}
                  style={styles.heatmapCell}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Less/More legend */}
        <View style={styles.legendRow}>
          <ShimmerBlock
            width={30}
            height={10}
            borderRadius={3}
            baseColor={base}
            shimmerColor={shimmer}
          />
          <View style={styles.legendSwatches}>
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerBlock
                key={i}
                width={12}
                height={12}
                borderRadius={3}
                baseColor={base}
                shimmerColor={shimmer}
                style={styles.legendSwatch}
              />
            ))}
          </View>
          <ShimmerBlock
            width={34}
            height={10}
            borderRadius={3}
            baseColor={base}
            shimmerColor={shimmer}
          />
        </View>

        {/* Chart tiles */}
        {TILE_PLAN.map((tile, i) =>
          tile.type === "half-pair" ? (
            <View key={i} style={styles.tileRow}>
              <ChartTileSkeleton
                base={base}
                shimmer={shimmer}
                card={card}
                accent={accent}
                height={tile.height}
                titleWidth={90}
                style={styles.halfTile}
              />
              <ChartTileSkeleton
                base={base}
                shimmer={shimmer}
                card={card}
                accent={accent}
                height={tile.height}
                titleWidth={100}
                style={styles.halfTile}
              />
            </View>
          ) : (
            <ChartTileSkeleton
              key={i}
              base={base}
              shimmer={shimmer}
              card={card}
              accent={accent}
              height={tile.height}
              titleWidth={150}
              style={styles.fullTile}
            />
          ),
        )}
      </ScrollView>

      {/* Floating customize FAB */}
      <View style={[styles.fab, { backgroundColor: card }]}>
        <ShimmerBlock
          width={24}
          height={24}
          borderRadius={6}
          baseColor={base}
          shimmerColor={shimmer}
        />
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
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { marginBottom: 8 },
  sectionSubLabel: { marginBottom: 14 },
  heatmapGrid: { marginBottom: 8 },
  heatmapRow: { flexDirection: "row", marginBottom: 6 },
  heatmapCell: { marginRight: 6 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  legendSwatches: { flexDirection: "row", marginHorizontal: 8 },
  legendSwatch: { marginRight: 4 },
  tileRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  halfTile: { flex: 1 },
  fullTile: { width: "100%", marginBottom: 16 },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14,
  },
  tileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  tileTitleSpacing: { marginLeft: 10 },
  chartBody: { flex: 1, justifyContent: "center", alignItems: "center" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
