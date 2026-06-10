import React, { useEffect, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolateColor,
} from "react-native-reanimated";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}
export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
  const dot1 = useRef(new RNAnimated.Value(0.3)).current;
  const dot2 = useRef(new RNAnimated.Value(0.3)).current;
  const dot3 = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    if (!isUser) return; // Only run this if it's the user bubble
    const animate = (dot: RNAnimated.Value, delay: number) => {
      return RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);
  // ==========================================
  // SOTA: AI State (The Liquid Droplet)
  // ==========================================
  const brTL = useSharedValue(16);
  const brTR = useSharedValue(24);
  const brBL = useSharedValue(24);
  const brBR = useSharedValue(16);
  const scale = useSharedValue(0.98);
  const colorPhase = useSharedValue(0);

  // 1. REPLACE your `const scale = useSharedValue(0.98);` with this:
  const scaleX = useSharedValue(0.96);
  const scaleY = useSharedValue(0.96);
  const rotateZ = useSharedValue(-1);

  useEffect(() => {
    if (isUser) return;

    const easing = Easing.inOut(Easing.ease);

    // Phase-shifted durations create the organic liquid wobble
    brTL.value = withRepeat(
      withTiming(28, { duration: 1400, easing }),
      -1,
      true,
    );
    brTR.value = withRepeat(
      withTiming(12, { duration: 1600, easing }),
      -1,
      true,
    );
    brBL.value = withRepeat(
      withTiming(14, { duration: 1500, easing }),
      -1,
      true,
    );
    brBR.value = withRepeat(
      withTiming(26, { duration: 1700, easing }),
      -1,
      true,
    );

    // The Breath (Subtle scaling)
    /*    scale.value = withRepeat(
      withTiming(1.02, { duration: 2000, easing }),
      -1,
      true,
    ); */

    scaleX.value = withRepeat(
      withTiming(1.04, { duration: 1900, easing }),
      -1,
      true,
    );
    scaleY.value = withRepeat(
      withTiming(1.04, { duration: 2300, easing }),
      -1,
      true,
    );
    rotateZ.value = withRepeat(
      withTiming(1, { duration: 3100, easing }),
      -1,
      true,
    );

    // The Glow (Subtle background color shifting)
    colorPhase.value = withRepeat(
      withTiming(1, { duration: 1800, easing }),
      -1,
      true,
    );
  }, [isUser]);

  const dropletStyle = useAnimatedStyle(() => {
    return {
      borderTopLeftRadius: brTL.value,
      borderTopRightRadius: brTR.value,
      borderBottomLeftRadius: brBL.value,
      borderBottomRightRadius: brBR.value,
      /*  transform: [{ scale: scale.value }], */
      transform: [
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
        { rotateZ: `${rotateZ.value}deg` },
      ],
      backgroundColor: interpolateColor(
        colorPhase.value,
        [0, 1],
        ["#F0F0F0", "#E0E5EC"], // Shifts between flat grey and a premium cool-grey tint
      ),
    };
  });
  if (isUser) {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <RNAnimated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.bubble, styles.aiBubble, dropletStyle]}>
      {agentProgress && (
        <Text style={styles.agentProgress}>{agentProgress}</Text>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  aiBubble: {
    alignSelf: "flex-start",
    marginLeft: 10,
    // Minimum width ensures the wobble is highly visible even with short text
    //minWidth: 120,
    maxHeight: 45,
  },
  agentProgress: {
    fontFamily: "serif",
    fontWeight: "bold",
    color: "#333", // Slightly darker to pop against the animated background
    letterSpacing: 0.3,
  },

  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#F0F0F0",
    borderRadius: 18,
    marginRight: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
