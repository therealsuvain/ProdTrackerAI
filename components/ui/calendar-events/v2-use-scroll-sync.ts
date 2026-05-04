import { FlashListRef } from "@shopify/flash-list";
import { useCallback, useRef } from "react";
import { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { ListRow } from "./v2-event-flash-list";

// ---------------------------------------------------------------------------
// How this works
// ---------------------------------------------------------------------------
//
// When the user scrolls the event FlashList vertically, we need to know
// which day is at the top of the viewport so we can:
//   1. Update selectedDateString in the parent
//   2. Scroll the calendar FlashList to that month if it changed
//
// FlashList doesn't give us "which item is at the top" directly. But we
// built a `dateIndexMap` (dateString → rowIndex) in EventFlashList. We
// invert that here to get a rowIndex → dateString lookup, then use the
// scroll offset + estimated item heights to find the visible row.
//
// We use a ref-based debounce (not setTimeout) so it runs on every scroll
// event but only fires the callback when the visible date actually changes —
// no unnecessary re-renders.
// ---------------------------------------------------------------------------

// These must match the constants in event-flash-list.tsx
const HEADER_HEIGHT = 36;
const EVENT_HEIGHT = 80;
const EMPTY_HEIGHT = 40;

interface UseScrollSyncOptions {
  /** The flat row array from EventFlashList */
  rows: ListRow[];
  /** Called when the topmost visible date changes */
  onVisibleDateChange: (dateString: string) => void;
  /** Called when the topmost visible month changes (drives calendar FlashList) */
  onVisibleMonthChange: (monthKey: string) => void;
}

export function useScrollSync({
  rows,
  onVisibleDateChange,
  onVisibleMonthChange,
}: UseScrollSyncOptions) {
  // Track last emitted values so we only fire callbacks on actual changes
  const lastDateRef = useRef<string | null>(null);
  const lastMonthRef = useRef<string | null>(null);

  /**
   * Given a scroll offset, estimate which row index is at the top
   * of the viewport. We walk the rows accumulating heights until we
   * exceed the offset — that row is the visible one.
   *
   * This is O(n) in the worst case but in practice we exit early because
   * most scrolls are near the current position. For very large lists a
   * binary search could be used, but for 270 days × ~2 rows = ~540 rows
   * this is fast enough that it won't block the JS thread meaningfully.
   */
  const findRowIndexAtOffset = useCallback(
    (offset: number): number => {
      let accumulated = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const height =
          row.type === "header"
            ? HEADER_HEIGHT
            : row.type === "empty"
              ? EMPTY_HEIGHT
              : EVENT_HEIGHT;

        if (accumulated + height > offset) {
          return i;
        }
        accumulated += height;
      }
      return rows.length - 1;
    },
    [rows]
  );

  /**
   * Walk backwards from `index` to find the nearest header row above it.
   * This gives us the date for the current scroll position even if we're
   * mid-way through an event block.
   */
  const findNearestHeaderAbove = useCallback(
    (index: number): string | null => {
      for (let i = index; i >= 0; i--) {
        if (rows[i].type === "header") {
          return rows[i].dateString;
        }
      }
      return null;
    },
    [rows]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const rowIndex = findRowIndexAtOffset(offset);
      const dateString = findNearestHeaderAbove(rowIndex);

      if (!dateString) return;

      // Only fire if date actually changed
      if (dateString !== lastDateRef.current) {
        lastDateRef.current = dateString;
        onVisibleDateChange(dateString);

        // Only fire month change if month actually changed
        const monthKey = dateString.slice(0, 7);
        if (monthKey !== lastMonthRef.current) {
          lastMonthRef.current = monthKey;
          onVisibleMonthChange(monthKey);
        }
      }
    },
    [findRowIndexAtOffset, findNearestHeaderAbove, onVisibleDateChange, onVisibleMonthChange]
  );

  return { onScroll };
}

// ---------------------------------------------------------------------------
// useCalendarFlashListRef
// ---------------------------------------------------------------------------
// A small helper that gives the parent a stable way to imperatively scroll
// the calendar FlashList to a specific month key, given the monthKeys array.
// Kept here so all sync logic lives in one file.

interface UseCalendarScrollOptions {
  monthKeys: string[];
}

export function useCalendarScroll({ monthKeys }: UseCalendarScrollOptions) {
  const calendarListRef = useRef<FlashListRef<string>>(null);

  const scrollToMonth = useCallback(
    (monthKey: string) => {
      const index = monthKeys.indexOf(monthKey);
      if (index === -1) return;
      calendarListRef.current?.scrollToIndex({
        index,
        animated: true,
      });
    },
    [monthKeys]
  );

  return { calendarListRef, scrollToMonth };
}
