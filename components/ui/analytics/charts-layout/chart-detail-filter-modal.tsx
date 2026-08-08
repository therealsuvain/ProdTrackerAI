import React, { useState } from "react";
import {
  Modal,
  View,
  Pressable,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { DateRangeFilter, AdvancedFilter } from "@/types/analytics";
import { CHART_ADVANCED_FIELDS } from "../charts-registry";
import { GlobalDateRangePicker } from "./global-range-date-picker";

interface Props {
  visible: boolean;
  onClose: () => void;
  chartId: string;
  currentDateRange: DateRangeFilter;
  currentAdvanced?: AdvancedFilter;
  availableTags: { id: string; name: string }[];
  availableCategories: { id: string; name: string }[];
  onApplyDateRange: (range: DateRangeFilter) => void;
  onApplyAdvanced: (advanced: AdvancedFilter) => void;
}

const PRIORITIES: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
const PRESET_LABELS: Record<string, string> = {
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  last90: "Last 90 Days",
  allTime: "All Time",
  custom: "Custom Range",
};
export const ChartFilterModal = ({
  visible,
  onClose,
  chartId,
  currentDateRange,
  currentAdvanced,
  availableTags,
  availableCategories,
  onApplyDateRange,
  onApplyAdvanced,
}: Props) => {
  const { theme } = useTheme();
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [draft, setDraft] = useState<AdvancedFilter>(currentAdvanced ?? {});

  const fields = CHART_ADVANCED_FIELDS[chartId] ?? [];

  const toggle = <K extends keyof AdvancedFilter>(key: K, id: string) => {
    setDraft((prev) => {
      const list = (prev[key] as string[] | undefined) ?? [];
      const next = list.includes(id)
        ? list.filter((v) => v !== id)
        : [...list, id];
      return { ...prev, [key]: next };
    });
  };

  const Chip = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.text + "33" },
        active && {
          backgroundColor: (theme.taskDarkPrimary ?? "#2196F3") + "33",
          borderColor: theme.taskDarkPrimary ?? "#2196F3",
        },
      ]}
    >
      <Text style={{ color: theme.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: theme.background ?? "#1C1C1E",
                borderColor: theme.text + "1A",
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: theme.text }]}>
                Filter Chart
              </Text>
              <Pressable onPress={onClose} style={styles.closeIcon}>
                <Text style={{ color: theme.text, fontWeight: "600" }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.sectionLabel, { color: theme.text + "99" }]}>
                DATE RANGE
              </Text>
              <Pressable
                onPress={() => setDatePickerVisible(true)}
                style={[styles.dateChip, { borderColor: theme.text + "33" }]}
              >
                <Text style={{ color: theme.text }}>
                  {currentDateRange.preset === "custom"
                    ? `${currentDateRange.customStart} – ${currentDateRange.customEnd}`
                    : PRESET_LABELS[currentDateRange.preset]}
                </Text>
              </Pressable>

              {fields.includes("priority") && (
                <>
                  <Text
                    style={[styles.sectionLabel, { color: theme.text + "99" }]}
                  >
                    PRIORITY
                  </Text>
                  <View style={styles.chipRow}>
                    {PRIORITIES.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        active={!!draft.priorities?.includes(p)}
                        onPress={() => toggle("priorities", p)}
                      />
                    ))}
                  </View>
                </>
              )}

              {fields.includes("categories") && (
                <>
                  <Text
                    style={[styles.sectionLabel, { color: theme.text + "99" }]}
                  >
                    CATEGORY
                  </Text>
                  <View style={styles.chipRow}>
                    {availableCategories.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        active={!!draft.categoryIds?.includes(c.id)}
                        onPress={() => toggle("categoryIds", c.id)}
                      />
                    ))}
                  </View>
                </>
              )}

              {fields.includes("tags") && (
                <>
                  <Text
                    style={[styles.sectionLabel, { color: theme.text + "99" }]}
                  >
                    TAGS
                  </Text>
                  <View style={styles.chipRow}>
                    {availableTags.map((t) => (
                      <Chip
                        key={t.id}
                        label={t.name}
                        active={!!draft.tagIds?.includes(t.id)}
                        onPress={() => toggle("tagIds", t.id)}
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <Pressable
              onPress={() => {
                onApplyAdvanced(draft);
                onClose();
              }}
              style={[
                styles.applyButton,
                { backgroundColor: theme.taskDarkPrimary ?? "#2196F3" },
              ]}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <GlobalDateRangePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        currentRange={currentDateRange}
        onApply={onApplyDateRange}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "80%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700" },
  closeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  dateChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  applyButton: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: { color: "white", fontWeight: "600", fontSize: 15 },
});
