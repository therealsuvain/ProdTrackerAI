import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import EventItem from "./event-item";

// ---------------------------------------------------------------------------
// Flat row types
// ---------------------------------------------------------------------------

export type HeaderRow = {
  type: "header";
  dateString: string; // "YYYY-MM-DD"
  label: string; // "Wed, 22 Apr"
};

export type EventRow = {
  type: "event";
  dateString: string;
  event: CalendarEvent;
  occurence: string;
  isFirstOccurrence: boolean; // controls edit button visibility
};

export type EmptyRow = {
  type: "empty";
  dateString: string;
};

export type ListRow = HeaderRow | EventRow | EmptyRow;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEADER_HEIGHT = 36;
const EVENT_HEIGHT = 80; // approximate — used for estimatedItemSize + scrollToOffset
const EMPTY_HEIGHT = 40;

// How many days to render before and after today in the event list.
// 90 days each side = ~6 months of scroll range.
const DAYS_BEFORE = 90;
const DAYS_AFTER = 180;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const TODAY_STRING = new Date().toISOString().split("T")[0];

function addDays(dateString: string, days: number): string {
  const d = new Date(dateString + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatHeaderLabel(dateString: string): string {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns true if `event` has an active occurrence on `dateString`,
 * accounting for recurrence rules and deletedOccurrences.
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
 * Builds the flat ListRow array and the stickyHeaderIndices array.
 * This is the core data transformation — runs inside useMemo so it only
 * re-executes when events change.
 */
function buildFlatRows(
  events: CalendarEvent[],
  startDateString: string,
  totalDays: number,
): {
  rows: ListRow[];
  stickyIndices: number[];
  dateIndexMap: Map<string, number>;
} {
  const rows: ListRow[] = [];
  const stickyIndices: number[] = [];
  // Maps "YYYY-MM-DD" → index of its header row in `rows`
  const dateIndexMap = new Map<string, number>();

  // Track which event IDs we've seen to control edit button visibility.
  // An event's first occurrence (earliest date) gets the edit button.
  const seenEventIds = new Set<string>();

  for (let i = 0; i < totalDays; i++) {
    const dateString = addDays(startDateString, i);

    // --- Header row ---
    stickyIndices.push(rows.length);
    dateIndexMap.set(dateString, rows.length);
    rows.push({
      type: "header",
      dateString,
      label: formatHeaderLabel(dateString),
    });

    // --- Event rows for this day ---
    const dayEvents = events
      .filter((e) => eventOccursOn(e, dateString))
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    if (dayEvents.length === 0) {
      rows.push({ type: "empty", dateString });
    } else {
      for (const event of dayEvents) {
        const isFirstOccurrence = !seenEventIds.has(event.id);
        if (isFirstOccurrence) seenEventIds.add(event.id);
        rows.push({
          type: "event",
          dateString,
          event,
          occurence: dateString,
          isFirstOccurrence,
        });
      }
    }
  }

  return { rows, stickyIndices, dateIndexMap };
}

// ---------------------------------------------------------------------------
// Row renderers — each is its own memoized component
// ---------------------------------------------------------------------------

const DayHeader = memo(
  ({ label, isToday }: { label: string; isToday: boolean }) => {
    const { theme } = useContext(ThemeContext);
    return (
      <View
        style={[styles.header, { backgroundColor: theme.eventDarkSecondary }]}
      >
        <Text
          style={[
            styles.headerText,
            { color: isToday ? theme.eventBase : theme.greyBasePrimary },
          ]}
        >
          {label}
        </Text>
        {isToday && (
          <View
            style={[styles.todayPill, { backgroundColor: theme.eventBase }]}
          >
            <Text
              style={[styles.todayPillText, { color: theme.eventDarkPrimary }]}
            >
              Today
            </Text>
          </View>
        )}
      </View>
    );
  },
);

const EmptyDay = memo(() => {
  const { theme } = useContext(ThemeContext);
  return (
    <View style={styles.emptyRow}>
      <Text style={[styles.emptyText, { color: theme.greyBaseSecondary }]}>
        No events scheduled
      </Text>
    </View>
  );
});

// Thin wrapper so EventItem gets stable, memoized props
const EventRow_ = memo(
  ({
    event,
    occurence,
    isFirstOccurrence,
    onEdit,
    onDelete,
  }: {
    event: CalendarEvent;
    occurence: string;
    isFirstOccurrence: boolean;
    onEdit: () => void;
    onDelete: () => void;
  }) => (
    <View style={styles.eventWrapper}>
      <EventItem
        event={event}
        onEdit={isFirstOccurrence ? onEdit : undefined}
        onDelete={onDelete}
      />
    </View>
  ),
  (prev, next) =>
    prev.event === next.event &&
    prev.occurence === next.occurence &&
    prev.isFirstOccurrence === next.isFirstOccurrence &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete,
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventFlashListProps {
  events: CalendarEvent[];
  selectedDateString: string;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string, date: string) => void;
  /** Ref forwarded from parent for programmatic scroll */
  listRef: React.RefObject<FlashListRef<ListRow> | null> | null;
  /** Called once after rows are built — lets parent own rows for scroll sync */
  onRowsReady?: (rows: ListRow[]) => void;
  /** Scroll handler from useScrollSync — wired in by parent */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventFlashList({
  events,
  selectedDateString,
  onEventSelect,
  onDelete,
  listRef,
  onRowsReady,
  onScroll,
}: EventFlashListProps) {
  const { theme } = useContext(ThemeContext);

  const startDateString = useMemo(
    () => addDays(TODAY_STRING, -DAYS_BEFORE),
    [],
  );

  const totalDays = DAYS_BEFORE + DAYS_AFTER + 1;

  const { rows, stickyIndices, dateIndexMap } = useMemo(
    () => buildFlatRows(events, startDateString, totalDays),
    [events, startDateString, totalDays],
  );

  // Lift rows up to parent so useScrollSync can read them
  useEffect(() => {
    onRowsReady?.(rows);
  }, [rows, onRowsReady]);

  // Scroll to selectedDateString whenever it changes
  useEffect(() => {
    const headerIndex = dateIndexMap.get(selectedDateString);
    if (headerIndex == null) return;

    // Small timeout ensures FlashList has completed its layout pass
    // before we attempt to scroll — avoids the "index out of range" error
    const timer = setTimeout(() => {
      listRef?.current?.scrollToIndex({
        index: headerIndex,
        animated: true,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedDateString, dateIndexMap, listRef]);

  // Stable callbacks — new refs only when the handler props change
  const handleEdit = useCallback(
    (event: CalendarEvent) => onEventSelect?.(event),
    [onEventSelect],
  );

  const handleDelete = useCallback(
    (id: string, date: string) => onDelete?.(id, date),
    [onDelete],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListRow }) => {
      if (item.type === "header") {
        return (
          <DayHeader
            label={item.label}
            isToday={item.dateString === TODAY_STRING}
          />
        );
      }

      if (item.type === "empty") {
        return <EmptyDay />;
      }

      // item.type === "event"
      return (
        <EventRow_
          event={item.event}
          occurence={item.occurence}
          isFirstOccurrence={item.isFirstOccurrence}
          onEdit={() => handleEdit(item.event)}
          onDelete={() => handleDelete(item.event.id, item.occurence)}
        />
      );
    },
    [handleEdit, handleDelete],
  );

  const keyExtractor = useCallback(
    (item: ListRow, index: number) =>
      item.type === "event"
        ? `event-${item.event.id}-${item.occurence}`
        : `${item.type}-${item.dateString}-${index}`,
    [],
  );

  // estimatedItemSize: weighted average of the three row types.
  // FlashList uses this for initial layout — closer = better.
  // Most days have 0-2 events so weight toward header+empty pair.
  const estimatedItemSize = HEADER_HEIGHT + EMPTY_HEIGHT / 2;

  const overrideItemLayout = useCallback(
    (
      layout: { span?: number | undefined },
      item: ListRow,
      index: number,
      maxColumns: number,
    ) => {
      if (item.type === "header") layout.span = HEADER_HEIGHT;
      else if (item.type === "empty") layout.span = EMPTY_HEIGHT;
      else layout.span = EVENT_HEIGHT;
    },
    [],
  );

  return (
    <FlashList
      ref={listRef}
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      /* estimatedItemSize={estimatedItemSize} */
      overrideItemLayout={overrideItemLayout}
      stickyHeaderIndices={stickyIndices}
      showsVerticalScrollIndicator={false}
      drawDistance={600}
      extraData={selectedDateString}
      onScroll={onScroll}
      scrollEventThrottle={16}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  todayPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyRow: {
    height: EMPTY_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  eventWrapper: {
    marginHorizontal: 10,
    marginVertical: 1,
  },
});
