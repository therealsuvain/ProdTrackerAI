import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { FlashListRef } from "@shopify/flash-list";
import React, {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import CalendarFlashList from "./v2-calendar-flash-list";
import CollapsibleKnob from "./v2-collapsible-knob";
import EventFlashList, { ListRow } from "./v2-event-flash-list";
import {
  COLLAPSED_HEIGHT,
  EXPANDED_HEIGHT,
  useCalendarHeight,
} from "./v2-use-calendar-height";
import { useCalendarScroll, useScrollSync } from "./v2-use-scroll-sync";

// ---------------------------------------------------------------------------
// monthKeys — generated once at module level, same logic as calendar-flash-list
// ---------------------------------------------------------------------------

const MONTHS_BEFORE = 24;
const MONTHS_AFTER = 24;

function generateMonthKeys(before: number, after: number): string[] {
  const keys: string[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = -before; i <= after; i++) {
    const d = new Date(base);
    d.setMonth(base.getMonth() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${yyyy}-${mm}`);
  }
  return keys;
}

// Stable module-level constant — never recreated
const MONTH_KEYS = generateMonthKeys(MONTHS_BEFORE, MONTHS_AFTER);
const TODAY_STRING = new Date().toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Props — mirrors the old CalendarListAgendaMain interface
// ---------------------------------------------------------------------------

interface CalendarViewV2Props {
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string, date: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarListAgendaV2({
  events,
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarViewV2Props) {
  const { theme } = useContext(ThemeContext);

  // --- Derived stable string from selectedDate prop ---
  const selectedDateString = useMemo(
    () => selectedDate.toISOString().split("T")[0],
    [selectedDate],
  );

  // --- Reanimated height + knob state ---
  const { calendarHeight, onKnobExpandedChange } = useCalendarHeight();

  // --- Refs for imperative scroll control ---
  const eventListRef = useRef<FlashListRef<ListRow>>(null);
  const { calendarListRef, scrollToMonth } = useCalendarScroll({
    monthKeys: MONTH_KEYS,
  });

  // --- Rows state — built inside EventFlashList via useMemo,
  //     but we need a reference here for the scroll sync hook.
  //     We lift it up so useScrollSync can read it. ---
  const [rows, setRows] = useState<ListRow[]>([]);

  // --- Scroll sync: event list → calendar ---
  const handleVisibleDateChange = useCallback(
    (dateString: string) => {
      // Update the parent's selected date so the header date text stays in sync
      onDateSelect(new Date(dateString + "T00:00:00"));
    },
    [onDateSelect],
  );

  const handleVisibleMonthChange = useCallback(
    (monthKey: string) => {
      // Scroll the horizontal calendar FlashList to the newly visible month
      scrollToMonth(monthKey);
    },
    [scrollToMonth],
  );

  const { onScroll } = useScrollSync({
    rows,
    onVisibleDateChange: handleVisibleDateChange,
    onVisibleMonthChange: handleVisibleMonthChange,
  });

  // --- Day press: calendar → event list ---
  // When user taps a day in the MonthGrid, scroll the event list to that day
  const handleDayPress = useCallback(
    (dateString: string) => {
      // Update parent state
      onDateSelect(new Date(dateString + "T00:00:00"));
    },
    [onDateSelect],
  );

  // --- Animated style for the collapsible calendar container ---
  const animatedCalendarStyle = useAnimatedStyle(() => ({
    height: calendarHeight.value,
    overflow: "hidden",
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Collapsible calendar section ── */}
      <Animated.View style={animatedCalendarStyle}>
        <CalendarFlashList
          ref={calendarListRef}
          events={events}
          selectedDateString={selectedDateString}
          onDayPress={handleDayPress}
          calendarHeight={EXPANDED_HEIGHT}
        />
      </Animated.View>

      {/* ── Drag knob ── */}
      <CollapsibleKnob
        calendarHeight={calendarHeight}
        expandedHeight={EXPANDED_HEIGHT}
        collapsedHeight={COLLAPSED_HEIGHT}
        onExpandedChange={onKnobExpandedChange}
      />

      {/* ── Event list ── */}
      <View style={styles.eventListContainer}>
        <EventFlashList
          events={events}
          selectedDateString={selectedDateString}
          onEventSelect={onEventSelect}
          onDelete={onDelete}
          listRef={eventListRef}
          onRowsReady={setRows}
          onScroll={onScroll}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  eventListContainer: {
    flex: 1,
  },
});
