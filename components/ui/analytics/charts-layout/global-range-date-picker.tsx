import React, { useState } from "react";
import { Modal, View, Pressable, Text, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import DateTimePicker from "@react-native-community/datetimepicker";
import { DateRangeFilter, DateRangePreset } from "@/types/analytics";

interface Props {
  visible: boolean;
  onClose: () => void;
  currentRange: DateRangeFilter;
  onApply: (range: DateRangeFilter) => void;
}

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "last90", label: "Last 90 Days" },
  { key: "allTime", label: "All Time" },
];

export const GlobalDateRangePicker = ({
  visible,
  onClose,
  currentRange,
  onApply,
}: Props) => {
  const { theme } = useTheme();
  const [draft, setDraft] = useState<DateRangeFilter>(currentRange);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(
    null,
  );

  const selectPreset = (preset: DateRangePreset) => setDraft({ preset });
  console.log("draft", draft);
  const openCustom = () =>
    setDraft({
      preset: "custom",
      customStart: draft.customStart,
      customEnd: draft.customEnd,
    });

  const handleDateConfirm = (event: any, date: Date | undefined) => {
    if (!date) return;
    const iso = date.toISOString().split("T")[0];
    setDraft((prev) => ({
      ...prev,
      preset: "custom",
      ...(pickerTarget === "start" ? { customStart: iso } : { customEnd: iso }),
    }));
    setPickerTarget(null);
  };
  //console.log("rangepicker");
  return (
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
          <Text style={[styles.title, { color: theme.text }]}>Date Range</Text>

          {PRESETS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => selectPreset(p.key)}
              style={[
                styles.presetRow,
                draft.preset === p.key && {
                  backgroundColor: (theme.blueDarkPrimary ?? "#2196F3") + "22",
                },
              ]}
            >
              <Text style={[styles.presetLabel, { color: theme.text }]}>
                {p.label}
              </Text>
              {draft.preset === p.key && (
                <Text style={{ color: theme.text ?? "#2196F3" }}>✓</Text>
              )}
            </Pressable>
          ))}

          <Pressable
            onPress={openCustom}
            style={[
              styles.presetRow,
              draft.preset === "custom" && {
                backgroundColor: (theme.taskDarkPrimary ?? "#2196F3") + "22",
              },
            ]}
          >
            <Text style={[styles.presetLabel, { color: theme.text }]}>
              Custom Range
            </Text>
            {draft.preset === "custom" && (
              <Text style={{ color: theme.taskDarkPrimary ?? "#2196F3" }}>
                ✓
              </Text>
            )}
          </Pressable>

          {draft.preset === "custom" && (
            <View style={styles.customRow}>
              <Pressable
                onPress={() => setPickerTarget("start")}
                style={[styles.customChip, { borderColor: theme.text + "33" }]}
              >
                <Text style={{ color: theme.text }}>
                  {draft.customStart ?? "Start date"}
                </Text>
              </Pressable>
              <Text style={{ color: theme.text + "80" }}>to</Text>
              <Pressable
                onPress={() => setPickerTarget("end")}
                style={[styles.customChip, { borderColor: theme.text + "33" }]}
              >
                <Text style={{ color: theme.text }}>
                  {draft.customEnd ?? "End date"}
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => {
              onApply(draft);
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

      {pickerTarget && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          onChange={handleDateConfirm}
          /*  onCancel={() => setPickerTarget(null)} */
        />
      )}
    </Modal>
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
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 14 },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  presetLabel: { fontSize: 14, fontWeight: "500" },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  customChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  applyButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  applyButtonText: { color: "white", fontWeight: "600", fontSize: 15 },
});
