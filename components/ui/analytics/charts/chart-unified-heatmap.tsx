import React, { useMemo, useContext, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Portal } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { AppMetrics } from "@/types/metrics"; // adjust path to your metrics type

interface AnalyticsHeatmapProps {
  metrics: AppMetrics;
}

// ─── Grid constants ───────────────────────────────────────────────────────────
const { width } = Dimensions.get("window");
const CELL_SIZE = Math.min(width * 0.0375, 19);
//console.log("CELL SIZE", CELL_SIZE); // px — fits 6 columns comfortably on a 375px screen
const CELL_GAP = Math.min(width * 0.005, 2.5);
const DAYS = 60;
const COLS = 20;
const ROWS = 3; // 20 × 3 = 60

const getISO = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

const getCellOpacity = (count: number, max: number): number => {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 0.3;
  if (ratio <= 0.5) return 0.55;
  if (ratio <= 0.75) return 0.75;
  return 1;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AnalyticsHeatmap = ({ metrics }: AnalyticsHeatmapProps) => {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const [tooltip, setTooltip] = useState<{
    checkins: number;
    completed: number;
    logs: number;
    opacity: number;
    x: number;
    y: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    cells,
    maxCount,
    totalCheckins,
    totalTasksCompleted,
    totalLogs,
    totalActivity,
    activeDays,
  } = useMemo(() => {
    let maxCount = 0;
    let totalActivity = 0;
    let activeDays = 0;
    let totalCheckins = 0;
    let totalTasksCompleted = 0;
    let totalLogs = 0;

    const cells = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => {
        const daysAgo = (COLS - 1 - col) * ROWS + (ROWS - 1 - row);
        const iso = getISO(daysAgo);
        const day = metrics.daily[iso];

        const habits = (day?.habitsCheckedIn ?? 0) + (day?.habitsFrozen ?? 0);
        const tasks = day?.tasksCompleted ?? 0;
        const logs = day?.logsAdded ?? 0;

        const totalCount = habits + tasks + logs;

        totalCheckins += habits;
        totalTasksCompleted += tasks;
        totalLogs += logs;

        if (totalCount > maxCount) maxCount = totalCount;
        if (totalCount > 0) {
          totalActivity += totalCount;
          activeDays += 1;
        }

        return { iso, totalCount, details: { habits, tasks, logs }, daysAgo };
      }),
    );

    return {
      cells,
      maxCount,
      totalCheckins,
      totalTasksCompleted,
      totalLogs,
      totalActivity,
      activeDays,
    };
  }, [metrics.daily]);

  useEffect(() => {
    if (!tooltip) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setTooltip(null);
    }, 2500);

    // Cleanup if component unmounts mid-timer
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tooltip]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.whiteBase }]}>
          Activity for last 60 Days
        </Text>
        <View
          style={{
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={[
              styles.subtitle,
              {
                color: isDarkMode
                  ? theme.blueLightPrimary
                  : theme.blueDarkPrimary,
                flexWrap: "wrap",
                flexDirection: "row",
              },
            ]}
          >
            {activeDays} Day activity · {totalCheckins} Habits checked in
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: isDarkMode
                  ? theme.blueLightPrimary
                  : theme.blueDarkPrimary,
                flexWrap: "wrap",
                flexDirection: "row",
              },
            ]}
          >
            {totalTasksCompleted} Tasks completed · {totalLogs} Log entries
          </Text>
        </View>
      </View>

      {/* Grid */}
      {tooltip && (
        <Portal>
          <View
            style={{
              position: "absolute",
              top: tooltip.y,
              left: tooltip.x,
              backgroundColor:
                tooltip.opacity > 0
                  ? `rgb(19, 55, 128 , ${tooltip.opacity})`
                  : theme.greyBaseTertiary,
              //tooltip.opacity > 0 ? tooltip.opacity : theme.greyBaseTertiary,
              padding: 4,
              borderRadius: 10,
              boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            <View style={{ flexDirection: "column", alignItems: "center" }}>
              <Text
                style={[
                  styles.tooltipText,
                  {
                    color: theme.whiteBase,
                  },
                ]}
              >
                {tooltip.checkins} Check-ins
              </Text>
              <Text
                style={[
                  styles.tooltipText,
                  {
                    color: theme.whiteBase,
                  },
                ]}
              >
                {tooltip.completed} Completions
              </Text>
              <Text
                style={[
                  styles.tooltipText,
                  {
                    color: theme.whiteBase,
                  },
                ]}
              >
                {tooltip.logs} Additions
              </Text>
            </View>
          </View>
        </Portal>
      )}
      <View style={styles.grid}>
        {cells.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((cell) => {
              const opacity = getCellOpacity(cell.totalCount, maxCount);
              const isToday = cell.daysAgo === 0;

              return (
                <Pressable
                  onPress={(e) => {
                    const { pageX, pageY } = e.nativeEvent;
                    //console.log(pageX, pageY);
                    setTooltip({
                      checkins: cell.details.habits,
                      completed: cell.details.tasks,
                      logs: cell.details.logs,
                      opacity,
                      x: pageX,
                      y: pageY,
                    });
                  }}
                  key={cell.iso}
                  style={[
                    styles.cell,
                    {
                      backgroundColor:
                        opacity > 0
                          ? isDarkMode
                            ? theme.blueLightPrimary
                            : theme.blueDarkPrimary
                          : `${theme.greyBaseTertiary}`, // ~6% white for empty cells
                      opacity: opacity > 0 ? opacity : 1, // empty cells use bg opacity trick
                      // Today gets a distinct ring instead of just colour fill
                      borderWidth: isToday ? 1.5 : 0,
                      borderColor: isToday
                        ? isDarkMode
                          ? theme.blueLightPrimary
                          : theme.blueDarkPrimary
                        : "transparent",
                      // Empty today cell still needs to be visible
                      ...(isToday && opacity === 0
                        ? { backgroundColor: "transparent", opacity: 1 }
                        : {}),
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={[styles.legendLabel, { color: theme.greyBaseTertiary }]}>
          Less
        </Text>
        {[0.15, 0.3, 0.55, 0.75, 1].map((op, i) => (
          <View
            key={i}
            style={[
              styles.legendCell,
              {
                backgroundColor:
                  i === 0
                    ? theme.greyBaseTertiary
                    : isDarkMode
                      ? theme.blueLightPrimary
                      : theme.blueDarkPrimary,
                opacity: i === 0 ? 1 : op,
              },
            ]}
          />
        ))}
        <Text
          style={[
            styles.legendLabel,
            {
              color: isDarkMode
                ? theme.blueLightPrimary
                : theme.blueDarkPrimary,
            },
          ]}
        >
          More
        </Text>
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
    marginLeft: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    gap: CELL_GAP,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 10,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    marginHorizontal: 2,
  },
  tooltipText: {
    fontSize: 12,

    fontWeight: "bold",
    textShadowColor: "black",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
