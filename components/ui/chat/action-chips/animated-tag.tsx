import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  SharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface AnimatedTagProps {
  children: React.ReactNode;
  onRemove: () => void;
  isAdding?: boolean; // True if inside the tag-selection-modal
}
const CartoonPoof = ({ progress }: { progress: SharedValue<number> }) => {
  // Define 6 radial burst angles
  const lines = [0, 60, 120, 180, 240, 300];

  return (
    <View style={StyleSheet.absoluteFill}>
      {lines.map((angle, index) => {
        const lineStyle = useAnimatedStyle(() => {
          const translateY = interpolate(
            progress.value,
            [0, 0.6, 1],
            [-12, -26, -4], // Start center, shoot out (-26), snap back (-4)
            Extrapolation.CLAMP,
          );

          const opacity = interpolate(
            progress.value,
            [0, 0.05, 0.6, 1],
            [0, 1, 1, 0], // Strictly 0 at idle. Fast fade in, hold, fade out to strictly 0.
            Extrapolation.CLAMP,
          );

          const scaleY = interpolate(
            progress.value,
            [0, 0.6, 1],
            [1, 1.4, 0], // Normal, stretch outward, squash inward
            Extrapolation.CLAMP,
          );

          return {
            opacity,
            transform: [{ rotate: `${angle}deg` }, { translateY }, { scaleY }],
          };
        });

        return (
          <Animated.View
            key={`poof-line-${index}`}
            style={[styles.poofLine, lineStyle]}
          />
        );
      })}
    </View>
  );
};

export const AnimatedTag = ({
  children,
  onRemove,
  isAdding = false,
}: AnimatedTagProps) => {
  const scale = useSharedValue(isAdding ? 0.25 : 1);
  const opacity = useSharedValue(1);
  const poofProgress = useSharedValue(0);

  // Entrance Animation (Mount)
  React.useEffect(() => {
    if (isAdding) {
      // Scale 0.25 -> 1.2 (fast) -> 1.0 (slower spring)
      scale.value = withSequence(
        withTiming(1.2, { duration: 150 }),
        withSpring(1, { damping: 50, stiffness: 200 }),
      );
    }
  }, []);

  const handlePress = () => {
    // 1. Tag swell and disappear: 1.0 -> 1.25 (slow) -> 0.25 (fast)
    scale.value = withSequence(
      withTiming(1.25, { duration: 300 }),
      withTiming(0.25, { duration: 100 }, () => {
        // Trigger actual state removal in JS thread after animation finishes
        scheduleOnRN(onRemove);
      }),
    );

    // Fade out the tag during the fast shrink
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 100 }),
    );

    // 2. The Minimal "Poof" Effect (Triggers as tag shrinks)
    // Poof Progress Pipeline (0.0 to 1.0 sequence loop)
    poofProgress.value = withSequence(
      withTiming(0, { duration: 100 }), // Pause 100ms inside the swell
      withTiming(1, { duration: 220 }), // Shoot outward (0.0->0.6) then collapse inward (0.6->1.0)
    );
  };

  const animatedTagStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable onPress={handlePress} style={styles.interactiveContainer}>
      {/* The Poof Ring (Renders behind the tag) */}
      <CartoonPoof progress={poofProgress} />

      {/* The Actual Tag */}
      <Animated.View style={animatedTagStyle}>{children}</Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  interactiveContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  poofLine: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 2.5,
    height: 7,
    borderRadius: 1.25,
    backgroundColor: "#A0AAB0", // Cartoony smoky gray tone
    marginTop: -3.5,
    marginLeft: -1.25,
  },
});
