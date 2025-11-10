import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
} from "react-native";
import { CalendarEvent } from "@/types/calendar";
import { getEventsForDate, sortEventsByTime } from "@/utils/event-utils";

interface CalendarListAgendaProps {
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  onEventSelect?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

const DAYS_TO_SHOW = 7;

export default function CalendarListAgenda({
  events,
  onDateSelect,
  selectedDate,
  onEventSelect,
  onDelete,
}: CalendarListAgendaProps) {
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  // Calculate week dates (7 days starting from a specific date)
  useEffect(() => {
    const dates: Date[] = [];
    const startDate = new Date(selectedDate);
    // Start from beginning of week (Sunday)
    startDate.setDate(selectedDate.getDate() - selectedDate.getDay());

    for (let i = 0; i < DAYS_TO_SHOW; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    setWeekDates(dates);
  }, [selectedDate]);

  // Get events for selected date
  const dayEvents = useMemo(() => {
    return sortEventsByTime(getEventsForDate(events, selectedDate));
  }, [events, selectedDate]);

  // Get initials for avatar
  const getInitials = (title: string): string => {
    return title
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get color based on category
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

  const renderWeekStrip = () => {
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <View style={styles.weekStripContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekScroll}
        >
          {weekDates.map((date, index) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const dayLabel = dayLabels[date.getDay()];
            const dayNumber = date.getDate();

            return (
              <Pressable
                key={`${date.toISOString()}-${index}`}
                onPress={() => onDateSelect(date)}
                style={[
                  styles.weekDayButton,
                  isSelected && styles.weekDayButtonSelected,
                ]}
              >
                <Text
                  style={[
                    styles.weekDayLabel,
                    isSelected && styles.weekDayLabelSelected,
                  ]}
                >
                  {dayLabel}
                </Text>
                <Text
                  style={[
                    styles.weekDayNumber,
                    isSelected && styles.weekDayNumberSelected,
                  ]}
                >
                  {dayNumber}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderEventItem = (event: CalendarEvent) => {
    const startTime = event.startTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const endTime = event.endTime
      ? event.endTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : null;

    const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
    const initials = getInitials(event.title);
    const categoryColor = getCategoryColor(event.category);

    return (
      <Pressable
        key={event.id}
        onPress={() => onEventSelect?.(event)}
        style={styles.eventRow}
      >
        <View style={styles.eventContent}>
          <Text style={styles.eventTime}>{timeRange}</Text>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {event.description && (
            <Text style={styles.eventDescription} numberOfLines={1}>
              {event.description}
            </Text>
          )}
          {event.category && (
            <Text style={styles.eventCategory}>{event.category}</Text>
          )}
        </View>

        <View
          style={[styles.eventAvatar, { backgroundColor: categoryColor }]}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </Pressable>
    );
  };

  const formatDateHeader = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return selectedDate.toLocaleDateString("en-US", options);
  };

  return (
    <View style={styles.container}>
      {/* Week Strip */}
      {renderWeekStrip()}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Date Column */}
        <View style={styles.dateColumn}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderNumber}>
              {selectedDate.getDate()}
            </Text>
            <Text style={styles.dateHeaderDay}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                selectedDate.getDay()
              ]}
            </Text>
          </View>

          {/* Date markers for events */}
          {dayEvents.length === 0 && (
            <View style={styles.noEventsMarker}>
              <Text style={styles.noEventsText}>No events</Text>
            </View>
          )}
        </View>

        {/* Events List */}
        <ScrollView
          style={styles.eventsList}
          showsVerticalScrollIndicator={false}
        >
          {dayEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No events scheduled for {formatDateHeader()}
              </Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {dayEvents.map((event) => renderEventItem(event))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  weekStripContainer: {
    backgroundColor: "#2d2a30",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  weekScroll: {
    paddingHorizontal: 8,
  },
  weekDayButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  weekDayButtonSelected: {
    backgroundColor: "#F44336",
  },
  weekDayLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  weekDayLabelSelected: {
    color: "#fff",
  },
  weekDayNumber: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
    marginTop: 4,
  },
  weekDayNumberSelected: {
    color: "#fff",
  },
  divider: {
    height: 1,
    backgroundColor: "#333",
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  dateColumn: {
    width: 70,
    backgroundColor: "#2d2a30",
    borderRightWidth: 1,
    borderRightColor: "#333",
    paddingVertical: 16,
    alignItems: "center",
  },
  dateHeader: {
    alignItems: "center",
    justifyContent: "center",
  },
  dateHeaderNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F44336",
  },
  dateHeaderDay: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    fontWeight: "500",
  },
  noEventsMarker: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noEventsText: {
    fontSize: 10,
    color: "#666",
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 0,
  },
  eventsContainer: {
    paddingVertical: 8,
  },
  eventRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    marginHorizontal: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  eventContent: {
    flex: 1,
    marginRight: 12,
  },
  eventTime: {
    fontSize: 12,
    color: "#F44336",
    fontWeight: "600",
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 2,
  },
  eventDescription: {
    fontSize: 12,
    color: "#aaa",
    marginBottom: 4,
  },
  eventCategory: {
    fontSize: 10,
    color: "#888",
    fontWeight: "500",
    marginTop: 4,
  },
  eventAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    color: "#666",
    fontSize: 14,
  },
});