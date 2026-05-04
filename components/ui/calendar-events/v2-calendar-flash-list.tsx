import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { MonthGrid } from "./v2-month-grid";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get("window").width;

// How many months to generate before and after today.
// 24 back + 24 forward = 4 years total. Cheap to generate, never causes lag
// because FlashList only renders the visible page + drawDistance buffer.
const MONTHS_BEFORE = 24;
const MONTHS_AFTER = 24;
const TOTAL_MONTHS = MONTHS_BEFORE + MONTHS_AFTER + 1;

// Pre-render 1 month on each side of the visible one.
// - Too low (0) → blank flash when swiping fast
// - Too high (3+) → wasted memory, slower initial mount
const DRAW_DISTANCE = SCREEN_WIDTH * 1;

// ---------------------------------------------------------------------------
// Pure helpers — outside component, never recreated
// ---------------------------------------------------------------------------

/**
 * Generates an array of "YYYY-MM" strings.
 * Uses date.setDate(1) before month arithmetic to avoid the JS Date
 * rollover bug (e.g. Aug 31 + 1 month = Oct 1 instead of Sep 1).
 */
function generateMonthKeys(
  monthsBefore: number,
  monthsAfter: number,
): string[] {
  const keys: string[] = [];
  const base = new Date();
  base.setDate(1); // ← critical: pin to 1st before any month arithmetic

  for (let i = -monthsBefore; i <= monthsAfter; i++) {
    const d = new Date(base);
    d.setMonth(base.getMonth() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${yyyy}-${mm}`);
  }
  return keys;
}

/** "YYYY-MM-DD" of today — computed once at module load, never changes. */
const TODAY_STRING = new Date().toISOString().split("T")[0];

/** "YYYY-MM" of today — used to find the initial scroll index. */
const TODAY_MONTH_KEY = TODAY_STRING.slice(0, 7);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CalendarFlashListProps {
  events: CalendarEvent[];
  selectedDateString: string; // "YYYY-MM-DD"
  onDayPress: (dateString: string) => void;
  /** Exposed so the parent can collapse/expand — passed through to the knob later */
  calendarHeight: number;
}

// ---------------------------------------------------------------------------
// Render item — memoized separately so FlashList never sees a new function ref
// ---------------------------------------------------------------------------

interface RenderItemProps {
  monthKey: string;
  events: CalendarEvent[];
  selectedDateString: string;
  onDayPress: (dateString: string) => void;
}

const MonthItem = memo(
  ({ monthKey, events, selectedDateString, onDayPress }: RenderItemProps) => (
    <View style={{ width: SCREEN_WIDTH }}>
      <MonthGrid
        monthKey={monthKey}
        events={events}
        selectedDateString={selectedDateString}
        todayString={TODAY_STRING}
        onDayPress={onDayPress}
      />
    </View>
  ),
  (prev, next) => {
    // Mirror the MonthGrid memo logic so FlashList's recycled views
    // also skip unnecessary work
    if (prev.monthKey !== next.monthKey) return false;
    if (prev.events !== next.events) return false;
    if (prev.onDayPress !== next.onDayPress) return false;

    const prevSelInMonth = prev.selectedDateString.startsWith(prev.monthKey);
    const nextSelInMonth = next.selectedDateString.startsWith(next.monthKey);
    if (prevSelInMonth || nextSelInMonth) {
      return prev.selectedDateString === next.selectedDateString;
    }
    return true;
  },
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CalendarFlashList = React.forwardRef<
  FlashListRef<string>,
  CalendarFlashListProps
>(function CalendarFlashListInner(
  {
    events,
    selectedDateString,
    onDayPress,
    calendarHeight,
  }: CalendarFlashListProps,
  ref,
) {
  const { theme } = useContext(ThemeContext);
  // Use forwarded ref if provided (from root for scroll sync),
  // fall back to internal ref for the selectedDate scroll effect below
  const internalRef = useRef<FlashListRef<string>>(null);
  const listRef = (ref as React.RefObject<FlashListRef<string>>) ?? internalRef;

  // Generated once — never changes for the lifetime of the app session
  const monthKeys = useMemo(
    () => generateMonthKeys(MONTHS_BEFORE, MONTHS_AFTER),
    [],
  );

  // Index of today's month in the monthKeys array
  const todayIndex = useMemo(
    () => monthKeys.indexOf(TODAY_MONTH_KEY),
    [monthKeys],
  );

  // Stable key extractor
  const keyExtractor = useCallback((item: string) => item, []);

  // Stable render function — events and selectedDateString flow in as closure
  // but the function reference itself is stable (useCallback with deps)
  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <MonthItem
        monthKey={item}
        events={events}
        selectedDateString={selectedDateString}
        onDayPress={onDayPress}
      />
    ),
    [events, selectedDateString, onDayPress],
  );

  // When selectedDateString changes to a month not currently visible,
  // scroll the FlashList to that month programmatically.
  // Example: parent resets to today → list jumps to today's month.
  useEffect(() => {
    const selectedMonthKey = selectedDateString.slice(0, 7);
    const targetIndex = monthKeys.indexOf(selectedMonthKey);
    if (targetIndex === -1) return;

    // Only scroll if we're not already on that page
    listRef.current?.scrollToIndex({
      index: targetIndex,
      animated: true,
    });
  }, [selectedDateString, monthKeys]);

  return (
    <View
      style={[
        styles.container,
        {
          height: calendarHeight,
          backgroundColor: theme.eventDarkSecondary,
        },
      ]}
    >
      <FlashList
        ref={listRef}
        data={monthKeys}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={todayIndex}
        /*  estimatedItemSize={SCREEN_WIDTH}
        estimatedListSize={{
          width: SCREEN_WIDTH,
          height: calendarHeight,
        }} */
        drawDistance={DRAW_DISTANCE}
        /* disableHorizontalListHeightMeasurement */
        decelerationRate={0.89}
        viewabilityConfig={{
          waitForInteraction: false,
        }}
        overrideItemLayout={(layout) => {
          layout.span = SCREEN_WIDTH;
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    overflow: "hidden",
  },
});

export default CalendarFlashList;
