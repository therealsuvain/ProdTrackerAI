import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

export const LoadingIndicatorNC = () => {
  // Shared values for independent physics
  const rotationOuter = useSharedValue(0);
  const rotationInner = useSharedValue(0);
  const breath = useSharedValue(0.85);

  useEffect(() => {
    // 1. The Fast Outer Ring (Clockwise)
    rotationOuter.value = withRepeat(
      withTiming(360, { duration: 1600, easing: Easing.linear }),
      -1,
      false, // False = continuous loop, no reverse
    );

    // 2. The Slow Inner Ring (Counter-Clockwise)
    rotationInner.value = withRepeat(
      withTiming(-360, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );

    // 3. The Breath (Inhales and exhales smoothly)
    breath.value = withRepeat(
      withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true, // True = reverse back to 0.85
    );
  }, []);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${rotationOuter.value}deg` },
      { scale: breath.value },
    ],
  }));

  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${rotationInner.value}deg` },
      // Inverse scale: Inner ring shrinks while outer ring expands!
      { scale: 2 - breath.value },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* The Solid Core */}
      <View style={styles.core} />

      {/* The Inner Segmented Ring */}
      <Animated.View
        style={[styles.ringBase, styles.innerRing, innerRingStyle]}
      />

      {/* The Outer Segmented Ring */}
      <Animated.View
        style={[styles.ringBase, styles.outerRing, outerRingStyle]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10, // Spacing before the text begins
  },
  core: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2C3E50", // Dark core
    position: "absolute",
  },
  ringBase: {
    position: "absolute",
    borderRadius: 100, // Perfect circle
    borderWidth: 2,
    borderColor: "transparent", // Hide the main border
  },
  innerRing: {
    width: 14,
    height: 14,
    // Creating the "segments" by only coloring two sides of the border
    borderTopColor: "#7F8C8D",
    borderBottomColor: "#7F8C8D",
  },
  outerRing: {
    width: 20,
    height: 20,
    borderLeftColor: "#2C3E50",
    borderRightColor: "#2C3E50",
  },
});
