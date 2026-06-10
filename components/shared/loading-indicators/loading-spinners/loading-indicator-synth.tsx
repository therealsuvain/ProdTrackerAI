import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Individual Pill Component to isolate the Reanimated Hooks
const SynthPill = ({
  duration,
  targetScale,
}: {
  duration: number;
  targetScale: number;
}) => {
  const scaleY = useSharedValue(0.3);

  useEffect(() => {
    // Each pill continuously breathes up and down at its own unique speed
    scaleY.value = withRepeat(
      withTiming(targetScale, {
        duration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true, // True = reverse back down
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return <Animated.View style={[styles.pill, animatedStyle]} />;
};

export const LoadingIndicatorSynth = () => {
  // The "DNA" of the waveform.
  // Staggered durations (ms) and heights to simulate complex speech/thinking.
  const pillConfigs = [
    { duration: 400, targetScale: 0.7 },
    { duration: 650, targetScale: 1.2 },
    { duration: 350, targetScale: 0.9 },
    { duration: 750, targetScale: 1.4 }, // The core spikes highest
    { duration: 450, targetScale: 1.3 },
    { duration: 550, targetScale: 0.8 },
    { duration: 300, targetScale: 1.1 },
    { duration: 600, targetScale: 0.6 },
  ];

  return (
    <View style={styles.container}>
      {pillConfigs.map((config, index) => (
        <SynthPill
          key={index}
          duration={config.duration}
          targetScale={config.targetScale}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pill: {
    width: 3,
    height: 16, // Base height before scale multiplier
    backgroundColor: "#2C3E50",
    borderRadius: 2,
    marginHorizontal: 1.5,
  },
});
