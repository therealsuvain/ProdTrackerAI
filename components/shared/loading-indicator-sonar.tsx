import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

const SonarRing = ({ delay }: { delay: number }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    // 2000ms total lifecycle for one ping, continuously repeating
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      // Starts small and expands to 4x its size
      transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 4]) }],
      // Starts semi-transparent and fades to nothing as it expands
      opacity: interpolate(progress.value, [0, 0.8, 1], [0.6, 0, 0]),
      // Thin the border as it expands to simulate energy dissipating
      borderWidth: interpolate(progress.value, [0, 1], [2, 0]),
    };
  });

  return <Animated.View style={[styles.ring, animatedStyle]} />;
};

export const LoadingIndicatorSonar = () => {
  return (
    <View style={styles.container}>
      {/* The solid center pinging origin */}
      <View style={styles.core} />

      {/* 3 expanding shockwaves, staggered by 600ms each */}
      <SonarRing delay={0} />
      <SonarRing delay={600} />
      <SonarRing delay={1200} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  core: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C3E50",
    position: "absolute",
    zIndex: 10, // Keeps the core sharp and on top
  },
  ring: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6, // Perfect circle
    borderColor: "#34495E",
  },
});
