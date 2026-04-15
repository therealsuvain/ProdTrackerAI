import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { Card } from "react-native-paper";
import { useRoute } from "@react-navigation/native";
import { useContext, useState } from "react";
import { XButton } from "../x-button";

import { ThemeContext } from "@/context/ThemeContext";
import { formatDuration, formatRelativeTime } from "@/context/TimerContext";
import { TimerLog } from "@/types/timer";
import { withAlpha } from "@/utils/common-utils";
interface TimerLogItemProps {
  log: TimerLog;
  onDelete: () => void;
  onEdit: () => void;
}

export default function TimerLogItem({
  log,
  onDelete,
  onEdit,
}: TimerLogItemProps) {
  const { theme } = useContext(ThemeContext);
  const route = useRoute();
  const isNotHome = route.name !== "index";

  const [lapsExpanded, setLapsExpanded] = useState(false);

  const duration = log.duration ? formatDuration(log.duration) : "Ongoing";
  // startTime is now an ISO string — convert to Date only at display time
  const startedLabel = formatRelativeTime(log.startTime);
  const hasLaps = log.laps && log.laps.length > 0;
  return (
    <Card
      style={[
        styles.container,
        { backgroundColor: theme.timerDarkPrimary },
        !isNotHome && { borderRadius: 0 },
      ]}
    >
      <Card.Content style={{ position: "relative" }}>
        <View style={styles.row}>
          <View style={styles.dataBlock}>
            <View style={styles.titleCategoryBlock}>
              <Text style={[styles.titleText, { color: theme.whiteBase }]}>
                {log.title}
                {log.isPartial && (
                  <Text
                    style={[styles.partialBadge, { color: theme.timerBase }]}
                  >
                    {" "}
                    (partial)
                  </Text>
                )}
              </Text>
              {log.category && (
                <View
                  style={[
                    styles.categoryPill,
                    { borderColor: withAlpha(theme.timerBase, "66") },
                  ]}
                >
                  <Text
                    style={[styles.categoryText, { color: theme.timerBase }]}
                  >
                    {log.category}
                  </Text>
                </View>
              )}
            </View>
            {/* ── Duration + start time ── */}
            <Text style={{ color: theme.whiteBase }}>
              {duration}
              {"  ·  "}
              <Text style={{ opacity: 0.6 }}>{startedLabel}</Text>
            </Text>

            {/* ── Lap summary — tap to expand ── */}
            {hasLaps && (
              <>
                <TouchableOpacity
                  onPress={() => setLapsExpanded((v) => !v)}
                  activeOpacity={0.7}
                  style={styles.lapToggle}
                >
                  <Text
                    style={[styles.lapToggleText, { color: theme.timerBase }]}
                  >
                    {lapsExpanded ? "▾" : "▸"} {log.laps!.length} lap
                    {log.laps!.length !== 1 ? "s" : ""}
                  </Text>
                </TouchableOpacity>

                {lapsExpanded && (
                  <View
                    style={[
                      styles.lapsBlock,
                      { borderColor: withAlpha(theme.timerBase, "33") },
                    ]}
                  >
                    {log.laps!.map((lapTime, idx) => {
                      const splitDuration =
                        idx === 0 ? lapTime : lapTime - log.laps![idx - 1];
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
                          <Text
                            style={[
                              styles.lapSplit,
                              { color: theme.whiteBase },
                            ]}
                          >
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
              </>
            )}
          </View>
          {isNotHome && (
            <XButton icon="pencil-outline" mode="timer" onPress={onEdit} />
          )}
          {isNotHome && (
            <XButton icon="trash-outline" mode="timer" onPress={onDelete} />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 8, width: "100%", position: "relative" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dataBlock: { flex: 1, paddingRight: 8 },
  titleCategoryBlock: { flexDirection: "row", gap: 5, alignItems: "center" },
  partialBadge: { fontSize: 12, fontStyle: "italic" },
  categoryPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  categoryText: { fontSize: 11, fontWeight: "600" },
  lapToggle: { marginTop: 6 },
  lapToggleText: { fontSize: 12, fontWeight: "600" },
  lapsBlock: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
  lapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  lapLabel: { fontSize: 11, flex: 1 },
  lapSplit: { fontSize: 11, fontWeight: "700", flex: 1, textAlign: "center" },
  lapTotal: { fontSize: 11, flex: 1, textAlign: "right" },
  titleText: { fontSize: 16, fontWeight: 500 },
});
