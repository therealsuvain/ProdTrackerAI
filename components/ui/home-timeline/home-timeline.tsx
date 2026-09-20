import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const EMPTY_IDS: string[] = [];
const EMPTY_TIMELINE_DATA = {
  tasks: [],
  logs: [],
  events: [],
  habits: [],
};

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/context-hooks/use-data";
import { CalendarEvent } from "@/types/calendar";
import { TimerLog } from "@/types/timer";
import { Ionicons } from "@expo/vector-icons";
import { selectedDateTaskIds, useTaskStore } from "@/stores/use-task-store";
import { useShallow } from "zustand/shallow";
import { useIsFocused } from "@react-navigation/native";
import { TimelineTasks } from "./timeline-tasks";
import { CheckInOutcome } from "@/utils/Data-services/habit-services/habit-actions";
import { useHabitStore } from "@/stores/use-habit-store";
import { TimelineHabits } from "./timeline-habits";
import { selectedDateEventIds, useEventStore } from "@/stores/use-event-store";
import {
  selectedDateLogIds,
  useTimerLogStore,
} from "@/stores/use-timerLog-store";

interface UnifiedTimelineProps {
  events: CalendarEvent[];
  timerLogs: TimerLog[];
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onTaskToggle: (id: string) => void;
  onHabitCheckIn: (id: string) => Promise<CheckInOutcome | undefined>;
  onDeleteEvent?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

const HOUR_HEIGHT = 80;
const TIMELINE_START = 0;
const TIMELINE_END = 24;

// ─── FIX 4: Static time slots memoized at module level ───
// Was: re-created as JSX on every render
// Theme-dependent border is applied via the parent View's style, not per-slot
const TIME_LABELS = Array.from(
  { length: TIMELINE_END - TIMELINE_START },
  (_, i) => String(i).padStart(2, "0") + ":00",
);

export default function UnifiedTimeline({
  events,
  timerLogs,
  selectedDate,
  onEventSelect,
  onTaskToggle,
  onHabitCheckIn,
  onDeleteEvent,
}: UnifiedTimelineProps) {
  const { theme } = useContext(ThemeContext);
  const { trackMetric } = useData();
  const isFocused = useIsFocused();
  const scrollViewRef = useRef<ScrollView>(null);
  const selectedDateStr = useMemo(
    () => selectedDate.toDateString(),
    [selectedDate],
  );
  const selectedDateISO = useMemo(
    () => selectedDate.toISOString().split("T")[0],
    [selectedDate],
  );
  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  // ─── FIX 6: isToday computed once, not inline in JSX multiple times ───
  const isToday = useMemo(() => {
    return new Date().toDateString() === selectedDateStr;
  }, [selectedDateStr]);

  const taskIds = useTaskStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;

      return selectedDateTaskIds(state, selectedDateISO);
    }),
  );

  const habitIds = useHabitStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;
      return Object.keys(state.habitsById);
    }),
  );
  const completedHabitIds = useHabitStore(
    useShallow((state) => {
      return Object.values(state.habitsById);
    }),
  )
    .filter((h) => h.history.includes(todayISO))
    .map((h) => h.id);

  const completedHabitsCount = completedHabitIds.length;
  const taskCount = taskIds.length;
  // Filter items for selected date
  const eventIds = useEventStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;

      return selectedDateEventIds(state, selectedDate);
    }),
  );

  const logIds = useTimerLogStore(
    useShallow((state) => {
      if (!isFocused) return EMPTY_IDS;
      return selectedDateLogIds(state, selectedDateISO);
    }),
  );

  const filteredData = useMemo(() => {
    if (!isFocused) {
      return EMPTY_TIMELINE_DATA;
    }

    // Filter timer logs from this date
    const dayLogs = timerLogs.filter(
      (log) => new Date(log.startTime).toDateString() === selectedDateStr,
    );

    // Filter events
    const dayEvents = events.filter((event) => {
      const eventStartDate = new Date(event.startDate);
      const eventStartDatePart = eventStartDate.toISOString().split("T")[0];
      //TODOX Fix below ??
      const eventEndDatePart = new Date(event.endDate ?? eventStartDate)
        .toISOString()
        .split("T")[0];
      const eventStartDateString = eventStartDate.toDateString();
      const todayDateIso = selectedDate.toISOString().split("T")[0];
      if (event.deletedOccurrences?.includes(todayDateIso)) return false;
      if (eventStartDateString === selectedDateStr) return true;
      if (event.recurrence === "daily") {
        if (
          eventStartDatePart <= selectedDateISO &&
          selectedDateISO <= eventEndDatePart
        )
          return true;
      }
      if (event.recurrence === "weekly")
        if (
          eventStartDatePart <= selectedDateISO &&
          selectedDateISO <= eventEndDatePart &&
          eventStartDate.getDay() === selectedDate.getDay()
        )
          return true;

      return false;
    });

    // All habits are shown (they're daily check-ins)
    return {
      logs: dayLogs,
      events: dayEvents,
    };
  }, [events, timerLogs, selectedDateStr, selectedDateISO, selectedDate]);

  // Calculate positions for events
  const eventPositions = useMemo(() => {
    return filteredData.events.map((event) => {
      const eventStartTime = new Date(event.startTime);
      const eventEndTime = new Date(event.endTime);
      const startHour =
        eventStartTime.getHours() + eventStartTime.getMinutes() / 60;
      const endHour = event.endTime
        ? eventEndTime.getHours() + eventEndTime.getMinutes() / 60
        : startHour + 1;

      return {
        event,
        top: startHour * HOUR_HEIGHT,
        height: Math.max((endHour - startHour) * HOUR_HEIGHT, 40),
        color: "red",
        startTimeLabel: eventStartTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        endTimeLabel: event.endTime
          ? eventEndTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
      };
    });
  }, [filteredData.events]);

  const logPositions = useMemo(() => {
    return filteredData.logs.map((log) => {
      const startHour =
        new Date(log.startTime).getHours() +
        new Date(log.startTime).getMinutes() / 60;
      const endHour = log.endTime
        ? new Date(log.endTime).getHours() +
          new Date(log.endTime).getMinutes() / 60
        : startHour + (log.duration ? log.duration / 3600 : 1);

      return {
        log,
        top: startHour * HOUR_HEIGHT,
        height: Math.max((endHour - startHour) * HOUR_HEIGHT, 35),
        startTimeLabel: new Date(log.startTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        endTimeLabel: log.endTime
          ? new Date(log.endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        durationLabel: log.duration
          ? `${Math.floor(log.duration / 60)}m ${log.duration % 60}s`
          : null,
      };
    });
  }, [filteredData.logs]);
  const currentTimeTop = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  }, []); // only needs to compute once on mount; re-renders won't move it noticeably

  // ─── FIX 9: Scroll effect deps cleaned up ───
  // Was: depended on eventPositions (new array ref every render) → fired too often
  const firstEventTop = eventPositions[0]?.top ?? null;
  const firstEventTop2 = useEventStore(
    (state) => state.eventsById[eventIds[0]].startTime,
  );
  const firstEventTop3 = useMemo(
    () => new Date(firstEventTop2).getHours() * HOUR_HEIGHT,
    [firstEventTop2],
  );

  useEffect(() => {
    const scrollTarget = isToday
      ? Math.max(0, new Date().getHours() * HOUR_HEIGHT - 100)
      : firstEventTop !== null
        ? Math.max(0, firstEventTop - 100)
        : null;

    if (scrollTarget === null) return;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: scrollTarget, animated: true });
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]); // Only scroll when the date actually changes

  const handleEventSelect = useCallback(
    (event: CalendarEvent) => {
      onEventSelect?.(event);
    },
    [onEventSelect],
  );

  // ─── FIX 11: Memoized render outputs ───
  // Was: plain functions recreating JSX arrays every render regardless of data changes

  const timeSlots = useMemo(
    () =>
      TIME_LABELS.map((label, i) => (
        <View
          key={i}
          style={[
            styles.timeSlot,
            styles.hourSlot,
            { borderBottomColor: theme.greyBaseSecondary },
          ]}
        >
          <Text style={[styles.timeText, { color: theme.greyBasePrimary }]}>
            {label}
          </Text>
        </View>
      )),
    [theme.greyBaseSecondary, theme.greyBasePrimary],
  );

  const gridLines = useMemo(
    () =>
      Array.from({ length: TIMELINE_END - TIMELINE_START }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.timeSlot,
            styles.gridLine,
            { borderBottomColor: theme.greyBaseSecondary },
          ]}
        />
      )),
    [theme.greyBaseSecondary],
  );

  const renderEvents = useMemo(() => {
    return eventPositions.map(
      ({ event, top, height, color, startTimeLabel, endTimeLabel }) => (
        <TouchableOpacity
          key={event.id}
          style={[
            styles.eventBlock,
            {
              top,
              height,
              backgroundColor: color,
              opacity: 0.75,
            },
          ]}
          onPress={() => handleEventSelect(event)}
        >
          <View>
            <View style={styles.blockHeader}>
              <Ionicons name="calendar" size={14} color={theme.whiteBase} />
              <Text
                style={[styles.blockTitle, { color: theme.whiteBase }]}
                numberOfLines={1}
              >
                {event.title}
              </Text>
            </View>
            <Text
              style={[styles.blockTime, { color: theme.whiteBaseTrans }]}
              numberOfLines={1}
            >
              {startTimeLabel}
              {endTimeLabel && ` - ${endTimeLabel}`}
            </Text>
          </View>
        </TouchableOpacity>
      ),
    );
  }, [
    eventPositions,
    handleEventSelect,
    theme.whiteBase,
    theme.whiteBaseTrans,
  ]);

  const renderTimerLogs = useMemo(() => {
    return logPositions.map(
      ({ log, top, height, startTimeLabel, endTimeLabel, durationLabel }) => (
        <View
          key={log.id}
          style={[
            styles.logBlock,
            {
              top,
              height,
              borderLeftColor: theme.timerBase,
              backgroundColor: theme.timerBaseTransToo,
            },
          ]}
        >
          <View style={styles.blockHeader}>
            <Ionicons name="timer" size={14} color={theme.timerBase} />
            <Text
              style={[styles.logTitle, { color: theme.timerBase }]}
              numberOfLines={1}
            >
              {log.title}
            </Text>
            <Text style={[styles.logTime, { color: theme.timerBaseTrans }]}>
              {startTimeLabel}
              {endTimeLabel && ` - ${endTimeLabel}`}
            </Text>
            {durationLabel && (
              <Text
                style={[styles.logDuration, { color: theme.timerBaseTrans }]}
              >
                {durationLabel}
              </Text>
            )}
          </View>
        </View>
      ),
    );
  }, [logPositions, theme]);

  const isEmpty =
    filteredData.events.length === 0 && filteredData.logs.length === 0;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.modalDarkPrimary }]}
    >
      <TimelineHabits
        habitIds={habitIds}
        completedHabitsCount={completedHabitsCount}
        onHabitCheckIn={onHabitCheckIn}
      />
      {/* Timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={true}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      >
        <View
          style={[styles.timeline, { backgroundColor: theme.modalDarkPrimary }]}
        >
          {/* Time slots */}
          <View
            style={[
              styles.timeColumn,
              {
                backgroundColor: theme.greyTimeline,
                borderRightColor: theme.greyBaseSecondary,
              },
            ]}
          >
            {timeSlots}
          </View>

          {/* Events container */}
          <View style={styles.eventsColumn}>
            {/* Grid lines */}
            {/*  {Array.from({ length: TIMELINE_END - TIMELINE_START }).map(
              (_, i) => (
                <View
                  key={`grid-${i}`}
                  style={[
                    styles.timeSlot,
                    [
                      styles.gridLine,
                      { borderBottomColor: theme.greyBaseSecondary },
                    ],
                  ]}
                />
              ),
            )} */}
            {gridLines}
            {/* Render all timeline items */}
            {renderTimerLogs}
            {renderEvents}
            <TimelineTasks
              taskIds={taskIds}
              selectedDateISO={selectedDateISO}
              onToggleTask={onTaskToggle}
              color={theme.taskBase}
            />
            {/* Current time indicator (if today) */}
            {isToday && (
              <View style={[styles.currentTimeLine, { top: currentTimeTop }]}>
                <View
                  style={[
                    styles.currentTimeDot,
                    { backgroundColor: theme.error },
                  ]}
                />
                <View
                  style={[
                    styles.currentTimeLineBar,
                    { backgroundColor: theme.error },
                  ]}
                />
              </View>
            )}

            {/* No items message */}
            {isEmpty && (
              <View style={styles.noItemsContainer}>
                <Text
                  style={[styles.noItemsText, { color: theme.greyBasePrimary }]}
                >
                  No scheduled items for this day
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Summary footer */}
      <View
        style={[
          styles.summaryFooter,
          {
            backgroundColor: theme.greyTimeline,
            borderTopColor: theme.greyBaseSecondary,
          },
        ]}
      >
        <View style={styles.summaryItem}>
          <Ionicons name="calendar" size={16} color={theme.eventBase} />
          <Text style={[styles.summaryText, { color: theme.whiteBase }]}>
            {filteredData.events.length}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="checkbox" size={16} color={theme.taskBase} />
          <Text style={[styles.summaryText, { color: theme.whiteBase }]}>
            {taskCount}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="timer" size={16} color={theme.timerBase} />
          <Text style={[styles.summaryText, { color: theme.whiteBase }]}>
            {filteredData.logs.length}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="checkmark-circle" size={16} color={theme.habitBase} />
          <Text style={[styles.summaryText, { color: theme.whiteBase }]}>
            {completedHabitsCount}/{habitIds.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  timelineContainer: {
    flex: 1,
  },
  timeline: {
    flexDirection: "row",
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
  },
  eventsColumn: {
    flex: 1,
    position: "relative",
    minHeight: HOUR_HEIGHT * (TIMELINE_END - TIMELINE_START),
  },
  timeSlot: {
    height: HOUR_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  hourSlot: {
    borderBottomWidth: 1,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  gridLine: {
    borderBottomWidth: 1,
  },
  eventBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    overflow: "hidden",
  },

  logBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 4,
  },
  blockContent: {},
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  blockTime: {
    fontSize: 11,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 6,
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    marginLeft: 20,
  },
  logDuration: {
    fontSize: 10,
    marginLeft: 20,
    fontStyle: "italic",
  },
  currentTimeLine: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 999,
  },
  currentTimeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: HOUR_HEIGHT * 6,
  },
  noItemsText: {
    fontSize: 14,
  },
  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
