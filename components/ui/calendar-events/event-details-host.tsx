import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ThemeContext } from "@/context/ThemeContext";
import { useEventStore } from "@/stores/use-event-store";
import EventItem from "./event-item";
import { useEventDetailsUiStore } from "./event-details-ui-store";

interface EventDetailsHostProps {
  onEdit?: (id: string) => void;
  onDelete?: (id: string, date: string) => void;
}

const ANIMATION_DURATION = 260;
const CLOSE_DURATION = 210;
const SCREEN_MARGIN = 16;
const SCREEN_VERTICAL_MARGIN = 36;

export const EventDetailsHost = memo(function EventDetailsHost({
  onEdit,
  onDelete,
}: EventDetailsHostProps) {
  const { theme } = useContext(ThemeContext);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const details = useEventDetailsUiStore((state) => state.details);
  const event = useEventStore((state) =>
    details ? state.eventsById[details.eventId] : undefined,
  );
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const left = useSharedValue(0);
  const top = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const radius = useSharedValue(19);
  const backdrop = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  const detailBackgroundColor = theme.eventDarkPrimary;

  const targetWidth = useMemo(
    () => Math.min(screenWidth - SCREEN_MARGIN * 2, 560),
    [screenWidth],
  );

  const finishClose = useCallback(() => {
    useEventDetailsUiStore.getState().close();
    setMeasuredHeight(0);
  }, []);

  const closeDetails = useCallback(() => {
    if (!details) return;

    left.value = withTiming(details.origin.x, {
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
    });
    top.value = withTiming(details.origin.y, {
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
    });
    width.value = withTiming(details.origin.width, {
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
    });
    height.value = withTiming(details.origin.height, {
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
    });
    radius.value = withTiming(19, {
      duration: CLOSE_DURATION,
      easing: Easing.in(Easing.cubic),
    });
    contentOpacity.value = withTiming(0, { duration: 100 });
    backdrop.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [
    details,
    finishClose,
    left,
    top,
    width,
    height,
    radius,
    contentOpacity,
    backdrop,
  ]);

  useEffect(() => {
    if (!details) return;

    setMeasuredHeight(0);
    left.value = details.origin.x;
    top.value = details.origin.y;
    width.value = details.origin.width;
    height.value = details.origin.height;
    radius.value = 19;
    backdrop.value = 0;
    contentOpacity.value = 0;
  }, [details, left, top, width, height, radius, backdrop, contentOpacity]);

  useEffect(() => {
    if (!details || !measuredHeight) return;

    const maxHeight = screenHeight - SCREEN_VERTICAL_MARGIN * 2;
    const targetHeight = Math.min(measuredHeight, maxHeight);
    const targetLeft = (screenWidth - targetWidth) / 2;
    const targetTop = Math.max(
      SCREEN_VERTICAL_MARGIN,
      (screenHeight - targetHeight) / 2,
    );

    left.value = withTiming(targetLeft, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    top.value = withTiming(targetTop, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    width.value = withTiming(targetWidth, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    height.value = withTiming(targetHeight, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    radius.value = withTiming(24, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdrop.value = withTiming(1, { duration: ANIMATION_DURATION });
    contentOpacity.value = withTiming(1, {
      duration: 170,
      easing: Easing.out(Easing.cubic),
    });
    /*     contentOpacity.value = withDelay(
      220,
      withTiming(1, {
        duration: 170,
        easing: Easing.out(Easing.cubic),
      }),
    ); */
  }, [
    details,
    measuredHeight,
    screenHeight,
    screenWidth,
    targetWidth,
    left,
    top,
    width,
    height,
    radius,
    backdrop,
    contentOpacity,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    width: width.value,
    height: height.value,
    borderRadius: radius.value,
    backgroundColor: detailBackgroundColor,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  if (!details || !event) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeDetails}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, backdropStyle]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close event details"
          onPress={closeDetails}
          style={StyleSheet.absoluteFill}
        />

        {measuredHeight === 0 && (
          <View
            pointerEvents="none"
            style={[styles.measureContainer, { width: targetWidth }]}
            onLayout={(layout) =>
              setMeasuredHeight(layout.nativeEvent.layout.height)
            }
          >
            <View style={{ width: targetWidth }}>
              <EventItem
                id={details.eventId}
                occurrence={details.occurrence}
                variant="detail"
                onEdit={() => undefined}
                onDelete={() => undefined}
              />
            </View>
          </View>
        )}

        <Animated.View style={[styles.detailContainer, containerStyle]}>
          <Animated.View
            style={[
              styles.fixedDetailContent,
              {
                width: targetWidth,
                height: measuredHeight,
              },
              contentStyle,
            ]}
          >
            <EventItem
              id={details.eventId}
              occurrence={details.occurrence}
              variant="detail"
              onEdit={() => {
                onEdit?.(details.eventId);
                closeDetails();
              }}
              onDelete={() => {
                onDelete?.(details.eventId, details.occurrence);
                closeDetails();
              }}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000005",
  },
  measureContainer: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
  fixedDetailContent: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  detailContainer: {
    position: "absolute",
    overflow: "hidden",
    elevation: 12,
    shadowColor: "black",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
});
