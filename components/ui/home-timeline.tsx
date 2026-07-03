import React, {
  memo,
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
import { Checkbox, ProgressBar } from "react-native-paper";
import Animated from "react-native-reanimated";

import { useHabitDeniedFeedback } from "@/components/ui/habits/habit-denied-feedback-util";
import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/context-hooks/use-data";
import { CalendarEvent } from "@/types/calendar";
import { Habit } from "@/types/habits";
import { GlobalMetricKey } from "@/types/metrics";
import { Task } from "@/types/task";
import { TimerLog } from "@/types/timer";
import { checkInHabit } from "@/utils/habit-utils";
import { Ionicons } from "@expo/vector-icons";

interface UnifiedTimelineProps {
  events: CalendarEvent[];
  tasks: Task[];
  timerLogs: TimerLog[];
  habits: Habit[];
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onTaskToggle: (id: string) => void;
  onHabitCheckIn: (habit: Habit) => void;
  onDeleteEvent?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

const HOUR_HEIGHT = 80;
const TIMELINE_START = 0;
const TIMELINE_END = 24;

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

const categoryColorCache = new Map<string, string>();
const getCategoryColor = (id: string, category: string | undefined): string => {
  const key = `${category ?? "default"}-${id}`;
  if (categoryColorCache.has(key)) return categoryColorCache.get(key)!;

  const colorMap: Record<string, string> = {
    work: "#FF6B6B",
    personal: "#4ECDC4",
    health: "#45B7D1",
    social: "#FFA07A",
  };
  if (category && colorMap[category]) {
    categoryColorCache.set(key, colorMap[category]);
    return colorMap[category];
  }
  const red = Math.floor(Math.random() * 56) + 200; // 200-255
  const green = Math.floor(Math.random() * 100); // 0-100
  const blue = Math.floor(Math.random() * 100);
  const color = `#${red.toString(16).padStart(2, "0")}${green
    .toString(16)
    .padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
  categoryColorCache.set(key, color);
  return color;
};

const getPriorityColor = (
  priority: "low" | "medium" | "high",
  theme: any,
): string => {
  return {
    low: theme.success,
    medium: theme.habitBase,
    high: theme.eventBase,
  }[priority];
};

interface HabitCardProps {
  habit: Habit;
  completed: boolean;
  onHabitCheckIn: (habit: Habit) => void;
  trackMetric: (key: GlobalMetricKey[], amount: number) => void;
  theme: any;
}

const HabitCard = memo(
  ({
    habit,
    completed,
    onHabitCheckIn,
    trackMetric,
    theme,
  }: HabitCardProps) => {
    const { playDeniedFeedback, animatedStyle } = useHabitDeniedFeedback();
    const progress = habit.goal ? habit.streak / habit.goal : 0;

    const handlePress = useCallback(() => {
      const result = checkInHabit(habit);
      if (result.status === "denied") {
        playDeniedFeedback();
        return;
      }
      const updatedMetrics: GlobalMetricKey[] = ["habitsCheckedIn"];
      const now = new Date();
      const nowSecs =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const EIGHT_AM = 8 * 3600;
      const TEN_PM = 10 * 3600;
      if (nowSecs <= EIGHT_AM) {
        updatedMetrics.push("habitsCheckedInBefore8am");
      } else if (nowSecs >= TEN_PM) {
        updatedMetrics.push("habitsCheckedInAfter10pm");
      }
      if (result.habit.frequency === "daily")
        trackMetric(["habitsStreakMaxDaily"], result.habit.streak);
      else trackMetric(["habitsStreakMaxWeekly"], result.habit.streak);

      trackMetric(updatedMetrics, 1);
      onHabitCheckIn(result.habit);
    }, [habit, onHabitCheckIn, trackMetric, playDeniedFeedback]);

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={[
            styles.habitCard,
            {
              backgroundColor: theme.habitDarkPrimary,
              borderColor: completed ? theme.success : theme.habitBaseTrans,
            },
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.habitCardHeader}>
            <Text
              style={[styles.habitTitle, { color: theme.whiteBase }]}
              numberOfLines={1}
            >
              {habit.title}
            </Text>
            <Ionicons
              name={completed ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={completed ? theme.success : theme.habitBase}
            />
          </View>
          <View style={styles.habitStats}>
            <Text style={[styles.habitStreak, { color: theme.habitBase }]}>
              🔥 {habit.streak} day streak
            </Text>
            <Text style={[styles.habitGoal, { color: theme.habitBase }]}>
              Goal: {habit.goal}
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={theme.habitBase}
            style={[styles.habitProgress, { backgroundColor: theme.modalBase }]}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

// ─── FIX 4: Static time slots memoized at module level ───
// Was: re-created as JSX on every render
// Theme-dependent border is applied via the parent View's style, not per-slot
const TIME_LABELS = Array.from(
  { length: TIMELINE_END - TIMELINE_START },
  (_, i) => String(i).padStart(2, "0") + ":00",
);

export default function UnifiedTimeline({
  events,
  tasks,
  timerLogs,
  habits,
  selectedDate,
  onEventSelect,
  onTaskToggle,
  onHabitCheckIn,
  onDeleteEvent,
  onDeleteTask,
}: UnifiedTimelineProps) {
  const { theme } = useContext(ThemeContext);
  const { trackMetric } = useData();

  const scrollViewRef = useRef<ScrollView>(null);
  const selectedDateStr = useMemo(
    () => selectedDate.toDateString(),
    [selectedDate],
  );
  const selectedDateISO = useMemo(
    () => selectedDate.toISOString().split("T")[0],
    [selectedDate],
  );

  // ─── FIX 6: isToday computed once, not inline in JSX multiple times ───
  const isToday = useMemo(() => {
    return new Date().toDateString() === selectedDateStr;
  }, [selectedDateStr]);
  // Filter items for selected date
  const filteredData = useMemo(() => {
    // Filter tasks due on this date
    const dayTasks = tasks.filter(
      (task) =>
        new Date(task.dueDate ? task.dueDate : "0").toDateString() ===
        selectedDateStr,
    );

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
      tasks: dayTasks,
      logs: dayLogs,
      events: dayEvents,
      habits: habits,
    };
  }, [
    events,
    tasks,
    timerLogs,
    habits,
    selectedDateStr,
    selectedDateISO,
    selectedDate,
  ]);

  const completedHabitIds = useMemo(() => {
    const todayISO = new Date().toISOString().split("T")[0];
    return new Set(
      filteredData.habits
        .filter((h) => h.history.includes(todayISO))
        .map((h) => h.id),
    );
  }, [filteredData.habits]);

  const completedHabitsCount = completedHabitIds.size;
  // Check if habit was completed today
  /*   const isHabitCompletedToday = (habit: Habit) => {
    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];
    return habit.history.includes(todayISO);
  }; */

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
        color: getCategoryColor(event.id, event.category),
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

  // Calculate positions for tasks (default to 9 AM if no specific time)
  const taskPositions = useMemo(() => {
    return filteredData.tasks.map((task, index) => {
      // Stack tasks at 9 AM, slightly offset
      const baseHour =
        task.reminderDate && new Date(task.reminderDate).getHours();
      const offset = index * 50; // Offset each task by 50px

      return {
        task,
        top: baseHour
          ? baseHour * HOUR_HEIGHT + offset
          : 9 * HOUR_HEIGHT + offset,
        height: 45,
        priorityColor: getPriorityColor(task.priority, theme),
      };
    });
  }, [filteredData.tasks]);

  // Calculate positions for timer logs
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

  // ─── FIX 10: Stable callbacks for handlers ───
  const handleTaskToggle = useCallback(
    (id: string) => {
      onTaskToggle(id);
    },
    [onTaskToggle],
  );

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
  /*   // Scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    const isToday = now.toDateString() === selectedDate.toDateString();

    setTimeout(() => {
      if (isToday) {
        const currentHour = now.getHours();
        const scrollOffset = currentHour * HOUR_HEIGHT - 100;
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollOffset),
          animated: true,
        });
      } else if (eventPositions.length > 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, eventPositions[0].top - 100),
          animated: true,
        });
      }
    }, 100);
  }, [selectedDate, eventPositions]);

  const renderTimeSlots = () => {
    const hours = [];
    for (let i = TIMELINE_START; i < TIMELINE_END; i++) {
      hours.push(
        <View
          key={`slot-${i}`}
          style={[
            styles.timeSlot,
            styles.hourSlot,
            { borderBottomColor: theme.greyBaseSecondary },
          ]}
        >
          <Text style={[styles.timeText, { color: theme.greyBasePrimary }]}>
            {String(i).padStart(2, "0")}:00
          </Text>
        </View>,
      );
    }
    return hours;
  };
 */
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

  const renderTasks = useMemo(() => {
    return taskPositions.map(({ task, top, height, priorityColor }) => (
      <TouchableOpacity
        key={task.id}
        style={[
          styles.taskBlock,
          {
            top,
            height,
            borderColor: theme.taskBase,
            borderRightColor: priorityColor,
            backgroundColor: theme.taskBaseTransToo,
          },
        ]}
        onPress={() => {
          if (!task.completed) trackMetric(["tasksCompleted"], 1);
          handleTaskToggle(task.id);
        }}
      >
        <View>
          <View style={styles.blockHeader}>
            <Checkbox
              status={task.completed ? "checked" : "unchecked"}
              onPress={() => {
                if (!task.completed) {
                  trackMetric(["tasksCompleted"], 1);
                }
                handleTaskToggle(task.id);
              }}
              color={theme.taskBase}
            />
            <Text
              style={[
                [styles.taskTitle, { color: theme.whiteBase }],
                task.completed && [
                  styles.completedTask,
                  { color: theme.greyBasePrimary },
                ],
              ]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
          </View>

          {/* <Text style={[styles.taskSubtext,{color:theme.greyBasePrimary}]}>
            Due: {task.dueDate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Today"}
          </Text> */}
        </View>
      </TouchableOpacity>
    ));
  }, [taskPositions, handleTaskToggle, theme, trackMetric]);

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

  const renderHabits = useMemo(() => {
    /*     const HabitCard = ({ habit }: { habit: Habit }) => {
      const { playDeniedFeedback, animatedStyle } = useHabitDeniedFeedback();
      const completed = isHabitCompletedToday(habit);
      const progress = habit.goal ? habit.streak / habit.goal : 0;
      const handleHabitCheckIn = () => {
        const result = checkInHabit(habit);
        if (result.status === "denied") {
          playDeniedFeedback();
          return;
        }
        trackMetric(["habitsCheckedIn"], 1);
        onHabitCheckIn(result.habit);
      };

      return (
        <AnimatedTouchableOpacity
          key={habit.id}
          style={[
            styles.habitCard,
            {
              backgroundColor: theme.habitDarkPrimary,
              borderColor: theme.habitBaseTrans,
            },
            animatedStyle,
            completed && { borderColor: theme.success },
          ]}
          onPress={handleHabitCheckIn}
        >
          <View style={styles.habitCardHeader}>
            <Text
              style={[styles.habitTitle, { color: theme.whiteBase }]}
              numberOfLines={1}
            >
              {habit.title}
            </Text>
            {completed ? (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={theme.success}
              />
            ) : (
              <Ionicons
                name="ellipse-outline"
                size={24}
                color={theme.habitBase}
              />
            )}
          </View>
          <View style={styles.habitStats}>
            <Text style={[styles.habitStreak, { color: theme.habitBase }]}>
              🔥 {habit.streak} day streak
            </Text>

            <Text style={[styles.habitGoal, { color: theme.habitBase }]}>
              Goal: {habit.goal}
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={theme.habitBase}
            style={[styles.habitProgress, { backgroundColor: theme.modalBase }]}
          />
        </AnimatedTouchableOpacity>
      );
    }; */
    return filteredData.habits.map((habit) => {
      return (
        <HabitCard
          key={habit.id}
          habit={habit}
          completed={completedHabitIds.has(habit.id)}
          onHabitCheckIn={onHabitCheckIn}
          trackMetric={trackMetric}
          theme={theme}
        />
      );
    });
  }, [
    filteredData.habits,
    completedHabitIds,
    onHabitCheckIn,
    trackMetric,
    theme,
  ]);

  const isEmpty =
    filteredData.events.length === 0 &&
    filteredData.tasks.length === 0 &&
    filteredData.logs.length === 0;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.modalDarkPrimary }]}
    >
      {/* Habits Section */}
      {filteredData.habits.length > 0 && (
        <View
          style={[
            styles.habitsContainer,
            {
              backgroundColor: theme.background,
              borderBottomColor: theme.greyBaseSecondary,
            },
          ]}
        >
          <View style={styles.habitHeader}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.habitBase}
              style={{
                textShadowColor: "black",
                textShadowOffset: { width: 0.1, height: 0.1 },
                textShadowRadius: 0.1,
              }}
            />
            <Text style={[styles.habitHeaderText, { color: theme.habitBase }]}>
              Daily Habits
            </Text>
            <Text style={[styles.habitCount, { color: theme.habitBase }]}>
              {completedHabitsCount}/{filteredData.habits.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.habitScroll}
          >
            {renderHabits}
          </ScrollView>
        </View>
      )}

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
            {renderTasks}

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
            {filteredData.tasks.length}
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
            {completedHabitsCount}/{filteredData.habits.length}
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
  habitsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  habitHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    textShadowColor: "black",
    textShadowOffset: { width: 0, height: 0.15 },
    textShadowRadius: 0.1,
    flex: 1,
  },
  habitCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  habitScroll: {
    paddingLeft: 16,
  },
  habitCard: {
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 160,
    borderWidth: 2,
  },
  habitCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  habitTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  habitStats: {
    marginBottom: 8,
  },
  habitStreak: {
    fontSize: 12,
    marginBottom: 2,
  },
  habitGoal: {
    fontSize: 11,
  },
  habitProgress: {
    height: 4,
    borderRadius: 2,
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
  taskBlock: {
    position: "absolute",
    justifyContent: "center",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    borderWidth: 2,
    borderRightWidth: 8,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
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
  taskTitle: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  completedTask: {
    textDecorationLine: "line-through",
  },
  taskSubtext: {
    fontSize: 11,
    marginLeft: 40,
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
