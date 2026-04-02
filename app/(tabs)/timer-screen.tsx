import Ionicons from "@expo/vector-icons/Ionicons";
import { useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
} from "react-native";

import { Portal, TextInput } from "react-native-paper";

import TimerDisplay from "@/components/ui/timer-logs/time-display/time-display";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { XButton } from "@/components/ui/x-button";
import TimerEditModal from "@/components/modal/timer-modal";
import { ThemeContext } from "@/context/ThemeContext";
import { formatDuration } from "@/context/TimerContext";
import { useTimer } from "@/hooks/use-timer";
import { TimerLog } from "@/types/timer";
import { getTodayISO, withAlpha, getWeekStartISO } from "@/utils/common-utils";
import { ScreenErrorBoundary } from "@/components/screen-error-boundary";
import { DbErrorToast, useDbErrorToast } from "@/components/db-error-toast";
import { useLogs } from "@/hooks/use-logs";

function TimerScreenInner() {
  const { theme } = useContext(ThemeContext);
  const { timerLogs, setTimerLogs, addLog, removeLog, editLog } = useLogs();
  //const addLog = (log : TimerLog) => setTimerLogs([...timerLogs, log]);
  const {
    time,
    isRunning,
    title,
    category,
    laps,
    lap,
    setTitle,
    setCategory,
    mode,
    countdownTarget,
    toggleMode,
    setCountdownTarget,
    start,
    pause,
    stop,
    reset,
  } = useTimer();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<TimerLog | null>(null);
  const { toastError, showToast, dismissToast } = useDbErrorToast();
  const { todayTotal, weekTotal, topCategory } = useMemo(() => {
    const todayISO = getTodayISO();
    const weekStartISO = getWeekStartISO();

    let todayTotal = 0;
    let weekTotal = 0;
    const categoryTotals: Record<string, number> = {};

    for (const log of timerLogs) {
      if (!log.duration) continue;
      const logDate = log.startTime.split("T")[0];
      // typeof log.startTime === "string"
      //   ? log.startTime.split("T")[0]
      //   : log.startTime.toString().split("T")[0];

      if (logDate === todayISO) todayTotal += log.duration;
      if (logDate >= weekStartISO) {
        weekTotal += log.duration;
        if (log.category) {
          categoryTotals[log.category] =
            (categoryTotals[log.category] ?? 0) + log.duration;
        }
      }
    }

    // Top category this week by total time
    const topCategory =
      Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ??
      null;

    return { todayTotal, weekTotal, topCategory };
  }, [timerLogs]);
//TODO No lap button in countdown mode - remove it
  // ── Last-used category suggestion ────────────────────────────────────────
  // Find the most recently saved log that has a category — show as a
  // one-tap suggestion chip so the user doesn't have to retype it.
  const lastUsedCategory = useMemo(() => {
    for (let i = timerLogs.length - 1; i >= 0; i--) {
      if (timerLogs[i].category) return timerLogs[i].category!;
    }
    return null;
  }, [timerLogs]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Log", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await removeLog(id);
          } catch {
            showToast("Couldn't delete the log. It has been restored.");
          }
        },
      },
    ]);
  };

  const handleEdit = async(updated: TimerLog) => {
   await editLog(updated);
  };

  const showModal = (log: TimerLog) => {
    setEditingLog(log);
    setModalVisible(true);
  };
  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <Ionicons name="timer" size={60} color={theme.timerBase} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(theme.timerBase, "99") },
        ]}
      >
        This is your timer logs page
      </Text>
      <Text style={emptyStateStyle.emptySubtitle}>
        Added logs will be shown here
      </Text>
      <View
        style={[
          emptyStateStyle.suggestionBox,
          { borderColor: withAlpha(theme.timerBase, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: theme.timerBase }]}
        >
          Logs can have categories and also have lap details
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: theme.timerBase }]}
        >
          You can switch mode to countdown by long pressing the clock
        </Text>
      </View>
    </View>
  );
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Stats row (checkpoint 10) ── */}
      <View style={styles.statsRow}>
        <StatCell
          label="Today"
          value={formatDuration(todayTotal)}
          accent={theme.timerBase}
        />
        <View
          style={[
            styles.statDivider,
            { backgroundColor: withAlpha(theme.timerBase, "33") },
          ]}
        />
        <StatCell
          label="This week"
          value={formatDuration(weekTotal)}
          accent={theme.timerBase}
        />
        {topCategory && (
          <>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: withAlpha(theme.timerBase, "33") },
              ]}
            />
            <StatCell
              label="Top category"
              value={topCategory}
              accent={theme.timerBase}
            />
          </>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextInput
          placeholder="Activity name"
          defaultValue={title}
          onChangeText={setTitle}
          style={styles.input}
          mode="outlined"
          activeOutlineColor={theme.timerBase}
        />
        <TextInput
          placeholder="Category (optional)"
          defaultValue={category}
          onChangeText={setCategory}
          style={[styles.input, styles.categoryInput]}
          mode="outlined"
          activeOutlineColor={theme.timerBase}
        />
      </View>

      <View style={styles.categoryRow}>
        {/* Last-used suggestion chip — only shown when category field is empty */}
        {!category && lastUsedCategory && (
          <TouchableOpacity
            style={[styles.suggestionChip, { borderColor: theme.timerBase }]}
            onPress={() => setCategory(lastUsedCategory)}
            activeOpacity={0.7}
          >
            <Text style={[styles.suggestionText, { color: theme.timerBase }]}>
              ↩ {lastUsedCategory}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TimerDisplay
        time={time}
        mode={mode}
        countdownTarget={countdownTarget}
        isRunning={isRunning}
        onToggleMode={toggleMode}
        onCountdownTargetChange={setCountdownTarget}
      />

      {/* Mode hint below the circle 
          <Text style={[styles.modeHint, { color: theme.timerBase }]}>
            {isRunning
              ? ""
              : `Hold circle to switch to ${mode === "stopwatch" ? "countdown" : "stopwatch"}`}
          </Text>*/}
      <View style={styles.buttons}>
        {!isRunning ? (
          <XButton icon="play" mode="timer" size="big" onPress={start} />
        ) : (
          <>
            <XButton icon="pause" mode="timer" size="big" onPress={pause} />
            <XButton icon="stop" mode="timer" size="big" onPress={stop} />
            <XButton icon="flag" mode="timer" size="big" onPress={lap} />
            <XButton icon="refresh" mode="timer" size="big" onPress={reset} />
          </>
        )}
      </View>
      {/* ── Lap splits inline display ── */}
      {laps.length > 0 && (
        <View
          style={[
            styles.lapsContainer,
            { borderColor: withAlpha(theme.timerBase, "33") },
          ]}
        >
          {laps.map((lapTime, idx) => {
            const splitDuration = idx === 0 ? lapTime : lapTime - laps[idx - 1];
            return (
              <View key={idx} style={styles.lapRow}>
                <Text
                  style={[
                    styles.lapLabel,
                    { color: withAlpha(theme.timerBase, "99") },
                  ]}
                >
                  Lap {idx + 1}
                </Text>
                <Text style={[styles.lapValue, { color: theme.timerBase }]}>
                  {formatDuration(splitDuration)}
                </Text>
                <Text
                  style={[
                    styles.lapTotal,
                    { color: withAlpha(theme.timerBase, "66") },
                  ]}
                >
                  {formatDuration(lapTime)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.logDividerContainer}>
        <View
          style={[
            styles.logDividerLine,
            { backgroundColor: withAlpha(theme.timerBase, "99") },
          ]}
        />
        <Text style={[styles.logDividerLabel, { color: theme.timerBase }]}>
          Recent Logs
        </Text>
        <View
          style={[
            styles.logDividerLine,
            { backgroundColor: withAlpha(theme.timerBase, "99") },
          ]}
        />
      </View>
      <FlatList
        data={timerLogs.slice(-10).toReversed()}
        keyExtractor={(item) => item.id}
        style={{ width: "95%" }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TimerLogItem
            log={item}
            onDelete={() => handleDelete(item.id)}
            onEdit={() => showModal(item)}
          />
        )}
        ListEmptyComponent={EmptyState}
      />
      <DbErrorToast error={toastError} onDismiss={dismissToast} />
      <Portal>
        <TimerEditModal
          visible={modalVisible}
          log={editingLog}
          onDismiss={() => {
            setModalVisible(false);
            setEditingLog(null);
          }}
          onSave={(updated) => {
            handleEdit(updated);
            setModalVisible(false);
            setEditingLog(null);
          }}
        />
      </Portal>
    </View>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

export default function TimerScreen() {
  return (
    <ScreenErrorBoundary screenName="Timer">
      <TimerScreenInner />
    </ScreenErrorBoundary>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: "center" },
  buttons: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 2,
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  statDivider: { width: 1, marginVertical: 4 },

  input: { width: "50%", marginBottom: 10, marginHorizontal: 4 },

  categoryRow: { width: "100%", marginBottom: 6 },
  categoryInput: { marginBottom: 10 },
  suggestionChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 10,
  },
  suggestionText: { fontSize: 12, fontWeight: "600" },
  modeHint: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  lapsContainer: {
    width: "95%",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  lapLabel: { fontSize: 12, flex: 1 },
  lapValue: { fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" },
  lapTotal: { fontSize: 11, flex: 1, textAlign: "right" },

  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  logDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logDividerLine: {
    flex: 1, // each line takes equal remaining space
    height: 1,
  },
  logDividerLabel: {
    marginHorizontal: 6,
    fontSize: 14,
    fontWeight: "600",
  },
});

const emptyStateStyle = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "5%",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  suggestionBox: {
    marginTop: 30,
    width: "100%",
    borderRadius: 15,
    padding: 15,
    borderWidth: 2,
  },
  suggestionText: {
    fontSize: 13,
    marginVertical: 5,
    textAlign: "center",
  },
});
