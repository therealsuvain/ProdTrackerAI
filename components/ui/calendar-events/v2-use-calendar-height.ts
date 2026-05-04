import { useCallback, useState } from "react";
import {
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Height constants
// ---------------------------------------------------------------------------
//
// These are the two heights the calendar animates between.
//
// EXPANDED  = month title + weekday header row + 6 week rows (max any month)
// COLLAPSED = month title + weekday header row + 1 week row
//
// We compute them from fixed row heights so we never need an onLayout pass.
// If you change font sizes or cell padding in MonthGrid, update these.

const MONTH_TITLE_HEIGHT = 36;   // "April 2026" text row
const WEEKDAY_ROW_HEIGHT = 28;   // "Sun Mon Tue ..." row
const WEEK_ROW_HEIGHT = 56;      // one row of day cells (circle + dots)

// A month can have at most 6 rows of weeks (e.g. March 2026 starts on Sun,
// has 31 days → 5 rows; but some months need 6). We use 6 as the safe max.
const MAX_WEEK_ROWS = 6;
const MIN_WEEK_ROWS = 1;

export const EXPANDED_HEIGHT =
  MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + WEEK_ROW_HEIGHT * MAX_WEEK_ROWS;

export const COLLAPSED_HEIGHT =
  MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + WEEK_ROW_HEIGHT * MIN_WEEK_ROWS;

// Spring config — matches CollapsibleKnob
const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseCalendarHeightReturn {
  calendarHeight: SharedValue<number>;
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  onKnobExpandedChange: (expanded: boolean) => void;
}

export function useCalendarHeight(): UseCalendarHeightReturn {
  // SharedValue lives on the UI thread — driving the Animated.View height
  // without touching the JS thread during the animation itself
  const calendarHeight = useSharedValue(EXPANDED_HEIGHT);

  // JS-side boolean — used to conditionally render things or pass to parent
  const [isExpanded, setIsExpanded] = useState(true);

  const expand = useCallback(() => {
    calendarHeight.value = withSpring(EXPANDED_HEIGHT, SPRING_CONFIG);
    setIsExpanded(true);
  }, [calendarHeight]);

  const collapse = useCallback(() => {
    calendarHeight.value = withSpring(COLLAPSED_HEIGHT, SPRING_CONFIG);
    setIsExpanded(false);
  }, [calendarHeight]);

  const toggle = useCallback(() => {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }, [isExpanded, expand, collapse]);

  // Called by CollapsibleKnob after the drag-snap animation completes
  const onKnobExpandedChange = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
  }, []);

  return {
    calendarHeight,
    isExpanded,
    expand,
    collapse,
    toggle,
    onKnobExpandedChange,
  };
}
