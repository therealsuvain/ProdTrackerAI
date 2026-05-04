import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "react-native-paper";
import { XButton } from "../shared/x-button";

interface EventItemProps {
  event: CalendarEvent;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function EventItem({ event, onEdit, onDelete }: EventItemProps) {
  const { theme } = useContext(ThemeContext);
  const route = useRoute();
  const isNotHome = route.name !== "index";
  const isOverNight =
    new Date(event.startTime).toLocaleTimeString(undefined, { hour12: false }) >
    new Date(event.endTime).toLocaleTimeString(undefined, { hour12: false });
  //   console.log(new Date(event.startTime).toLocaleTimeString(undefined,{hour12: false}) )
  //   console.log( new Date(event.endTime).toLocaleTimeString(undefined,{hour12: false}))
  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: theme.eventDarkPrimary },
        !isNotHome && { borderRadius: 0 },
      ]}
    >
      <Card.Content style={styles.content}>
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.titleText, { color: theme.whiteBase }]}>
              {event.title}
            </Text>
            {isOverNight && (
              <Text style={[styles.overnightText, { color: theme.whiteBase }]}>
                {"- Over Night"}
              </Text>
            )}
          </View>
          {!isNotHome && (
            <Text style={{ color: theme.whiteBase }}>
              Start:{new Date(event.startTime).toLocaleTimeString()}
            </Text>
          )}
          {!isNotHome && (
            <Text style={{ color: theme.whiteBase }}>
              End:{new Date(event.endTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
        <View style={styles.buttonContainer}>
          {onEdit && (
            <XButton icon="pencil-outline" mode="calendar" onPress={onEdit} />
          )}
          {onDelete && (
            <XButton icon="trash-outline" mode="calendar" onPress={onDelete} />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 8, position: "relative" },
  titleRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  titleText: { fontSize: 16 },
  overnightText: { fontSize: 11, fontStyle: "italic" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonContainer: { flexDirection: "row", marginLeft: 8 },
});
