import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card } from "react-native-paper";
import { XButton } from "../shared/x-button";
import { useData } from "@/hooks/context-hooks/use-data";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagList } from "../shared/tags/tag-list";
import { useEvents } from "@/hooks/context-hooks/use-events";

interface EventItemProps {
  event: CalendarEvent;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function EventItem({ event, onEdit, onDelete }: EventItemProps) {
  const { theme } = useContext(ThemeContext);
  const route = useRoute();
  const { categories } = useData();
  const { events } = useEvents();

  //  Note : We are getting a local copy of the event from the array here insipte of we having already
  // having the same object. This is because the events are being rendered in agenda component from RNC
  // due to heavy cahcing under the hood of agenda, it doesnt udpate the rendered eventItem after updationg for cases whe4re the item is rendered anywhere but
  // alongside the date header on the left. This local copy forces the event item iteself to re-render without the
  // the agenda components list to detect a change
  const eventLocal = events.find((e) => e.id === event.id);
  if (!eventLocal) return null; // deleted
  let eventCategory;
  if (eventLocal.category) {
    eventCategory = categories.find((c) => c.id === eventLocal.category);
  }

  const isNotHome = route.name !== "index";
  const isOverNight =
    new Date(eventLocal.startTime).toLocaleTimeString(undefined, {
      hour12: false,
    }) >
    new Date(eventLocal.endTime).toLocaleTimeString(undefined, {
      hour12: false,
    });
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
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleText, { color: theme.whiteBase }]}>
              {eventLocal.title}
            </Text>
            {eventCategory && (
              <CategoryBadge category={eventCategory} variant="iconOnly" />
            )}
            {isOverNight && (
              <Text style={[styles.overnightText, { color: theme.whiteBase }]}>
                {"- Over Night"}
              </Text>
            )}
          </View>
          {!isNotHome && (
            <Text style={{ color: theme.whiteBase }}>
              Start:{new Date(eventLocal.startTime).toLocaleTimeString()}
            </Text>
          )}
          {!isNotHome && (
            <Text style={{ color: theme.whiteBase }}>
              End:{new Date(eventLocal.endTime).toLocaleTimeString()}
            </Text>
          )}
          {eventLocal.tags && (
            <TagList
              tags={eventLocal.tags}
              holeColor={theme.eventDarkPrimary}
            />
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
  card: { marginVertical: 8 },
  textContainer: { flexWrap: "wrap", flex: 1, flexDirection: "column" },
  titleRow: { flexDirection: "row", gap: 5, alignItems: "center" },
  titleText: { fontSize: 16 },
  overnightText: { fontSize: 11, fontStyle: "italic" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonContainer: {
    flexDirection: "row",
    marginLeft: 8,
    position: "relative",
  },
});
