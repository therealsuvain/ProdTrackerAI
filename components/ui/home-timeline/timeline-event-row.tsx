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
  const title = useEventStore((state) => state.eventsById[id].title);
  const description = useEventStore(
    (state) => state.eventsById[id].description,
  );
  const startTime = useEventStore((state) => state.eventsById[id].startTime);
  const endTime = useEventStore((state) => state.eventsById[id].endTime);
  if (!title || !startTime) return null;
  const eventStartTime = new Date(startTime);
  const eventEndTime = new Date(endTime);
  const startHour =
    eventStartTime.getHours() + eventStartTime.getMinutes() / 60;
  const endHour = endTime
    ? eventEndTime.getHours() + eventEndTime.getMinutes() / 60
    : startHour + 1;

  const top = startHour * HOUR_HEIGHT;
  const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 40);
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
      key={id}
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
      <View style={{ flex: 1 }}>
        <View style={styles.blockHeader}>
          <Ionicons name="calendar" size={14} color={"#ffffff"} />
          <Text
            style={[styles.blockTitle, { color: "#ffffff" }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[styles.blockTime, { color: "#ffffff" }]}
            numberOfLines={1}
          >
            {startTimeLabel}
            {endTimeLabel && ` - ${endTimeLabel}`}
          </Text>
        </View>
        {description && (
          <Text
            style={[styles.eventDescription, { color: "#ffffff" + "75" }]}
            numberOfLines={1}
          >
            {description}
          </Text>
        )}
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
  eventDescription: {
    fontSize: 10,
  },
});
