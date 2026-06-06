import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  Canvas,
  Circle,
  SweepGradient,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";

type GradientPair = [string, string];

interface Props {
  /** The total width/height of the outermost ring. Default is 28. */
  size?: number;
  /** Array of 4 Gradient Pairs: [Core, Outer Ring, Middle Ring, Inner Ring] */
  colors?: [GradientPair, GradientPair, GradientPair, GradientPair];
}

export const LoadingIndicatorPlanetaryOrbitSkia = ({
  size = 28,
  // Defaulting to ultra-premium Sci-Fi holographics
  colors = [
    ["#474747", "#686868"], // Core
    ["#2a4247", "#505861"], // Outer
    ["#644f30", "#6d655b"], // Middle
    ["#2d3f2b", "#4d584d"], // Inner
  ],
}: Props) => {
  const [coreColors, outerColors, middleColors, innerColors] = colors;

  // Proportional scaling math
  const sOuter = size;
  const sMiddle = size * (22 / 28);
  const sInner = size * (16 / 28);
  const sCore = size * (8 / 28);
  const borderWidth = Math.max(1.5, size * (1.5 / 28));

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    pulse.value = withRepeat(
      withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value}deg` },
      { rotateY: `${rotation.value * 0.5}deg` },
    ],
  }));

  const middleStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value * -0.5}deg` },
      { rotateY: `${rotation.value}deg` },
    ],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value * 1.5}deg` },
      { rotateY: `${rotation.value * -1.5}deg` },
    ],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.2 - pulse.value * 0.2,
  }));

  // Helper component to render a Skia Gradient Ring
  const GradientRing = ({
    s,
    c,
    bw,
  }: {
    s: number;
    c: GradientPair;
    bw: number;
  }) => (
    <Canvas style={{ width: s, height: s }}>
      <Circle
        cx={s / 2}
        cy={s / 2}
        r={s / 2 - bw / 2}
        style="stroke"
        strokeWidth={bw}
      >
        {/* SweepGradient loops the color around the circle A -> B -> A */}
        <SweepGradient c={vec(s / 2, s / 2)} colors={[c[0], c[1], c[0]]} />
      </Circle>
    </Canvas>
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* 1. The Glowing Core */}
      <Animated.View style={[styles.core, coreStyle]}>
        <Canvas style={{ width: sCore, height: sCore }}>
          <Circle cx={sCore / 2} cy={sCore / 2} r={sCore / 2}>
            {/* RadialGradient makes it look like a 3D glowing sphere */}
            <RadialGradient
              c={vec(sCore / 2, sCore / 2)}
              r={sCore / 2}
              colors={[coreColors[0], coreColors[1]]}
            />
          </Circle>
        </Canvas>
      </Animated.View>

      {/* 2. Outer Ring */}
      <Animated.View style={[styles.ring, outerStyle]}>
        <GradientRing s={sOuter} c={outerColors} bw={borderWidth} />
      </Animated.View>

      {/* 3. Middle Ring */}
      <Animated.View style={[styles.ring, middleStyle]}>
        <GradientRing s={sMiddle} c={middleColors} bw={borderWidth} />
      </Animated.View>

      {/* 4. Inner Ring */}
      <Animated.View style={[styles.ring, innerStyle]}>
        <GradientRing s={sInner} c={innerColors} bw={borderWidth} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  core: {
    position: "absolute",
    zIndex: 10,
  },
  ring: {
    position: "absolute",
  },
});
