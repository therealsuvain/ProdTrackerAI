import { Ionicons } from "@expo/vector-icons";
import { useContext, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TextInput } from "react-native-paper";
import { Provider } from "react-native-paper";

import TimerDisplay from "@/components/ui/timer-logs/time-display";
import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
import { XButton } from "@/components/ui/x-button";
import { ThemeContext } from "@/context/ThemeContext";
import { formatDuration } from "@/context/TimerContext";
import { useData } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { TimerLog } from "@/types/timer";
import { getTodayISO, withAlpha, getWeekStartISO } from "@/utils/common-utils";



export default function TimerScreen() {
  const { theme } = useContext(ThemeContext);
  const { timerLogs, setTimerLogs } = useData();
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

  const { todayTotal, weekTotal, topCategory } = useMemo(() => {
    const todayISO = getTodayISO();
    const weekStartISO = getWeekStartISO();

    let todayTotal = 0;
    let weekTotal = 0;
    const categoryTotals: Record<string, number> = {};

    for (const log of timerLogs) {
      if (!log.duration) continue;
      const logDate =
        typeof log.startTime === "string"
          ? log.startTime.split("T")[0]
          : log.startTime.toISOString().split("T")[0]; //TODO // ISO string → date part

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
        onPress: () =>
          setTimerLogs((prev) => {
            return prev.filter((log) => log.id !== id);
          }),
      },
    ]);
  };

  const handleEdit = (updated: TimerLog) => {
    setTimerLogs((prev) =>
      prev.map((l) => (l.id === updated.id ? updated : l)),
    );
  };

  return (
    <Provider>
      <GestureHandlerRootView>
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* ── Stats row (checkpoint 10) ── */}
          <View
            style={[
              styles.statsRow,
              { backgroundColor: withAlpha(theme.timerBase,"18") },
            ]}
          >
            <StatCell
              label="Today"
              value={formatDuration(todayTotal)}
              accent={theme.timerBase}
            />
            <View
              style={[
                styles.statDivider,
                { backgroundColor: withAlpha(theme.timerBase,"33") },
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
                    { backgroundColor:  withAlpha(theme.timerBase,"33") },
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
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              mode="outlined"
              activeOutlineColor={theme.timerBase}
            />
            <TextInput
              placeholder="Category (optional)"
              value={category}
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
                style={[
                  styles.suggestionChip,
                  { borderColor: theme.timerBase },
                ]}
                onPress={() => setCategory(lastUsedCategory)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.suggestionText, { color: theme.timerBase }]}
                >
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
                <XButton
                  icon="refresh"
                  mode="timer"
                  size="big"
                  onPress={reset}
                />
              </>
            )}
          </View>
          {/* ── Lap splits inline display ── */}
          {laps.length > 0 && (
            <View
              style={[
                styles.lapsContainer,
                { borderColor:  withAlpha(theme.timerBase,"33") },
              ]}
            >
              {laps.map((lapTime, idx) => {
                const splitDuration =
                  idx === 0 ? lapTime : lapTime - laps[idx - 1];
                return (
                  <View key={idx} style={styles.lapRow}>
                    <Text
                      style={[
                        styles.lapLabel,
                        { color:  withAlpha(theme.timerBase,"99") },
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
                        { color:  withAlpha(theme.timerBase,"66") },
                      ]}
                    >
                      {formatDuration(lapTime)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={{ color: "white" }}>Recent Logs</Text>
          <FlatList
            data={timerLogs.slice(-10)}
            keyExtractor={(item) => item.id}
            style={{ width: "95%" }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TimerLogItem
                log={item}
                onDelete={() => handleDelete(item.id)}
                onEdit={handleEdit}
              />
            )}
          />
        </View>
      </GestureHandlerRootView>
    </Provider>
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
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 14,
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
});
