import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// The individual electron moving on a specific orbital plane
const Electron = ({
  angleOffset,
  planeRotation,
}: {
  angleOffset: number;
  planeRotation: number;
}) => {
  // Master time driver
  const time = useSharedValue(0);

  useEffect(() => {
    // 2500ms for a full orbit around the nucleus
    time.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2500, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const currentAngle = time.value + angleOffset;

    // The width and height of the elliptical path
    const radiusX = 14;
    const radiusY = 5; // Compressed Y creates the 3D tilt effect

    const x = Math.cos(currentAngle) * radiusX;
    const y = Math.sin(currentAngle) * radiusY;

    // Shrinks when going "behind" the nucleus
    const scale = 1 + Math.sin(currentAngle) * 0.4;
    const opacity = 0.7 + Math.sin(currentAngle) * 0.3;

    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      // Z-Index sorting: 10 brings it to the front, 0 pushes it behind the nucleus
      zIndex: scale > 1 ? 10 : 0,
    };
  });

  return (
    // The wrapper physically rotates the invisible track to create the diagonal planes
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [{ rotateZ: `${planeRotation}deg` }],
          justifyContent: "center",
          alignItems: "center",
        },
      ]}
    >
      <Animated.View style={[styles.electron, animatedStyle]} />
    </View>
  );
};

export const LoadingIndicatorAtomicOrbit = () => {
  return (
    <View style={styles.container}>
      {/* 1. The Nucleus (Stationary Center) */}
      {/* Z-index 5 keeps it strictly in the middle, so electrons pass in front and behind it */}
      <View style={[styles.nucleus, { zIndex: 5 }]} />

      {/* 2. Horizontal Orbit */}
      <Electron angleOffset={0} planeRotation={0} />

      {/* 3. Left Diagonal Orbit */}
      <Electron angleOffset={(2 * Math.PI) / 3} planeRotation={60} />

      {/* 4. Right Diagonal Orbit */}
      <Electron angleOffset={(4 * Math.PI) / 3} planeRotation={-60} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  nucleus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // You can change this to #FF9000 (Orange) to perfectly match your reference image!
    backgroundColor: "#2C3E50",
    position: "absolute",
  },
  electron: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    // You can change this to a vibrant Purple/Pink to match the reference
    backgroundColor: "#2C3E50",
  },
});
