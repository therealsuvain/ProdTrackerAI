import React, { useMemo, useRef, useEffect, useContext } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
} from "react-native";
import { CalendarEvent } from "@/types/calendar";
import { ThemeContext } from "@/context/ThemeContext";

interface TimelineProps {
  events: CalendarEvent[];
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string, date: string) => void;
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
  const { theme } = useContext(ThemeContext);
  const scrollViewRef = useRef<ScrollView>(null);
  // Separate all-day events and timed events
  const { timedEvents } = useMemo(() => {
    const timed: CalendarEvent[] = [];

    events.forEach((event) => {
      timed.push(event);
    });
    return { timedEvents: timed };
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
      const startHour = event.startTime.getHours();
      const endHour = event.endTime ? event.endTime.getHours() : startHour + 1; // Default 1 hour if no end time

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
          <Text style={[styles.timeText,{color:theme.greyBasePrimary}]}>{String(i).padStart(2, "0")}:00</Text>
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
            opacity: 0.75,
          },
        ]}
        onPress={() => onEventSelect?.(event)}
      >
        <View style={styles.eventContent}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={[styles.eventTitle,{color:theme.whiteBase}]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[styles.eventTime,{color:theme.whiteBaseTrans}]} numberOfLines={1}>
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
            <Text style={[styles.eventDescription,{color:theme.whiteBaseTrans}]} numberOfLines={1}>
              {event.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ));
  };

  const hasEvents = events.length > 0;

  const date = selectedDate.toISOString().split("T")[0];

  return (
    <View
      style={[styles.container, { backgroundColor: theme.modalDarkPrimary }]}
    >
      {/* Timed events timeline */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineContainer}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
      >
        <View
          style={[styles.timeline, { backgroundColor: theme.modalDarkPrimary }]}
        >
          {/* Time slots */}
          <View
            style={[
              styles.timeColumn,
              { borderRightColor: theme.greyBaseSecondary, backgroundColor:theme.greyTimeline },
            ]}
          >
            {renderTimeSlots()}
          </View>

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
                    {borderBottomColor:theme.greyBaseSecondary}
                    
                  ]}
                />
              )
            )}

            {renderEvents()}

            {!hasEvents && (
              <View style={styles.noEventsContainer}>
                <Text
                  style={[
                    styles.noEventsText,
                    { color: theme.greyBasePrimary },
                  ]}
                >
                  No events scheduled
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getCategoryColor = (category?: string): string => {
  // Generate random shade of red (R: 200-255, G: 0-100, B: 0-100)
  const red = Math.floor(Math.random() * 56) + 200; // 200-255
  const green = Math.floor(Math.random() * 100); // 0-100
  const blue = Math.floor(Math.random() * 100); // 0-100

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
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 11,
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 10,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: HOUR_HEIGHT * 6,
  },
  noEventsText: {
    fontSize: 14,
  },
});
