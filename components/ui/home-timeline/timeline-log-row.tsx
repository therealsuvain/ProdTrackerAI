import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";

const HOUR_HEIGHT = 80;

interface TimelineLogRowProps {
  id: string;
  color: string;
}

export const TimelineLogRow = React.memo(function TimelineLogRow({
  id,
  color,
}: TimelineLogRowProps) {
  //TODO log labels and ehight kinda wonky duer to shart times
  const title = useTimerLogStore((state) => state.logsById[id].title);
  const startTime = useTimerLogStore((state) => state.logsById[id].startTime);
  const endTime = useTimerLogStore((state) => state.logsById[id].endTime);
  const duration = useTimerLogStore((state) => state.logsById[id].duration);
  if (!title || !startTime || !endTime || !duration) return null;
  const startHour =
    new Date(startTime).getHours() + new Date(startTime).getMinutes() / 60;
  const endHour = endTime
    ? new Date(endTime).getHours() + new Date(endTime).getMinutes() / 60
    : startHour + (duration ? duration / 3600 : 1);

  const top = startHour * HOUR_HEIGHT;
  const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 15);
  const startTimeLabel = new Date(startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeLabel = endTime
    ? new Date(endTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const durationLabel = duration
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : null;
  return (
    <View
      key={id}
      style={[
        styles.logBlock,
        {
          top,
          height,
          borderLeftColor: color,
          backgroundColor: color + "55",
        },
      ]}
    >
      <View style={styles.blockHeader}>
        <Ionicons name="timer" size={12} color={color} />
        <Text style={[styles.logTitle, { color: color }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.logTime, { color: color }]}>
          {startTimeLabel}
          {endTimeLabel && ` - ${endTimeLabel}`}
        </Text>
        {durationLabel && (
          <Text style={[styles.logDuration, { color: color }]}>
            {durationLabel}
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  logBlock: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    padding: 1,
    borderLeftWidth: 4,
  },
  logTitle: {
    fontSize: 10,
    fontWeight: "500",
    marginLeft: 6,
  },
  logTime: {
    fontSize: 10,
    marginLeft: 20,
  },
  logDuration: {
    fontSize: 10,
    marginLeft: 20,
    fontStyle: "italic",
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
});
