import { ThemeContext } from "@/context/ThemeContext";
import React, { useContext } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Spring config — feels snappy but not jarring
// ---------------------------------------------------------------------------

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CollapsibleKnobProps {
  /** Driven by parent — the current animated height of the calendar */
  calendarHeight: SharedValue<number>;
  /** The fully expanded height (full month grid) */
  expandedHeight: number;
  /** The collapsed height (single week row + month title + weekday row) */
  collapsedHeight: number;
  /** Called on JS thread after snap completes — lets parent sync state */
  onExpandedChange?: (isExpanded: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CollapsibleKnob({
  calendarHeight,
  expandedHeight,
  collapsedHeight,
  onExpandedChange,
}: CollapsibleKnobProps) {
  const { theme } = useContext(ThemeContext);

  // We store the height at the moment the drag starts so we can do
  // relative dragging correctly (drag delta applied to start value)
  const dragStartHeight = { value: expandedHeight };

  const panGesture = Gesture.Pan()
    // --- Capture drag start height on the UI thread ---
    .onStart(() => {
      dragStartHeight.value = calendarHeight.value;
    })

    // --- Update height in real time as finger moves (UI thread only) ---
    .onUpdate((e) => {
      const next = dragStartHeight.value + e.translationY;
      calendarHeight.value = clamp(next, collapsedHeight, expandedHeight);
    })

    // --- Snap to nearest state on release ---
    .onEnd((e) => {
      const midpoint = (expandedHeight + collapsedHeight) / 2;

      // Factor in velocity so a fast flick snaps even if finger
      // hasn't crossed the midpoint yet
      const projectedPosition =
        calendarHeight.value + e.velocityY * 0.08;

      const shouldExpand = projectedPosition > midpoint;
      const targetHeight = shouldExpand ? expandedHeight : collapsedHeight;

      calendarHeight.value = withSpring(targetHeight, SPRING_CONFIG, () => {
        // Notify JS thread once animation settles
        if (onExpandedChange) {
          runOnJS(onExpandedChange)(shouldExpand);
        }
      });
    });

  // Knob pill rotates slightly to hint at drag direction
  const knobStyle = useAnimatedStyle(() => {
    const progress =
      (calendarHeight.value - collapsedHeight) /
      (expandedHeight - collapsedHeight);
    // 0 = collapsed (pill points up → ▲), 1 = expanded (pill points down → ▼)
    const rotation = progress * 180;
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[
          styles.knobContainer,
          { backgroundColor: theme.eventDarkSecondary },
        ]}
      >
        {/* Decorative track line */}
        <View
          style={[styles.track, { backgroundColor: theme.greyBaseSecondary }]}
        />

        {/* Animated pill */}
        <Animated.View
          style={[
            styles.pill,
            { backgroundColor: theme.eventBase },
            knobStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  knobContainer: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    // Wider hit area than visual size
    paddingVertical: 4,
  },
  track: {
    position: "absolute",
    width: 48,
    height: 2,
    borderRadius: 1,
    opacity: 0.3,
  },
  pill: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});
