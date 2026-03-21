import React, { useMemo, useContext, useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Portal } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { AppMetrics } from "@/types/metrics"; // adjust path to your metrics type

interface HabitHeatmapProps {
  metrics: AppMetrics;
}

// ─── Grid constants ───────────────────────────────────────────────────────────

const DAYS = 60;
const COLS = 20;
const ROWS = 3; // 20 × 3 = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for a date N days before today (0 = today) */
const getISO = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
};

/**
 * Builds the colour for a cell given its activity count and the window maximum.
 *
 * Why relative scaling: an absolute cap (e.g. "5 = full colour") punishes
 * users with fewer habits and rewards nothing for heavy users. Scaling to the
 * window's own max means the darkest cell always belongs to the user's best
 * day — the heatmap always looks alive regardless of habit count.
 *
 * Four intensity steps (0%, 30%, 60%, 85%, 100%) give enough visual
 * separation without looking noisy on small cells.
 */
const getCellOpacity = (count: number, max: number): number => {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 0.3;
  if (ratio <= 0.5) return 0.55;
  if (ratio <= 0.75) return 0.75;
  return 1;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HabitHeatmap({ metrics }: HabitHeatmapProps) {
  const { theme } = useContext(ThemeContext);
  const [tooltip, setTooltip] = useState<{
    count: number;
    opacity: number;
    x: number;
    y: number;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Build cell data once per render. Memoised on metrics.daily so it only
   * recomputes when the underlying data changes — not on theme changes or
   * parent re-renders from unrelated state.
   *
   * Cell index 0 = oldest (29 days ago), index 29 = today.
   * Grid fills bottom-to-top, left-to-right (GitHub style):
   *   - Column 0 = days 29..25 (oldest), top cell = day 29, bottom = day 25
   *   - Column 5 = days 4..0  (newest),  top cell = day 4,  bottom = day 0
   *
   * So for cell at (row, col):
   *   daysAgo = (COLS - 1 - col) * ROWS + (ROWS - 1 - row)
   *
   * Worked example for a 2×3 grid (ROWS=2, COLS=3), today = index 0:
   *   col0-row0: daysAgo=(2)*2+(1)=5  col1-row0: daysAgo=(1)*2+(1)=3  col2-row0: daysAgo=(0)*2+(1)=1
   *   col0-row1: daysAgo=(2)*2+(0)=4  col1-row1: daysAgo=(1)*2+(0)=2  col2-row1: daysAgo=(0)*2+(0)=0
   * Reading left→right, bottom→top: 4,5 | 2,3 | 0,1  ✓ (oldest top-left, today bottom-right)
   */
  const { cells, maxCount, totalCheckins, activeDays } = useMemo(() => {
    let maxCount = 0;
    let totalCheckins = 0;
    let activeDays = 0;

    const cells = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => {
        const daysAgo = (COLS - 1 - col) * ROWS + (ROWS - 1 - row);
        const iso = getISO(daysAgo);
        const day = metrics.daily[iso];
        // Treat freezes as check-ins per your spec
        const count = (day?.habitsCheckedIn ?? 0) + (day?.habitsFrozen ?? 0);

        if (count > maxCount) maxCount = count;
        if (count > 0) {
          totalCheckins += count;
          activeDays += 1;
        }

        return { iso, count, daysAgo };
      }),
    );

    return { cells, maxCount, totalCheckins, activeDays };
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
    <View
      style={[styles.container, { backgroundColor: theme.habitDarkPrimary }]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.whiteBase }]}>
          Last 60 Days
        </Text>
        <Text style={[styles.subtitle, { color: theme.habitBase }]}>
          {activeDays} Day activity · {totalCheckins} check-ins
        </Text>
      </View>

      {/* Grid */}
      {tooltip && (
        <Portal>
          <View
            style={{
              position: "absolute",
              top: tooltip.y - 150,
              left: tooltip.x - 25,
              backgroundColor:
                tooltip.opacity > 0
                  ? `rgb(255, 211, 88 , ${tooltip.opacity})`
                  : theme.greyBasePrimary,
              //tooltip.opacity > 0 ? tooltip.opacity : theme.greyBasePrimary,
              padding: 4,
              borderRadius: 10,
              boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: theme.whiteBase,
                fontWeight: "bold",
                textShadowColor: "black",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1,
              }}
            >
              {tooltip.count} Check-ins
            </Text>
          </View>
        </Portal>
      )}
      <View style={styles.grid}>
        {cells.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {row.map((cell) => {
              const opacity = getCellOpacity(cell.count, maxCount);
              const isToday = cell.daysAgo === 0;

              return (
                <Pressable
                  onPress={(e) => {
                    const { pageX, pageY } = e.nativeEvent;
                    //console.log(pageX, pageY);
                    setTooltip({
                      count: cell.count,
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
                          ? theme.habitBase
                          : `${theme.greyBasePrimary}`, // ~6% white for empty cells
                      opacity: opacity > 0 ? opacity : 1, // empty cells use bg opacity trick
                      // Today gets a distinct ring instead of just colour fill
                      borderWidth: isToday ? 1.5 : 0,
                      borderColor: isToday ? theme.habitBase : "transparent",
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
        <Text style={[styles.legendLabel, { color: theme.greyBasePrimary }]}>
          Less
        </Text>
        {[0.15, 0.3, 0.55, 0.75, 1].map((op, i) => (
          <View
            key={i}
            style={[
              styles.legendCell,
              {
                backgroundColor:
                  i === 0 ? theme.greyBasePrimary : theme.habitBase,
                opacity: i === 0 ? 1 : op,
              },
            ]}
          />
        ))}
        <Text style={[styles.legendLabel, { color: theme.habitBase }]}>
          More
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = 19; // px — fits 6 columns comfortably on a 375px screen
const CELL_GAP = 2.5;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
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
});
