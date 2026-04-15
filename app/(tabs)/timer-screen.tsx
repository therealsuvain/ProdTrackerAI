import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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
import { useHaptics } from "@/hooks/use-haptics";
// Note : Timescreen is the only component where value prop is used for the TextInput instead of defaultValue
// Note ContinuedFromAbove: default Value only takes input once, then doesnt update, the reason its works in other places is because 
// Note ContinuedFromAbove: the modals re-render everytime, so default value gets feeded the latest state value and it looks ok, 
// Note ContinuedFromAbove: here though the text inputs are directly on the screen so default value doesnt update with the state change 

 
function TimerScreenInner() {
  const { theme, isDarkMode } = useContext(ThemeContext);
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
  const { triggerHaptic } = useHaptics();
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
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState(1);
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
            triggerHaptic();
          } catch {
            showToast("Couldn't delete the log. It has been restored.");
          }
        },
      },
    ]);
  };

  const handleEdit = async (updated: TimerLog) => {
    await editLog(updated);
  };

  const showModal = (log: TimerLog) => {
    setEditingLog(log);
    setModalVisible(true);
  };

  // 2. Derive the currently visible slice of data based on the page number
  const displayedLogs = useMemo(() => {
    return timerLogs.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [timerLogs, currentPage]);

  const handleLoadMore = useCallback(() => {
    // Only increment if we haven't reached the end of the array
    if (displayedLogs.length < timerLogs.length) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [displayedLogs.length, timerLogs.length]);

  const timerBaseColor = isDarkMode ? theme.timerBase : theme.timerBaseLightModeOnly;
  const EmptyState = () => (
    <View style={emptyStateStyle.emptyContainer}>
      <Ionicons name="timer" size={60} color={timerBaseColor} />
      <Text
        style={[
          emptyStateStyle.emptyTitle,
          { color: withAlpha(timerBaseColor, "99") },
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
          { borderColor: withAlpha(timerBaseColor, "33") },
        ]}
      >
        <Text
          style={[emptyStateStyle.suggestionText, { color: timerBaseColor }]}
        >
          Logs can have categories and also have lap details
        </Text>
        <Text
          style={[emptyStateStyle.suggestionText, { color: timerBaseColor }]}
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
          accent={timerBaseColor}
        />
        <View
          style={[
            styles.statDivider,
            { backgroundColor: withAlpha(timerBaseColor, "33") },
          ]}
        />
        <StatCell
          label="This week"
          value={formatDuration(weekTotal)}
          accent={timerBaseColor}
        />
        {topCategory && (
          <>
            <View
              style={[
                styles.statDivider,
                { backgroundColor: withAlpha(timerBaseColor, "33") },
              ]}
            />
            <StatCell
              label="Top category"
              value={topCategory}
              accent={timerBaseColor}
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
          value={title}
          textColor={theme.text}
          onChangeText={setTitle}

          style={[styles.input,{backgroundColor: theme.background }]}
          mode="outlined"
          theme={{
            colors: {
              onSurfaceVariant: withAlpha(timerBaseColor, "90"),
          }}}
          activeOutlineColor={theme.timerBase}
          outlineColor={timerBaseColor}
        />

        <TextInput
          placeholder="Category (optional)"
          value={category}
          textColor={theme.text}
          onChangeText={setCategory}
          style={[styles.input, styles.categoryInput, {backgroundColor: theme.background }]}
          mode="outlined"
          theme={{
            colors: {
              onSurfaceVariant:  withAlpha(timerBaseColor, "90"),
          }}}
          activeOutlineColor={theme.timerBase}
          outlineColor={timerBaseColor}
        />
      </View>
      <View style={styles.categoryRow}>
        {/* Last-used suggestion chip — only shown when category field is empty */}
        {!category && lastUsedCategory && (
          <TouchableOpacity
            style={[styles.suggestionChip, { borderColor: timerBaseColor }]}
            onPress={() => setCategory(lastUsedCategory)}
            activeOpacity={0.7}
          >
            <Text style={[styles.suggestionText, { color: timerBaseColor }]}>
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
          <XButton
            icon="play"
            mode="timer"
            size="big"
            onPress={() => {
              triggerHaptic();
              start();
            }}
          />
        ) : (
          <>
            <XButton icon="pause" mode="timer" size="big" onPress={pause} />
            <XButton
              icon="stop"
              mode="timer"
              size="big"
              onPress={() => {
                triggerHaptic();
                stop();
              }}
            />
            {mode === "stopwatch" && (
              <XButton icon="flag" mode="timer" size="big" onPress={lap} />
            )}
            <XButton icon="refresh" mode="timer" size="big" onPress={reset} />
          </>
        )}
      </View>
      {/* ── Lap splits inline display ── */}
      {laps.length > 0 && (
        <View
          style={[
            styles.lapsContainer,
            { borderColor: withAlpha(timerBaseColor, "33") },
          ]}
        >
          {laps.map((lapTime, idx) => {
            const splitDuration = idx === 0 ? lapTime : lapTime - laps[idx - 1];
            return (
              <View key={idx} style={styles.lapRow}>
                <Text
                  style={[
                    styles.lapLabel,
                    { color: withAlpha(timerBaseColor, "99") },
                  ]}
                >
                  Lap {idx + 1}
                </Text>
                <Text style={[styles.lapValue, { color: timerBaseColor }]}>
                  {formatDuration(splitDuration)}
                </Text>
                <Text
                  style={[
                    styles.lapTotal,
                    { color: withAlpha(timerBaseColor, "66") },
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
            { backgroundColor: withAlpha(timerBaseColor, "99") },
          ]}
        />
        <Text style={[styles.logDividerLabel, { color: timerBaseColor }]}>
          Recent Logs
        </Text>
        <View
          style={[
            styles.logDividerLine,
            { backgroundColor: withAlpha(timerBaseColor, "99") },
          ]}
        />
      </View>

      <FlatList
        data={displayedLogs}
        keyExtractor={(item) => item.id}
        style={{ width: "95%" }}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5} // Triggers when user is halfway through the last visible screen
        initialNumToRender={15} // How many items to render in the exact first batch
        maxToRenderPerBatch={15} // Limits the amount rendered per scroll chunk to keep JS thread fast
        windowSize={5} // (Default is 21) Lowering this saves RAM by unmounting views far off-screen
        renderItem={({ item }) => (
          <TimerLogItem
            log={item}
            onDelete={() => handleDelete(item.id)}
            onEdit={() => showModal(item)}
          />
        )}
        ListEmptyComponent={EmptyState}
        ListFooterComponent={() => {
          if (displayedLogs.length >= timerLogs.length) return null;
          return (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" />
            </View>
          );
        }}
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
    marginBottom: 8,
  },
  statCell: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  statDivider: { width: 2.5, marginVertical: 4 },

  input: { width: "50%", marginBottom: 10, marginHorizontal: 8 },

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
