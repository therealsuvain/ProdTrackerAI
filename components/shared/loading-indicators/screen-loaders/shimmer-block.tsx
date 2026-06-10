import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

interface ShimmerBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  shimmerColor: string; // light highlight sweep color
  baseColor: string; // block background
  style?: object;
}

const DURATION = 1100;

export const ShimmerBlock = ({
  width,
  height,
  borderRadius = 6,
  shimmerColor,
  baseColor,
  style,
}: ShimmerBlockProps) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: DURATION, easing: Easing.linear }),
      -1, // infinite
      false, // no reverse — reset to 0 and repeat (true loop)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value * 2 - 1) * 300 }],
  }));

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={["transparent", shimmerColor, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};
