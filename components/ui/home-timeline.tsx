import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { CalendarEvent } from "@/types/calendar";
import { Task } from "@/types/task";
import { TimerLog } from "@/types/timer";
import { Habit } from "@/types/habits";
import { Ionicons } from "@expo/vector-icons";
import { ProgressBar, Checkbox } from "react-native-paper";
import { updateStreak } from "@/utils/habit-utils";

interface UnifiedTimelineProps {
  events: CalendarEvent[];
  tasks: Task[];
  timerLogs: TimerLog[];
  habits: Habit[];
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onTaskToggle?: (id: string) => void;
  onHabitCheckIn?: (habit: Habit) => void;
  onDeleteEvent?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
}

const HOUR_HEIGHT = 80;
const TIMELINE_START = 0;
const TIMELINE_END = 24;

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
  const scrollViewRef = useRef<ScrollView>(null);

  // Filter items for selected date
  const filteredData = useMemo(() => {
    const dateStr = selectedDate.toDateString();
    
    // Filter tasks due on this date
    const dayTasks = tasks.filter(
      (task) => task.dueDate?.toDateString() === dateStr && !task.completed
    );

    // Filter timer logs from this date
    const dayLogs = timerLogs.filter(
      (log) => log.startTime.toDateString() === dateStr
    );

    // Filter events
    const dayEvents = events.filter((event) => {
      const eventDate = event.startTime.toDateString();
      if (eventDate === dateStr) return true;
      if (event.recurrence === "daily") return true;
      if (
        event.recurrence === "weekly" &&
        event.startTime.getDay() === selectedDate.getDay()
      ) {
        return true;
      }
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
    return habit.lastCompleted?.toDateString() === selectedDate.toDateString();
  };

  // Calculate positions for events
  const eventPositions = useMemo(() => {
    return filteredData.events.map((event) => {
      const startHour =
        event.startTime.getHours() + event.startTime.getMinutes() / 60;
      const endHour = event.endTime
        ? event.endTime.getHours() + event.endTime.getMinutes() / 60
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
      const baseHour = 9;
      const offset = index * 50; // Offset each task by 50px
      
      return {
        task,
        top: baseHour * HOUR_HEIGHT + offset,
        height: 45,
      };
    });
  }, [filteredData.tasks]);

  // Calculate positions for timer logs
  const logPositions = useMemo(() => {
    return filteredData.logs.map((log) => {
      const startHour =
        log.startTime.getHours() + log.startTime.getMinutes() / 60;
      const endHour = log.endTime
        ? log.endTime.getHours() + log.endTime.getMinutes() / 60
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
        <View key={`slot-${i}`} style={[styles.timeSlot, styles.hourSlot]}>
          <Text style={styles.timeText}>{String(i).padStart(2, "0")}:00</Text>
        </View>
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
          },
        ]}
        onPress={() => onEventSelect?.(event)}
      >
        <View style={styles.blockContent}>
          <View style={styles.blockHeader}>
            <Ionicons name="calendar" size={14} color="#fff" />
            <Text style={styles.blockTitle} numberOfLines={1}>
              {event.title}
            </Text>
          </View>
          <Text style={styles.blockTime} numberOfLines={1}>
            {event.startTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {event.endTime &&
              ` - ${event.endTime.toLocaleTimeString([], {
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
            borderColor: getPriorityColor(task.priority),
          },
        ]}
        onPress={() => onTaskToggle?.(task.id)}
      >
        <View style={styles.blockContent}>
          <View style={styles.blockHeader}>
            <Checkbox
              status={task.completed ? "checked" : "unchecked"}
              onPress={() => onTaskToggle?.(task.id)}
              color="#673AB7"
            />
            <Text style={[styles.taskTitle, task.completed && styles.completedTask]} numberOfLines={1}>
              {task.title}
            </Text>
          </View>
          <Text style={styles.taskSubtext}>
            Due: {task.dueDate?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Today"}
          </Text>
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
            top,
            height,
          },
        ]}
      >
        <View style={styles.blockContent}>
          <View style={styles.blockHeader}>
            <Ionicons name="timer" size={14} color="#05ce9c" />
            <Text style={styles.logTitle} numberOfLines={1}>
              {log.title}
            </Text>
          </View>
          <Text style={styles.logTime}>
            {log.startTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {log.endTime &&
              ` - ${log.endTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
          </Text>
          {log.duration && (
            <Text style={styles.logDuration}>
              {Math.floor(log.duration / 60)}m {log.duration % 60}s
            </Text>
          )}
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {/* Habits Section */}
      {filteredData.habits.length > 0 && (
        <View style={styles.habitsContainer}>
          <View style={styles.habitHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#f1b718" />
            <Text style={styles.habitHeaderText}>Daily Habits</Text>
            <Text style={styles.habitCount}>
              {filteredData.habits.filter((h) => isHabitCompletedToday(h)).length}/
              {filteredData.habits.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.habitScroll}
          >
            {filteredData.habits.map((habit) => {
              const completed = isHabitCompletedToday(habit);
              const progress = habit.goal ? habit.streak / habit.goal : 0;
              
              return (
                <TouchableOpacity
                  key={habit.id}
                  style={[
                    styles.habitCard,
                    completed && styles.habitCardCompleted,
                  ]}
                  onPress={() => !completed && onHabitCheckIn?.(updateStreak(habit))}
                  disabled={completed}
                >
                  <View style={styles.habitCardHeader}>
                    <Text style={styles.habitTitle} numberOfLines={1}>
                      {habit.title}
                    </Text>
                    {completed ? (
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={24} color="#f1b718" />
                    )}
                  </View>
                  <View style={styles.habitStats}>
                    <Text style={styles.habitStreak}>
                      🔥 {habit.streak} day streak
                    </Text>
                    {habit.goal && (
                      <Text style={styles.habitGoal}>Goal: {habit.goal}</Text>
                    )}
                  </View>
                  <ProgressBar
                    progress={progress}
                    color="#f1b718"
                    style={styles.habitProgress}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.timeline}>
          {/* Time slots */}
          <View style={styles.timeColumn}>{renderTimeSlots()}</View>

          {/* Events container */}
          <View style={styles.eventsColumn}>
            {/* Grid lines */}
            {Array.from({ length: TIMELINE_END - TIMELINE_START }).map(
              (_, i) => (
                <View
                  key={`grid-${i}`}
                  style={[styles.timeSlot, styles.gridLine]}
                />
              )
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
                      (new Date().getHours() +
                        new Date().getMinutes() / 60) *
                      HOUR_HEIGHT,
                  },
                ]}
              >
                <View style={styles.currentTimeDot} />
                <View style={styles.currentTimeLineBar} />
              </View>
            )}

            {/* No items message */}
            {filteredData.events.length === 0 &&
              filteredData.tasks.length === 0 &&
              filteredData.logs.length === 0 && (
                <View style={styles.noItemsContainer}>
                  <Text style={styles.noItemsText}>
                    No scheduled items for this day
                  </Text>
                </View>
              )}
          </View>
        </View>
      </ScrollView>

      {/* Summary footer */}
      <View style={styles.summaryFooter}>
        <View style={styles.summaryItem}>
          <Ionicons name="calendar" size={16} color="#F44336" />
          <Text style={styles.summaryText}>{filteredData.events.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="checkbox" size={16} color="#673AB7" />
          <Text style={styles.summaryText}>{filteredData.tasks.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="timer" size={16} color="#05ce9c" />
          <Text style={styles.summaryText}>{filteredData.logs.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="checkmark-circle" size={16} color="#f1b718" />
          <Text style={styles.summaryText}>
            {filteredData.habits.filter((h) => isHabitCompletedToday(h)).length}/
            {filteredData.habits.length}
          </Text>
        </View>
      </View>
    </View>
  );
}

const getCategoryColor = (category?: string): string => {
  const colorMap: Record<string, string> = {
    work: "#FF6B6B",
    personal: "#4ECDC4",
    health: "#45B7D1",
    social: "#FFA07A",
    default: "#F44336",
  };
  return colorMap[category || "default"] || colorMap.default;
};

const getPriorityColor = (priority: "low" | "medium" | "high"): string => {
  return { low: "#4CAF50", medium: "#FF9800", high: "#F44336" }[priority];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  habitsContainer: {
    backgroundColor: "#2d2a30",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  habitHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  habitHeaderText: {
    color: "#f1b718",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  habitCount: {
    color: "#f1b718",
    fontSize: 14,
    fontWeight: "600",
  },
  habitScroll: {
    paddingLeft: 16,
  },
  habitCard: {
    backgroundColor: "#3b3525",
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 160,
    borderWidth: 2,
    borderColor: "#f1b71844",
  },
  habitCardCompleted: {
    borderColor: "#4CAF50",
    opacity: 0.7,
  },
  habitCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  habitTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  habitStats: {
    marginBottom: 8,
  },
  habitStreak: {
    color: "#f1b718",
    fontSize: 12,
    marginBottom: 2,
  },
  habitGoal: {
    color: "#888",
    fontSize: 11,
  },
  habitProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2b2001",
  },
  timelineContainer: {
    flex: 1,
  },
  timeline: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: "#333",
    backgroundColor: "#2d2a30",
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
    borderBottomColor: "#333",
  },
  timeText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "500",
  },
  gridLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
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
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#25232A88",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  logBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#2e3b3844",
    borderLeftWidth: 4,
    borderLeftColor: "#05ce9c",
  },
  blockContent: {
    flex: 1,
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  blockTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  blockTime: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
  },
  taskTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  completedTask: {
    textDecorationLine: "line-through",
    color: "#888",
  },
  taskSubtext: {
    color: "#888",
    fontSize: 11,
    marginLeft: 40,
  },
  logTitle: {
    color: "#05ce9c",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 6,
    flex: 1,
  },
  logTime: {
    color: "#05ce9c99",
    fontSize: 11,
    marginLeft: 20,
  },
  logDuration: {
    color: "#05ce9c77",
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
    backgroundColor: "#FF5252",
    marginLeft: -6,
  },
  currentTimeLineBar: {
    flex: 1,
    height: 2,
    backgroundColor: "#FF5252",
  },
  noItemsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: HOUR_HEIGHT * 6,
  },
  noItemsText: {
    color: "#888",
    fontSize: 14,
  },
  summaryFooter: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#2d2a30",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});