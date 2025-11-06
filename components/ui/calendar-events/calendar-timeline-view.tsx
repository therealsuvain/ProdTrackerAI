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
import EventItem from "./event-item";

interface TimelineProps {
  events: CalendarEvent[];
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  selectedDate: Date;
}

const HOUR_HEIGHT = 80;
const TIMELINE_START = 0; // 00:00
const TIMELINE_END = 24; // 24:00

export default function Timeline({
  events,
  onEventSelect,
  onDelete,
  selectedDate,
}: TimelineProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Separate all-day events and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events.forEach((event) => {
      // Check if event is all-day (endTime is missing or starts at midnight)
      const isAllDay =
        !event.endTime ||
        (event.startTime.getHours() === 0 &&
          event.startTime.getMinutes() === 0 &&
          event.endTime.getHours() === 0 &&
          event.endTime.getMinutes() === 0);

      if (isAllDay) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Sort timed events by start time
  const sortedTimedEvents = useMemo(() => {
    return [...timedEvents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
  }, [timedEvents]);

  // Calculate position and height for each event
  const eventPositions = useMemo(() => {
    return sortedTimedEvents.map((event) => {
      const startHour =
        event.startTime.getHours() + event.startTime.getMinutes() / 60;
      const endHour = event.endTime
        ? event.endTime.getHours() + event.endTime.getMinutes() / 60
        : startHour + 1; // Default 1 hour if no end time

      return {
        event,
        top: startHour * HOUR_HEIGHT,
        height: Math.max((endHour - startHour) * HOUR_HEIGHT, 40), // Minimum height
      };
    });
  }, [sortedTimedEvents]);

  // Scroll to current time or first event on mount
  useEffect(() => {
    const now = new Date();
    const isToday =
      now.toDateString() === selectedDate.toDateString();

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
          <Text style={styles.timeText}>
            {String(i).padStart(2, "0")}:00
          </Text>
        </View>
      );
    }
    return hours;
  };

  const renderEvents = () => {
    return eventPositions.map(({ event, top, height }) => (
      <TouchableOpacity
        key={event.id}
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
        <View style={styles.eventContent}>
          <View style={{flexDirection:'row', justifyContent:"space-between"}}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.eventTime} numberOfLines={1}>
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
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={1}>
              {event.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ));
  };

  const hasEvents = events.length > 0;

  return (
    <View style={styles.container}>
      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <View style={styles.allDayContainer}>
          <Text style={styles.allDayHeader}>All Day</Text>
          <View style={styles.allDayEvents}>
            {allDayEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => onEventSelect?.(event)}
                style={styles.allDayEventItem}
              >
                <EventItem
                  event={event}
                  onEdit={() => onEventSelect?.(event)}
                  onDelete={() => onDelete?.(event.id)}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Timed events timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineContainer}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.timeline}>
          {/* Time slots */}
          <View style={styles.timeColumn}>{renderTimeSlots()}</View>

          {/* Events container */}
          <View style={styles.eventsColumn}>
            {/* Grid lines for each hour */}
            {Array.from({ length: TIMELINE_END - TIMELINE_START }).map(
              (_, i) => (
                <View
                  key={`grid-${i}`}
                  style={[
                    styles.timeSlot,
                    styles.gridLine,
                    i === 0 ? styles.firstGridLine : {},
                  ]}
                />
              )
            )}

            {/* Events */}
            {renderEvents()}

            {/* No events message */}
            {!hasEvents && (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>No events scheduled</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Helper function to get color based on category
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  allDayContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    padding: 8,
  },
  allDayHeader: {
    color: "#F44336",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  allDayEvents: {
    gap: 4,
  },
  allDayEventItem: {
    marginBottom: 4,
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
  firstGridLine: {
    borderBottomWidth: 0,
  },
  eventBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    marginVertical: 2,
    padding: 8,
    overflow: "hidden",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  eventTime: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    marginBottom: 4,
  },
  eventDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: HOUR_HEIGHT * 6,
  },
  noEventsText: {
    color: "#888",
    fontSize: 14,
  },
});