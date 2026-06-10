import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Canvas, Circle, BlurMask, Group } from "@shopify/react-native-skia";

export const LoadingIndicatorInfinity = () => {
  // Master time driver (0 to 2*PI)
  const time = useSharedValue(0);

  useEffect(() => {
    // 2500ms for a full figure-eight traversal
    time.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2500, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  // Lemniscate of Bernoulli Parametric Equation
  // x = (a * sqrt(2) * cos(t)) / (sin^2(t) + 1)
  // y = (a * sqrt(2) * cos(t) * sin(t)) / (sin^2(t) + 1)
  const scale = 12; // Size of the infinity loop
  const centerX = 20; // Center of the 40px canvas
  const centerY = 12; // Center of the 24px canvas

  const createOrb = (delayOffset: number) => {
    return {
      cx: useDerivedValue(() => {
        const t = time.value - delayOffset;
        return (
          centerX +
          (scale * Math.SQRT2 * Math.cos(t)) / (Math.pow(Math.sin(t), 2) + 1)
        );
      }),
      cy: useDerivedValue(() => {
        const t = time.value - delayOffset;
        return (
          centerY +
          (scale * Math.SQRT2 * Math.cos(t) * Math.sin(t)) /
            (Math.pow(Math.sin(t), 2) + 1)
        );
      }),
    };
  };

  // Lead comet and two trailing particles
  const lead = createOrb(0);
  const trail1 = createOrb(0.3); // Offset by 0.3 radians
  const trail2 = createOrb(0.6);

  return (
    <View style={styles.container}>
      {/* Skia Canvas gives us raw GPU access for blur and glow */}
      <Canvas style={{ flex: 1 }}>
        <Group>
          {/* Skia BlurMask creates a physical light glow around the elements */}
          <BlurMask blur={3} style="normal" />

          {/* Lead Comet */}
          <Circle cx={lead.cx} cy={lead.cy} r={3.5} color="#2C3E50" />

          {/* Trailing Particles (Smaller and more transparent) */}
          <Circle
            cx={trail1.cx}
            cy={trail1.cy}
            r={2.5}
            color="#34495E"
            opacity={0.6}
          />
          <Circle
            cx={trail2.cx}
            cy={trail2.cy}
            r={1.5}
            color="#7F8C8D"
            opacity={0.3}
          />
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40, // Wider to accommodate the horizontal figure-eight
    height: 24,
    marginRight: 8,
  },
});
