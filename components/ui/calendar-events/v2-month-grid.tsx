import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import React, { memo, useCallback, useContext, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DayCell } from "./v2-day-cell";

interface MonthGridProps {
  // "YYYY-MM" — the month this grid represents
  monthKey: string;
  events: CalendarEvent[];
  selectedDateString: string; // "YYYY-MM-DD"
  todayString: string; // "YYYY-MM-DD"  — passed in once, never recalculated
  onDayPress: (dateString: string) => void;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Pure helpers — defined outside component so they're never recreated
// ---------------------------------------------------------------------------

function toDateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Returns true if `dateString` falls on a day that has an active occurrence
 * of `event` (accounts for recurrence rules and deletedOccurrences).
 */
function eventOccursOn(event: CalendarEvent, dateString: string): boolean {
  const eventStart = event.startDate.split("T")[0];
  const eventEnd = event.endDate ? event.endDate.split("T")[0] : undefined;

  if (dateString < eventStart) return false;
  if (eventEnd && dateString > eventEnd) return false;
  if (event.deletedOccurrences?.includes(dateString)) return false;

  const recurrence = event.recurrence ?? "none";

  if (recurrence === "none") return dateString === eventStart;

  if (recurrence === "daily") return true;

  if (recurrence === "weekly") {
    const startDay = new Date(eventStart + "T00:00:00").getDay();
    const checkDay = new Date(dateString + "T00:00:00").getDay();
    return startDay === checkDay;
  }

  return false;
}

/**
 * Builds a map of { "YYYY-MM-DD": eventCount } for every day in the month.
 * O(days_in_month × events) — fast enough for typical event lists.
 */
function buildEventCountMap(
  year: number,
  month: number, // 0-indexed
  events: CalendarEvent[],
): Map<string, number> {
  const map = new Map<string, number>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = toDateString(year, month, d);
    let count = 0;
    for (const event of events) {
      if (eventOccursOn(event, ds)) count++;
    }
    if (count > 0) map.set(ds, count);
  }
  return map;
}

/**
 * Builds the grid of weeks.
 * Each week is an array of 7 cells: { dateString, dayNumber, isCurrentMonth }
 * Cells outside the current month are padding cells.
 */
function buildWeeks(year: number, month: number) {
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: Array<{
    dateString: string;
    dayNumber: number;
    isCurrentMonth: boolean;
  }> = [];

  // Leading padding from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({
      dateString: toDateString(prevYear, prevMonth, day),
      dayNumber: day,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateString: toDateString(year, month, d),
      dayNumber: d,
      isCurrentMonth: true,
    });
  }

  // Trailing padding to fill last week
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const toAdd = 7 - remainder;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let d = 1; d <= toAdd; d++) {
      cells.push({
        dateString: toDateString(nextYear, nextMonth, d),
        dayNumber: d,
        isCurrentMonth: false,
      });
    }
  }

  // Split into weeks
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// Month name lookup — stable constant, never recreated
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MonthGridInner({
  monthKey,
  events,
  selectedDateString,
  todayString,
  onDayPress,
}: MonthGridProps) {
  const { theme } = useContext(ThemeContext);

  const [year, month] = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    return [y, m - 1]; // month is 0-indexed internally
  }, [monthKey]);

  // Recompute only when events or the month changes
  const eventCountMap = useMemo(
    () => buildEventCountMap(year, month, events),
    [year, month, events],
  );

  // Recompute only when year/month changes — pure date math
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  // Stable press handler — onDayPress ref comes from useCallback in the parent
  const handlePress = useCallback((ds: string) => onDayPress(ds), [onDayPress]);

  return (
    <View style={styles.container}>
      {/* Month + Year header */}
      <Text style={[styles.monthTitle, { color: theme.whiteBase }]}>
        {MONTH_NAMES[month]} {year}
      </Text>

      {/* Weekday header row */}
      <View style={styles.weekDayRow}>
        {WEEK_DAYS.map((wd) => (
          <Text
            key={wd}
            style={[styles.weekDayText, { color: theme.greyBasePrimary }]}
          >
            {wd}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => (
            <DayCell
              key={cell.dateString}
              dateString={cell.dateString}
              dayNumber={cell.dayNumber}
              isCurrentMonth={cell.isCurrentMonth}
              isToday={cell.dateString === todayString}
              isSelected={cell.dateString === selectedDateString}
              eventCount={eventCountMap.get(cell.dateString) ?? 0}
              onPress={handlePress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// Custom memo comparison for MonthGrid:
// Only re-render if the selected day changed to/from a day IN this month,
// or if events changed, or if today changed (basically never).
export const MonthGrid = memo(MonthGridInner, (prev, next) => {
  if (prev.monthKey !== next.monthKey) return false;
  if (prev.events !== next.events) return false;
  if (prev.todayString !== next.todayString) return false;
  if (prev.onDayPress !== next.onDayPress) return false;

  // Only re-render due to selection change if the selection
  // touches THIS month (avoids re-rendering all other months)
  const thisMonthPrefix = prev.monthKey; // "YYYY-MM"
  const prevSelInMonth = prev.selectedDateString.startsWith(thisMonthPrefix);
  const nextSelInMonth = next.selectedDateString.startsWith(thisMonthPrefix);

  if (prevSelInMonth || nextSelInMonth) {
    return prev.selectedDateString === next.selectedDateString;
  }

  // Neither selection is in this month — no re-render needed
  return true;
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
  },
  weekDayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekDayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
  },
});
