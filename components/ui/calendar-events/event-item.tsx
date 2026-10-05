import { ThemeContext } from "@/context/ThemeContext";
import { CalendarEvent } from "@/types/calendar";
import { useRoute } from "@react-navigation/native";
import { useContext } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Card } from "react-native-paper";
import { XButton } from "../shared/x-button";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagList } from "../shared/tags/tag-list";
import { useEventStore } from "@/stores/use-event-store";
import { useCategoryStore } from "@/stores/use-category-store";

interface EventItemProps {
  id: string;
  onEdit?: () => void;
  onDelete?: () => void;
  occurrence?: string;
  variant?: "default" | "detail";
}

export default function EventItem({
  id,
  onEdit,
  onDelete,
  occurrence,
  variant = "default",
}: EventItemProps) {
  const { theme } = useContext(ThemeContext);
  const route = useRoute();
  const isDetail = variant === "detail";

  const eventLocal = useEventStore((state) => state.eventsById[id]);
  const categoryId = eventLocal?.category;

  const eventCategory = useCategoryStore((state) =>
    categoryId ? state.categoriesById[categoryId] : undefined,
  );

  const isNotHome = route.name !== "index";
  const showDetailedTime = isDetail || !isNotHome;
  const isOverNight =
    new Date(eventLocal.startTime).toLocaleTimeString(undefined, {
      hour12: false,
    }) >
    new Date(eventLocal.endTime).toLocaleTimeString(undefined, {
      hour12: false,
    });

  const dateLabel =
    isDetail && occurrence
      ? new Date(`${occurrence}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

  const cardStyle: StyleProp<ViewStyle>[] = [
    isDetail ? styles.detailCard : styles.card,
    { backgroundColor: theme.eventDarkPrimary },
    !isNotHome && !isDetail && { borderRadius: 0 },
  ];
  if (!eventLocal) return null;
  return (
    <Card style={cardStyle}>
      <Card.Content style={isDetail ? styles.detailContent : styles.content}>
        {/* <View style={styles.textContainer}> */}
        {isDetail && (
          <View style={styles.detailHeader}>
            <View style={styles.detailCategoryRow}>
              {eventCategory && (
                <CategoryBadge category={eventCategory} variant="iconOnly" />
              )}
              <View style={[styles.detailHeaderText]}>
                <Text
                  style={[styles.detailTitleText, { color: theme.whiteBase }]}
                  numberOfLines={2}
                >
                  {eventLocal.title}
                </Text>
                {dateLabel && (
                  <Text
                    style={[styles.dateText, { color: theme.greyBasePrimary }]}
                  >
                    {dateLabel}
                  </Text>
                )}
              </View>
            </View>
            {(onEdit || onDelete) && (
              <View style={styles.buttonContainer}>
                {onEdit && (
                  <XButton
                    icon="pencil-outline"
                    mode="calendar"
                    onPress={onEdit}
                  />
                )}
                {onDelete && (
                  <XButton
                    icon="trash-outline"
                    mode="calendar"
                    onPress={onDelete}
                  />
                )}
              </View>
            )}
          </View>
        )}
        {/* </View> */}
        <View style={[styles.titleRow, isDetail && styles.detailTitleRow]}>
          {!isDetail && (
            <Text style={[styles.titleText, { color: theme.whiteBase }]}>
              {eventLocal.title}
            </Text>
          )}
          {!isDetail && eventCategory && (
            <CategoryBadge category={eventCategory} variant="iconOnly" />
          )}
          {isOverNight && (
            <Text style={[styles.overnightText, { color: theme.whiteBase }]}>
              {"- Over Night"}
            </Text>
          )}
        </View>
        <View style={styles.detailBody}>
          {eventLocal.description && (
            <View>
              <Text
                style={[
                  styles.descriptionText,
                  isDetail && styles.detailDescriptionText,
                  { color: isDetail ? theme.whiteBase : "grey" },
                ]}
              >
                {eventLocal.description}
              </Text>
            </View>
          )}
          {showDetailedTime && (
            <View style={isDetail ? styles.detailTimeContainer : undefined}>
              <Text style={{ color: theme.whiteBase }}>
                Start: {new Date(eventLocal.startTime).toLocaleTimeString()}
              </Text>
              <Text style={{ color: theme.whiteBase }}>
                End: {new Date(eventLocal.endTime).toLocaleTimeString()}
              </Text>
            </View>
          )}
          {eventLocal.tags && (
            <View>
              <TagList
                tags={eventLocal.tags}
                holeColor={theme.eventDarkPrimary}
              />
            </View>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 8 },
  detailCard: {
    marginVertical: 0,
    borderRadius: 24,
  },
  content: {
    /* flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", */
  },
  detailHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailContent: {
    /*    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 22,
    paddingHorizontal: 20, */
  },
  textContainer: { flexWrap: "wrap", flex: 1, flexDirection: "row" },

  titleRow: { flexDirection: "row", gap: 5, alignItems: "center" },

  titleText: { fontSize: 16 },
  detailTitleRow: {
    marginBottom: 0,
  },
  detailTitleText: {
    fontSize: 21,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 13,
    marginTop: 3,
  },
  detailCategoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    marginBottom: 14,
  },
  detailHeaderText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  overnightText: { fontSize: 11, fontStyle: "italic" },
  buttonContainer: {
    flexDirection: "row",
    flexShrink: 0,
    marginLeft: 12,
  },
  descriptionText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "grey",
  },
  detailDescriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailTimeContainer: {
    gap: 3,
    marginBottom: 12,
  },

  detailBody: {
    width: "100%",
    minWidth: 0,
  },
});
