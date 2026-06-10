import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

export const LoadingIndicatorGyro = () => {
  // Master time drivers for the 3 axes
  const spinForward = useSharedValue(0);
  const spinBackward = useSharedValue(0);
  const corePulse = useSharedValue(0.7);

  useEffect(() => {
    // Outer and Inner rings spin forward
    spinForward.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );

    // Middle ring spins backward to create mechanical contrast
    spinBackward.value = withRepeat(
      withTiming(-360, { duration: 2500, easing: Easing.linear }),
      -1,
      false,
    );

    // The center dot gently breathes
    corePulse.value = withRepeat(
      withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  // Outer Ring: Tilted horizontally
  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: "65deg" }, // Tilt it flat
      { rotateY: "20deg" }, // Give it a slight angle
      { rotateZ: `${spinForward.value}deg` }, // Spin it like a record
    ],
  }));

  // Middle Ring: Tilted vertically
  const middleStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateY: "65deg" }, // Tilt it vertically
      { rotateX: "-20deg" },
      { rotateZ: `${spinBackward.value}deg` }, // Spin it backward
    ],
  }));

  // Inner Ring: Tilted diagonally
  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: "45deg" },
      { rotateY: "45deg" },
      { rotateZ: `${spinForward.value * 1.5}deg` }, // Spin it 50% faster
    ],
  }));

  // Core Pulse
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: corePulse.value }],
    opacity: 1.5 - corePulse.value, // Dims slightly as it expands
  }));

  return (
    <View style={styles.container}>
      {/* 1. The Breathing Core */}
      <Animated.View style={[styles.core, coreStyle]} />

      {/* 2. Inner Gyro Ring */}
      <Animated.View style={[styles.ring, styles.innerRing, innerStyle]} />

      {/* 3. Middle Gyro Ring */}
      <Animated.View style={[styles.ring, styles.middleRing, middleStyle]} />

      {/* 4. Outer Gyro Ring */}
      <Animated.View style={[styles.ring, styles.outerRing, outerStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  core: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C3E50",
    position: "absolute",
    zIndex: 10,
  },
  ring: {
    position: "absolute",
    borderRadius: 100, // Perfect circle
    borderWidth: 2, // Slightly thicker so the arcs pop
    borderColor: "transparent", // Default all sides to transparent
  },
  innerRing: {
    width: 14,
    height: 14,
    // Only color the Top and Bottom to create two sweeping arcs
    borderTopColor: "#7F8C8D",
    borderBottomColor: "#7F8C8D",
  },
  middleRing: {
    width: 20,
    height: 20,
    // Only color the Left and Right to offset the gaps
    borderLeftColor: "#34495E",
    borderRightColor: "#34495E",
  },
  outerRing: {
    width: 28,
    height: 28,
    // Color Top and Bottom again
    borderTopColor: "#2C3E50",
    borderBottomColor: "#2C3E50",
  },
});
