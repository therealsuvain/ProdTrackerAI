import { useEventStore } from "@/stores/use-event-store";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";

const HOUR_HEIGHT = 80;

interface TimelineEventRowProps {
  id: string;
  color: string;
}

export const TimelineEventRow = React.memo(function TimelineEventRow({
  id,
  color,
}: TimelineEventRowProps) {
  const event = useEventStore((state) => state.eventsById[id]);
  if (!event) return null;
  const eventStartTime = new Date(event.startTime);
  const eventEndTime = new Date(event.endTime);
  const startHour =
    eventStartTime.getHours() + eventStartTime.getMinutes() / 60;
  const endHour = event.endTime
    ? eventEndTime.getHours() + eventEndTime.getMinutes() / 60
    : startHour + 1;

  const top = startHour * HOUR_HEIGHT;
  const height = (endHour - startHour) * HOUR_HEIGHT;
  const startTimeLabel = `${eventStartTime.getHours()}:${eventStartTime
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const endTimeLabel = eventEndTime
    ? `${eventEndTime.getHours()}:${eventEndTime
        .getMinutes()
        .toString()
        .padStart(2, "0")}`
    : undefined;
  return (
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
      onPress={() => {}}
    >
      <View>
        <View style={styles.blockHeader}>
          <Ionicons name="calendar" size={14} color={"#ffffff"} />
          <Text
            style={[styles.blockTitle, { color: "#ffffff" }]}
            numberOfLines={1}
          >
            {event.title}
          </Text>
        </View>
        <Text
          style={[styles.blockTime, { color: "#ffffff" + "50" }]}
          numberOfLines={1}
        >
          {startTimeLabel}
          {endTimeLabel && ` - ${endTimeLabel}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  eventBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 8,
    overflow: "hidden",
  },
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
});
