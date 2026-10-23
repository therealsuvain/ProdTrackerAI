import { CategoryBadge } from "../shared/categories/category-badge";
import { useEventStore } from "@/stores/use-event-store";
import { useEventDetailsUiStore } from "./event-details-ui-store";
import { ThemeContext } from "@/context/ThemeContext";
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useShallow } from "zustand/shallow";
import { useCategoryStore } from "@/stores/use-category-store";

interface EventPillProps {
  id: string;
  occurrence: string;
  focusRequest?: EventPillFocusRequest;
  onFocusRequestHandled?: (requestId: string) => void;
  onFocusRequestFailed?: (requestId: string) => void;
}

interface EventPillFocusRequest {
  eventId: string;
  occurrenceDate: string;
  requestId: string;
}

export const EventPill = React.memo(function EventPill({
  id,
  occurrence,
  focusRequest,
  onFocusRequestHandled,
  onFocusRequestFailed,
}: EventPillProps) {
  const { theme } = useContext(ThemeContext);
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

  /*  const category = useCategoryStore((s) =>
    categoryId ? s.categoriesById[categoryId] : undefined,
  ); */

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

  const handledFocusRequestRef = useRef<string | null>(null);

  useEffect(() => {
    const request = focusRequest;

    if (
      !request ||
      request.eventId !== id ||
      request.occurrenceDate !== occurrence ||
      handledFocusRequestRef.current === request.requestId
    ) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const retryOrFail = () => {
      if (cancelled) return;

      if (attempts >= 40) {
        handledFocusRequestRef.current = request.requestId;
        onFocusRequestFailed?.(request.requestId);
        return;
      }

      attempts += 1;
      retryTimer = setTimeout(tryMeasure, 80);
    };

    const tryMeasure = () => {
      if (cancelled) return;

      requestAnimationFrame(() => {
        if (cancelled) return;

        if (!pillRef.current) {
          retryOrFail();
          return;
        }

        pillRef.current.measureInWindow((x, y, width, height) => {
          if (cancelled) return;

          const windowHeight = Dimensions.get("window").height;
          const isUsableAndVisible =
            width > 0 && height > 0 && y + height > 0 && y < windowHeight;

          if (!isUsableAndVisible) {
            retryOrFail();
            return;
          }

          handledFocusRequestRef.current = request.requestId;

          // Reuse the exact same detail store and origin coordinates used
          // by a manual tap. The existing animated modal remains in control.
          useEventDetailsUiStore.getState().open(id, occurrence, {
            x,
            y,
            width,
            height,
          });

          onFocusRequestHandled?.(request.requestId);
        });
      });
    };

    tryMeasure();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    id,
    occurrence,
    focusRequest,
    onFocusRequestHandled,
    onFocusRequestFailed,
  ]);

  if (!title) return null;
  //console.log(title, categoryId);
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
      {categoryId && (
        <CategoryBadge categoryId={categoryId} variant="iconOnly" />
      )}
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
