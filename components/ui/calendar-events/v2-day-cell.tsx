import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import React, { memo, useContext, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface DayCellProps {
  dateString: string;        // "YYYY-MM-DD"
  dayNumber: number;         // 1-31
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  eventCount: number;        // already computed by MonthGrid, 0-N
  onPress: (dateString: string) => void;
}

// Dot / plus indicator row
const EventDots = memo(
  ({ count, color }: { count: number; color: string }) => {
    if (count === 0) return null;

    // Up to 5 dots, then a '+' symbol styled identically to the dot
    const dots = Math.min(count, 5);
    const showPlus = count > 5;

    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: dots }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: color }]}
          />
        ))}
        {showPlus && (
          <View style={[styles.dot, styles.plusDot, { backgroundColor: color }]}>
            <Text style={styles.plusText}>+</Text>
          </View>
        )}
      </View>
    );
  }
);

function DayCellInner({
  dateString,
  dayNumber,
  isCurrentMonth,
  isToday,
  isSelected,
  eventCount,
  onPress,
}: DayCellProps) {
  const { theme } = useContext(ThemeContext);

  const textColor = useMemo(() => {
    if (isSelected) return theme.eventDarkPrimary;      // text on selected circle
    if (isToday) return theme.eventBase;                // today accent
    if (!isCurrentMonth) return theme.greyBaseSecondary;
    return theme.whiteBase;
  }, [isSelected, isToday, isCurrentMonth, theme]);

  const dotColor = useMemo(() => {
    if (isSelected) return theme.eventDarkPrimary;
    return theme.eventBase;
  }, [isSelected, theme]);

  return (
    <Pressable
      onPress={() => onPress(dateString)}
      style={styles.cell}
      hitSlop={4}
    >
      {/* Circle background for selected / today */}
      <View
        style={[
          styles.circle,
          isSelected && { backgroundColor: theme.eventBase },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            { color: textColor },
            isToday && !isSelected && styles.todayText,
          ]}
        >
          {dayNumber}
        </Text>
      </View>

      <EventDots count={eventCount} color={dotColor} />
    </Pressable>
  );
}

// Custom memo comparison — only re-render if something visual actually changed
export const DayCell = memo(DayCellInner, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.isToday === next.isToday &&
    prev.eventCount === next.eventCount &&
    prev.isCurrentMonth === next.isCurrentMonth &&
    prev.dayNumber === next.dayNumber &&
    prev.dateString === next.dateString &&
    prev.onPress === next.onPress   // stable ref from useCallback in parent
  );
});

const DOT_SIZE = 5;

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    minHeight: 48,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "500",
  },
  todayText: {
    fontWeight: "700",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: DOT_SIZE,
    alignItems: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  plusDot: {
    alignItems: "center",
    justifyContent: "center",
    // slightly wider to fit the '+' glyph
    width: DOT_SIZE + 2,
    borderRadius: (DOT_SIZE + 2) / 2,
  },
  plusText: {
    fontSize: 5,
    lineHeight: 6,
    fontWeight: "700",
    color: "#fff",
    includeFontPadding: false,
  },
});
