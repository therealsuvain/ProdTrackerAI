import React, { useState, useEffect, useContext } from "react";
import { StyleSheet, View, Text } from "react-native";
import { Button, Modal, TextInput } from "react-native-paper";
import { ThemeContext } from "@/context/ThemeContext";
import { TimerLog } from "@/types/timer";
import { formatDuration } from "@/context/TimerContext";
import { withAlpha } from "@/utils/common-utils";

//!COMMENT ed out code is for duration editing
interface Props {
  visible: boolean;
  log: TimerLog | null;
  onDismiss: () => void;
  onSave: (updated: TimerLog) => void;
}

// ─── Duration parsing helpers ─────────────────────────────────────────────────

/**
 * Parses a human-typed duration string into total seconds.
 * Accepts: "90", "1:30", "1:30:00", "1h30m", "90s".
 * Returns null if unparseable — caller shows validation error.
 */
/* const parseDurationInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Plain number → treat as minutes
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 60;

  // HH:MM:SS or MM:SS
  const colonParts = trimmed.split(":");
  if (colonParts.length === 2) {
    const [m, s] = colonParts.map(Number);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  if (colonParts.length === 3) {
    const [h, m, s] = colonParts.map(Number);
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    return h * 3600 + m * 60 + s;
  }

  // "1h30m", "45m", "90s" style
  const hhmm = trimmed.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (hhmm && (hhmm[1] || hhmm[2] || hhmm[3])) {
    return (
      (parseInt(hhmm[1] ?? "0", 10) * 3600) +
      (parseInt(hhmm[2] ?? "0", 10) * 60) +
      parseInt(hhmm[3] ?? "0", 10)
    );
  }

  return null;
}; */

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimerEditModal({
  visible,
  log,
  onDismiss,
  onSave,
}: Props) {
  const { theme } = useContext(ThemeContext);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  //const [durationInput, setDurationInput] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    category?: string;
    //duration?: string;
  }>({});

  // Seed fields when a log is opened — reset on each new log
  useEffect(() => {
    if (log) {
      setTitle(log.title === "Untitled Activity"? "" : log.title);
      setCategory(log.category?? "");
      // Show current duration in a readable format as the default input value
      //setDurationInput(log.duration ? formatDuration(log.duration) : "");
      setErrors({});
    }
  }, [log?.id]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Title is required";
    // const parsed = parseDurationInput(durationInput);
    // if (parsed === null)
    //   next.duration = "Enter duration as 1h30m, 1:30, or minutes";
    // if (parsed !== null && parsed <= 0)
    //   next.duration = "Duration must be greater than 0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!log || !validate()) return;
   // const parsed = parseDurationInput(durationInput)!;
   if(category.trim().length>0) onSave({ ...log, title: title.trim(), category: category.trim() });
   else onSave({ ...log, title: title.trim() ,category: category.trim()});
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={[
        styles.modal,
        {
          backgroundColor: theme.timerDarkPrimary, // #2e3b38ff
          borderColor: theme.timerBaseTrans, // #6ac9b180
        },
      ]}
    >
      {/* Header — mirrors the informational text pattern in habit-modal */}
      <Text style={[styles.heading, { color: theme.timerBase }]}>
        Edit Session
      </Text>
      {log && (
        <Text
          style={[
            styles.subheading,
            { color: withAlpha(theme.timerBase, "88") },
          ]}
        >
          Started{" "}
          {new Date(log.startTime).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      )}

      {/* Title input */}
      <TextInput
        style={styles.verticalMargin}
        label="Session Title"
        mode="outlined"
        activeOutlineColor={theme.timerBase}
        outlineColor={theme.timerBaseTrans}
        textColor={theme.whiteBase}
        value={title}
        onChangeText={setTitle}
      />
      {errors.title && (
        <Text style={[styles.error, { color: "#ef4444" }]}>{errors.title}</Text>
      )}

      <TextInput
        style={styles.verticalMargin}
        label="Category"
        mode="outlined"
        activeOutlineColor={theme.timerBase}
        outlineColor={theme.timerBaseTrans}
        textColor={theme.whiteBase}
        value={category}
        onChangeText={setCategory}
      />
      {/*       <TextInput
        style={styles.verticalMargin}
        label="Duration"
        mode="outlined"
        activeOutlineColor={theme.timerBase}
        outlineColor={theme.timerBaseTrans}
        textColor={theme.whiteBase}
        value={durationInput}
        onChangeText={setDurationInput}
        placeholder="e.g. 1h30m  or  1:30  or  90"
        placeholderTextColor={withAlpha(theme.timerBase, "44")}
      />
      <Text style={[styles.hint, { color: withAlpha(theme.timerBase, "55") }]}>
        Enter as 1h30m · 1:30 · 90 (minutes) · or 90s
      </Text>
      {errors.duration && (
        <Text style={[styles.error, { color: "#ef4444" }]}>{errors.duration}</Text>
      )} */}

      {/* Actions — identical layout to habit-modal */}
      <Button
        style={styles.verticalMargin}
        mode="elevated"
        buttonColor={theme.timerBaseTransToo} // #2e3b3844
        textColor={theme.timerBase}
        onPress={handleSave}
      >
        Save
      </Button>
      <Button
        style={styles.verticalMargin}
        mode="elevated"
        buttonColor={theme.timerBaseTransToo}
        textColor={theme.timerBase}
        onPress={onDismiss}
      >
        Cancel
      </Button>
    </Modal>
  );
}

// ─── Styles — mirrors habit-modal.tsx StyleSheet ──────────────────────────────

const styles = StyleSheet.create({
  modal: {
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12,
    marginBottom: 12,
  },
  verticalMargin: { marginVertical: 2.5 },
  hint: { fontSize: 11, marginBottom: 4, marginLeft: 2 },
  error: { fontSize: 12, marginBottom: 4 },
});
