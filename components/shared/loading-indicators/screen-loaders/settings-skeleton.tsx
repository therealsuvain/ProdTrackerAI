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
  divider: isDark ? "#2a2a2a" : "#bcbcbc",
});

type RowType = "toggle" | "chevron" | "chevron-preview";

interface SectionConfig {
  rows: RowType[];
}

const SECTIONS: SectionConfig[] = [
  { rows: ["toggle", "toggle"] },
  { rows: ["toggle", "toggle"] },
  { rows: ["chevron", "chevron-preview", "chevron"] },
];

interface SettingsRowProps {
  type: RowType;
  base: string;
  shimmer: string;
  divider: string;
  isLast: boolean;
}

const SettingsRow = ({
  type,
  base,
  shimmer,
  divider,
  isLast,
}: SettingsRowProps) => (
  <View>
    <View style={styles.row}>
      {/* Icon */}
      <ShimmerBlock
        width={22}
        height={22}
        borderRadius={4}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.rowIcon}
      />
      {/* Label */}
      <ShimmerBlock
        width={140}
        height={16}
        borderRadius={5}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.rowLabel}
      />
      {/* Right control */}
      <View style={styles.rowRight}>
        {type === "toggle" ? (
          <ShimmerBlock
            width={48}
            height={28}
            borderRadius={14}
            baseColor={base}
            shimmerColor={shimmer}
          />
        ) : (
          <ShimmerBlock
            width={10}
            height={16}
            borderRadius={3}
            baseColor={base}
            shimmerColor={shimmer}
          />
        )}
      </View>
    </View>
    {/* Preview strip under chevron-preview rows (categories/tags) */}
    {type === "chevron-preview" && (
      <View style={styles.previewStrip}>
        {[44, 56, 44, 52, 44].map((w, i) => (
          <ShimmerBlock
            key={i}
            width={w}
            height={28}
            borderRadius={14}
            baseColor={base}
            shimmerColor={shimmer}
          />
        ))}
      </View>
    )}
    {!isLast && <View style={[styles.divider, { backgroundColor: divider }]} />}
  </View>
);

export const SettingsSkeleton = ({ isDark }: Props) => {
  const { base, shimmer, bg, divider } = useShimmerColors(isDark);

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
          width={110}
          height={26}
          borderRadius={6}
          baseColor={base}
          shimmerColor={shimmer}
          style={styles.headerTitle}
        />
      </View>

      {/* Search */}
      <ShimmerBlock
        width="100%"
        height={44}
        borderRadius={22}
        baseColor={base}
        shimmerColor={shimmer}
        style={styles.searchBar}
      />

      {/* Sections */}
      {SECTIONS.map((section, si) => (
        <View key={si} style={styles.section}>
          {/* Section label */}
          <ShimmerBlock
            width={130}
            height={13}
            borderRadius={4}
            baseColor={base}
            shimmerColor={shimmer}
            style={styles.sectionLabel}
          />
          {/* Rows */}
          {section.rows.map((rowType, ri) => (
            <SettingsRow
              key={ri}
              type={rowType}
              base={base}
              shimmer={shimmer}
              divider={divider}
              isLast={ri === section.rows.length - 1}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 52 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerTitle: { marginLeft: 12 },
  searchBar: { marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionLabel: { marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  rowIcon: { marginRight: 14 },
  rowLabel: { flex: 1 },
  rowRight: { marginLeft: 8 },
  divider: { height: 1, marginLeft: 36 },
  previewStrip: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingLeft: 36,
  },
});

export default SettingsSkeleton;
