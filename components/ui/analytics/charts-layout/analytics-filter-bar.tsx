// analytics-filter-bar.tsx
import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { DateRangeFilter } from "@/types/analytics";
import { useFiltersStore } from "@/hooks/use-filters-store";

interface AnalyticsFilterBarProps {
  onOpenDatePicker: () => void;
  onOpenFilterModal: () => void;
}

const PRESET_LABELS: Record<string, string> = {
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  last90: "Last 90 Days",
  allTime: "All Time",
  custom: "Custom Range",
};

export const AnalyticsFilterBar = ({
  onOpenDatePicker,
  onOpenFilterModal,
}: AnalyticsFilterBarProps) => {
  const dateFormatter = (label?: string) => {
    if (!label) return "";
    const date = new Date(label);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };
  const { theme } = useTheme();
  const globalDateRange = useFiltersStore((s) => s.global.dateRange);
  const label =
    globalDateRange.preset === "custom"
      ? `${dateFormatter(globalDateRange.customStart)} – ${dateFormatter(globalDateRange.customEnd)}`
      : PRESET_LABELS[globalDateRange.preset];
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onOpenDatePicker}
        style={[
          styles.chip,
          { backgroundColor: theme.background, borderColor: theme.text + "1A" },
        ]}
      >
        <Text style={[styles.chipText, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.chevron, { color: theme.text + "80" }]}>▾</Text>
      </Pressable>

      <Pressable
        onPress={onOpenFilterModal}
        style={[
          styles.iconButton,
          { backgroundColor: theme.background, borderColor: theme.text + "1A" },
        ]}
      >
        <Text style={[styles.iconText, { color: theme.text }]}>⚙</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 6,
  },
  chevron: {
    fontSize: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 16,
  },
});
