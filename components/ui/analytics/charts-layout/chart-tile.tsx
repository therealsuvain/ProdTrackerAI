import React, { useEffect } from "react";
import { StyleSheet, Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import type { TileRect } from "./chart-tile-config";
import { useHaptics } from "@/hooks/use-haptics";

interface Props {
  id: string;
  rect: TileRect;
  editMode: boolean;
  isDragged: boolean;
  scrollY: SharedValue<number>;
  onLongPressStart: (id: string) => void;
  onDragMove: (
    id: string,
    centerX: number,
    centerY: number,
    absoluteY: number,
  ) => void;
  onDragEnd: (id: string) => void;
  onPress: (id: string) => void;
  onRemove: (id: string) => void;
  children: React.ReactNode;
}

const SPRING_CONFIG = { damping: 500, stiffness: 500 };

export const ChartTile = ({
  id,
  rect,
  editMode,
  isDragged,
  scrollY,
  onLongPressStart,
  onDragMove,
  onDragEnd,
  onPress,
  onRemove,
  children,
}: Props) => {
  const { theme, isDarkMode } = useTheme();
  const { triggerHaptic } = useHaptics();
  const x = useSharedValue(rect.x);
  const y = useSharedValue(rect.y);
  const width = useSharedValue(rect.width);
  const height = useSharedValue(rect.height);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const grabOriginX = useSharedValue(0);
  const grabOriginY = useSharedValue(0);
  const dragStartScrollY = useSharedValue(0);

  // Follow the layout engine's target rect, unless this tile is currently
  // pinned under the user's finger (that case is driven by the pan gesture
  // directly, see below).
  useEffect(() => {
    if (isDragged) return;
    x.value = withSpring(rect.x, SPRING_CONFIG);
    y.value = withSpring(rect.y, SPRING_CONFIG);
    width.value = withSpring(rect.width, SPRING_CONFIG);
    height.value = withSpring(rect.height, SPRING_CONFIG);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect.x, rect.y, rect.width, rect.height, isDragged]);

  // iOS-style jiggle while the dashboard is in edit mode. Randomized delay
  // per tile keeps every card from swinging in perfect unison.
  useEffect(() => {
    if (editMode && !isDragged) {
      const delay = Math.random() * 120;
      rotate.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-0.75, { duration: 30 }),
            withTiming(0.75, { duration: 60 }),
            withTiming(0, { duration: 30 }),
          ),
          -1,
          false,
        ),
      );
    } else {
      cancelAnimation(rotate);
      rotate.value = withTiming(0, { duration: 120 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, isDragged]);

  useEffect(() => {
    scale.value = withSpring(isDragged ? 1.06 : 1, SPRING_CONFIG);
  }, [isDragged, scale]);

  const handlePickup = () => {
    grabOriginX.value = x.value;
    grabOriginY.value = y.value;
    dragStartScrollY.value = scrollY.value;
    triggerHaptic();
    onLongPressStart(id);
  };

  const handleDragMove = (
    centerX: number,
    centerY: number,
    absoluteY: number,
  ) => {
    onDragMove(id, centerX, centerY, absoluteY);
  };

  const handleDragEnd = () => {
    onDragEnd(id);
  };

  // `activateAfterLongPress` is the key to making this feel right: the pan
  // gesture stays fully out of the way of the parent ScrollView until the
  // finger has been still for the given duration, at which point it takes
  // over. A normal scroll swipe never triggers it.
  const pan = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      scheduleOnRN(handlePickup);
    })
    .onUpdate((e) => {
      const scrollDelta = scrollY.value - dragStartScrollY.value;
      x.value = grabOriginX.value + e.translationX;
      y.value = grabOriginY.value + e.translationY + scrollDelta;
      scheduleOnRN(
        handleDragMove,
        x.value + width.value / 2,
        y.value + height.value / 2,
        e.absoluteY,
      );
    })
    .onEnd(() => {
      scheduleOnRN(handleDragEnd);
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(220)
    .onEnd(() => {
      scheduleOnRN(onPress, id);
    });

  const composedGesture = Gesture.Race(tapGesture, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    zIndex: isDragged ? 100 : 1,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.tile,
          {
            backgroundColor: isDarkMode
              ? theme.taskDarkPrimary
              : theme.greyTimeline,
            borderColor: theme.taskDarkSecondary ?? "rgba(255,255,255,0.08)",
            shadowOpacity: isDragged ? 0.35 : 0.15,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[
            {
              position: "absolute",
              top: 4,
              left: 4,
              height: 16,
              width: 16,
              borderRadius: 4,
              backgroundColor: theme.habitBase,
              elevation: 10,
              alignItems: "center",
              justifyContent: "center",
            },
            !editMode && {
              borderRightWidth: 2.5,
              borderBottomEndRadius: 4,
              // borderRight: 4,
              borderRightColor: "rgba(120,80,0,0.45)",
              borderBottomWidth: 2.5,
              borderBottomRightRadius: 4,
              borderBottomColor: "rgba(120,80,0,0.45)",
            },
          ]}
        >
          <MaterialIcons name="drag-indicator" size={14} color="white" />
        </View>
        {editMode && (
          <Pressable
            hitSlop={10}
            onPress={() => onRemove(id)}
            style={[
              styles.removeBadge,
              { backgroundColor: theme.error ?? "#EF4444" },
            ]}
          >
            <Text style={styles.removeBadgeText}>×</Text>
          </Pressable>
        )}
        <Animated.View
          pointerEvents={editMode ? "none" : "auto"}
          style={styles.chartSlot}
        >
          {children}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  chartSlot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  removeBadgeText: {
    color: "white",
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 14,
  },
});
