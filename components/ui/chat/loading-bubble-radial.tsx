import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

// 🎛️ TOGGLE THIS TO TEST BOTH MASTERPIECES: "cylinder" | "spoke"
const ANIMATION_STYLE: "cylinder" | "spoke" = "cylinder";

// ==========================================
// ⚙️ THE 3D TEXT TRANSITION ENGINE
// ==========================================
const TextTransitioner = ({ text }: { text: string }) => {
  // We keep track of the PREVIOUS text and CURRENT text so we can animate them overlapping
  const [displayTexts, setDisplayTexts] = useState({ prev: "", curr: text });
  const progress = useSharedValue(1);

  useEffect(() => {
    if (text && text !== displayTexts.curr) {
      // When text changes, update the cache and reset the animation to 0
      setDisplayTexts((state) => ({ prev: state.curr, curr: text }));
      progress.value = 0;

      // Fire the firm, mechanical spring!
      progress.value = withSpring(1, {
        damping: 13, // Lower damping = more bounciness
        stiffness: 160, // Higher stiffness = faster snap
        mass: 1,
      });
    }
  }, [text]);

  const prevStyle = useAnimatedStyle(() => {
    if (ANIMATION_STYLE === "cylinder") {
      // CYLINDER: Rolls straight up and flips backward
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.8],
          [1, 0],
          Extrapolate.CLAMP,
        ),
        transform: [
          { perspective: 800 },
          { translateY: interpolate(progress.value, [0, 1], [0, -25]) },
          { rotateX: `${interpolate(progress.value, [0, 1], [0, 90])}deg` },
        ],
      };
    } else {
      // SPOKE: Pivots from a point 50px below, swinging backward and up
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.8],
          [1, 0],
          Extrapolate.CLAMP,
        ),
        transform: [
          { perspective: 800 },
          { translateY: 50 }, // Move pivot down
          { rotateX: `${interpolate(progress.value, [0, 1], [0, 60])}deg` },
          { translateY: -50 }, // Move text back up
        ],
      };
    }
  });

  const currStyle = useAnimatedStyle(() => {
    if (ANIMATION_STYLE === "cylinder") {
      // CYLINDER: Rolls up from the bottom, flipping forward into place
      return {
        opacity: interpolate(
          progress.value,
          [0.2, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          { perspective: 800 },
          { translateY: interpolate(progress.value, [0, 1], [25, 0]) },
          { rotateX: `${interpolate(progress.value, [0, 1], [-90, 0])}deg` },
        ],
      };
    } else {
      // SPOKE: Pivots from a point 50px below, swinging forward into place
      return {
        opacity: interpolate(
          progress.value,
          [0.2, 1],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          { perspective: 800 },
          { translateY: 50 }, // Move pivot down
          { rotateX: `${interpolate(progress.value, [0, 1], [-60, 0])}deg` },
          { translateY: -50 }, // Move text back up
        ],
      };
    }
  });

  return (
    <View style={styles.textWrapper}>
      {/* Absolute positioning so the old text stays perfectly in place as it dies */}
      <Animated.Text
        style={[styles.agentProgress, prevStyle, { position: "absolute" }]}
      >
        {displayTexts.prev}
      </Animated.Text>

      {/* The actual bounding-box text */}
      <Animated.Text style={[styles.agentProgress, currStyle]}>
        {displayTexts.curr}
      </Animated.Text>
    </View>
  );
};

export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
  // ==========================================
  // LEGACY: User State (The 3 Dots)
  // ==========================================
  const dot1 = useRef(new RNAnimated.Value(0.3)).current;
  const dot2 = useRef(new RNAnimated.Value(0.3)).current;
  const dot3 = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    if (!isUser) return;
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
  }, [isUser]);

  if (isUser) {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <RNAnimated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    );
  }

  // ==========================================
  // RENDER AI STATE
  // ==========================================
  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      {agentProgress && <TextTransitioner text={agentProgress} />}
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#F0F0F0",
    borderRadius: 18,
    marginRight: 10,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#E8ECEF", // Sleek cool-grey for the machine
    borderRadius: 14,
    marginLeft: 10,
    minHeight: 45,
    minWidth: 150, // Prevents the bubble from jittering horizontally when text length changes
  },
  textWrapper: {
    justifyContent: "center",
    alignItems: "center",
    // Overflow visible allows the 3D text to swing slightly out of the bounds during the bounce
    overflow: "visible",
  },
  agentProgress: {
    fontFamily: "serif",
    fontWeight: "bold",
    color: "#2C3E50",
    letterSpacing: 0.3,
    fontSize: 14,
    textAlign: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
