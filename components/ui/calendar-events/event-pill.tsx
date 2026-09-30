import { CategoryBadge } from "../shared/categories/category-badge";
import { useData } from "@/hooks/context-hooks/use-data";
import { useEventStore } from "@/stores/use-event-store";
import { useEventDetailsUiStore } from "./event-details-ui-store";
import { ThemeContext } from "@/context/ThemeContext";
import React, { useCallback, useContext, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/shallow";

interface EventPillProps {
  id: string;
  occurrence: string;
}

export const EventPill = React.memo(function EventPill({
  id,
  occurrence,
}: EventPillProps) {
  const { theme } = useContext(ThemeContext);
  const { categories } = useData();
  const pillRef = useRef<View>(null);

  const { title, categoryId } = useEventStore(
    useShallow((state) => {
      const event = state.eventsById[id];
      return {
        title: event?.title ?? "",
        categoryId: event?.category,
      };
    }),
  );

  const category = categoryId
    ? categories.find((item) => item.id === categoryId)
    : undefined;

  const handlePress = useCallback(() => {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      useEventDetailsUiStore.getState().open(id, occurrence, {
        x,
        y,
        width,
        height,
      });
    });
  }, [id, occurrence]);

  if (!title) return null;

  return (
    <Pressable
      ref={pillRef}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: theme.eventDarkPrimary,
          borderColor: theme.eventBaseTrans,
        },
        pressed && styles.pressed,
      ]}
    >
      {category && <CategoryBadge category={category} variant="iconOnly" />}
      <Text
        style={[styles.title, { color: theme.whiteBase }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pill: {
    minHeight: 38,
    maxWidth: "48%",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  pressed: {
    opacity: 0.78,
  },
  title: {
    flexShrink: 1,
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
  },
});
