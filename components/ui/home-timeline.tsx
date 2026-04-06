import React, { useMemo, useRef, useEffect, useContext } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { ProgressBar, Checkbox, Badge } from "react-native-paper";
import Animated from "react-native-reanimated";

import { CalendarEvent } from "@/types/calendar";
import { Task } from "@/types/task";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";
import { Ionicons } from "@expo/vector-icons";
import { useHabitDeniedFeedback } from "@/components/ui/habits/habit-denied-feedback-util";
import { checkInHabit } from "@/utils/habit-utils";
import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";

// TODO 40 : Optimize this
// TODO 41 : Task checkins are dummies
// TODO 103 : on task completion, the scrollview offset resets and entire page reloads very awkwardly
// TODO 104 : on habit checkin, the entire page relaods very awkwardly
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
  const getPriorityColor = (priority: "low" | "medium" | "high"): string => {
    return {
      low: theme.success,
      medium: theme.habitBase,
      high: theme.eventBase,
    }[priority];
  };

  const scrollViewRef = useRef<ScrollView>(null);
  // Filter items for selected date
  const filteredData = useMemo(() => {
    const dateStr = selectedDate.toDateString();

    // Filter tasks due on this date
    const dayTasks = tasks.filter(
      (task) =>
        new Date(task.dueDate ? task.dueDate : "0").toDateString() === dateStr,
    );

    // Filter timer logs from this date
    const dayLogs = timerLogs.filter(
      (log) => new Date(log.startTime).toDateString() === dateStr,
    );

    // Filter events
    const dayEvents = events.filter((event) => {
      const eventStartDate = new Date(event.startDate);
      const eventStartDatePart = eventStartDate.toISOString().split("T")[0];
      //TODO Fix below ??
      const eventEndDatePart = new Date(event.endDate ?? eventStartDate)
        .toISOString()
        .split("T")[0];
      const eventStartDateString = eventStartDate.toDateString();
      const todayDateIso = selectedDate.toISOString().split("T")[0];
      if (event.deletedOccurrences?.includes(todayDateIso)) return false;
      if (eventStartDateString === dateStr) return true;
      if (event.recurrence === "daily") {
        if (
          eventStartDatePart <= todayDateIso &&
          todayDateIso <= eventEndDatePart
        )
          return true;
      }
      if (event.recurrence === "weekly")
        if (
          eventStartDatePart <= todayDateIso &&
          todayDateIso <= eventEndDatePart
        )
          if (eventStartDate.getDay() === selectedDate.getDay()) return true;

      return false;
    });

    // All habits are shown (they're daily check-ins)
    return {
      tasks: dayTasks,
      logs: dayLogs,
      events: dayEvents,
      habits: habits,
    };
  }, [events, tasks, timerLogs, habits, selectedDate]);

  // Check if habit was completed today
  const isHabitCompletedToday = (habit: Habit) => {
    const today = new Date();
    const todayISO = today.toISOString().split("T")[0];
    return habit.history.includes(todayISO);
  };

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
      };
    });
  }, [filteredData.logs]);

  // Scroll to current time on mount
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

  const renderEvents = () => {
    return eventPositions.map(({ event, top, height }) => (
      <TouchableOpacity
        key={`event-${event.id}`}
        style={[
          styles.eventBlock,
          {
            top,
            height,
            backgroundColor: getCategoryColor(event.category),
            opacity: 0.75,
          },
        ]}
        onPress={() => onEventSelect?.(event)}
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
            {new Date(event.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {event.endTime &&
              ` - ${new Date(event.endTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </Text>
        </View>
      </TouchableOpacity>
    ));
  };

  const renderTasks = () => {
    return taskPositions.map(({ task, top, height }) => (
      <TouchableOpacity
        key={`task-${task.id}`}
        style={[
          styles.taskBlock,
          {
            top,
            height,
            borderColor: theme.taskBase,
            borderRightColor: getPriorityColor(task.priority),
            backgroundColor: theme.taskBaseTransToo,
          },
        ]}
        onPress={() => onTaskToggle(task.id)}
      >
        <View>
          <View style={styles.blockHeader}>
            <Checkbox
              status={task.completed ? "checked" : "unchecked"}
              onPress={() => {
                if(!task.completed){
                  trackMetric(["tasksCompleted"], 1);
                }
                onTaskToggle?.(task.id);
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
  };

  const renderTimerLogs = () => {
    return logPositions.map(({ log, top, height }) => (
      <View
        key={`log-${log.id}`}
        style={[
          styles.logBlock,
          {
            borderLeftColor: theme.timerBase,
            backgroundColor: theme.timerBaseTransToo,
          },
          {
            top,
            height,
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
            {new Date(log.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {log.endTime &&
              ` - ${new Date(log.endTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </Text>
          {log.duration && (
            <Text style={[styles.logDuration, { color: theme.timerBaseTrans }]}>
              {Math.floor(log.duration / 60)}m {log.duration % 60}s
            </Text>
          )}
        </View>
      </View>
    ));
  };

  const renderHabits = () => {
    const HabitCard = ({ habit }: { habit: Habit }) => {
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
    };
    return filteredData.habits.map((habit) => {
      return <HabitCard key={habit.id} habit={habit} />;
    });
  };

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
              backgroundColor: theme.greyTimeline,
              borderBottomColor: theme.greyBaseSecondary,
            },
          ]}
        >
          <View style={styles.habitHeader}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={theme.habitBase}
            />
            <Text style={[styles.habitHeaderText, { color: theme.habitBase }]}>
              Daily Habits
            </Text>
            <Text style={[styles.habitCount, { color: theme.habitBase }]}>
              {
                filteredData.habits.filter((h) => isHabitCompletedToday(h))
                  .length
              }
              /{filteredData.habits.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.habitScroll}
          >
            {renderHabits()}
          </ScrollView>
        </View>
      )}

      {/* Timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={true}
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
            {renderTimeSlots()}
          </View>

          {/* Events container */}
          <View style={styles.eventsColumn}>
            {/* Grid lines */}
            {Array.from({ length: TIMELINE_END - TIMELINE_START }).map(
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
            )}

            {/* Render all timeline items */}
            {renderTimerLogs()}
            {renderEvents()}
            {renderTasks()}

            {/* Current time indicator (if today) */}
            {selectedDate.toDateString() === new Date().toDateString() && (
              <View
                style={[
                  styles.currentTimeLine,
                  {
                    top:
                      (new Date().getHours() + new Date().getMinutes() / 60) *
                      HOUR_HEIGHT,
                  },
                ]}
              >
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
            {filteredData.events.length === 0 &&
              filteredData.tasks.length === 0 &&
              filteredData.logs.length === 0 && (
                <View style={styles.noItemsContainer}>
                  <Text
                    style={[
                      styles.noItemsText,
                      { color: theme.greyBasePrimary },
                    ]}
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
            {filteredData.habits.filter((h) => isHabitCompletedToday(h)).length}
            /{filteredData.habits.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const getCategoryColor = (category?: string): string => {
  const red = Math.floor(Math.random() * 56) + 200; // 200-255
  const green = Math.floor(Math.random() * 100); // 0-100
  const blue = Math.floor(Math.random() * 100);

  const colorMap: Record<string, string> = {
    work: "#FF6B6B",
    personal: "#4ECDC4",
    health: "#45B7D1",
    social: "#FFA07A",
    default: `#${red.toString(16).padStart(2, "0")}${green
      .toString(16)
      .padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`,
  };
  return colorMap[category || "default"] || colorMap.default;
};

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
