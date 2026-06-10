import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const OrbitingDot = ({ offsetAngle }: { offsetAngle: number }) => {
  // Master time driver (0 to 2*PI)
  const time = useSharedValue(0);

  useEffect(() => {
    // 2000ms for a full orbit
    time.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    // Current angle of this specific dot
    const currentAngle = time.value + offsetAngle;

    // The Orbit Radius
    const radiusX = 12;
    const radiusY = 4; // Smaller Y radius creates the "tilted" 3D look

    const x = Math.cos(currentAngle) * radiusX;
    const y = Math.sin(currentAngle) * radiusY;

    // Scale goes from 0.5 (background) to 1.5 (foreground)
    const scale = 1 + Math.sin(currentAngle) * 0.5;

    // Opacity fades slightly when "behind" the orbit
    const opacity = 0.6 + Math.sin(currentAngle) * 0.4;

    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      // Dynamically push dots to the back when they shrink
      zIndex: scale > 1 ? 10 : 0,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
};

export const LoadingIndicatorOrbit = () => {
  return (
    <View style={styles.container}>
      {/* 3 Dots spaced evenly by 120 degrees (2*PI / 3) */}
      <OrbitingDot offsetAngle={0} />
      <OrbitingDot offsetAngle={(2 * Math.PI) / 3} />
      <OrbitingDot offsetAngle={(4 * Math.PI) / 3} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C3E50",
  },
});
