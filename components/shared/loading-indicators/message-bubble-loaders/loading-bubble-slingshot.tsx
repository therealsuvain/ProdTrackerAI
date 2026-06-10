import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet } from "react-native";
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

const SlingshotTransitioner = ({ text }: { text: string }) => {
  const [displayTexts, setDisplayTexts] = useState({ prev: "", curr: text });
  const progress = useSharedValue(1);

  useEffect(() => {
    if (text && text !== displayTexts.curr) {
      setDisplayTexts((state) => ({ prev: state.curr, curr: text }));
      progress.value = 0;

      // Low damping creates a heavy wobble at the end of the trajectory
      progress.value = withSpring(1, {
        damping: 9,
        stiffness: 180,
        mass: 1,
      });
    }
  }, [text]);

  const prevStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        progress.value,
        [0, 0.4, 0.6],
        [1, 1, 0],
        Extrapolate.CLAMP,
      ),
      transform: [
        {
          // Pulls left (-20) to build tension, then shoots right (200)
          translateX: interpolate(progress.value, [0, 0.3, 1], [0, -20, 200]),
        },
        {
          // Shrinks slightly during drawback
          scale: interpolate(progress.value, [0, 0.3, 1], [1, 0.9, 0.5]),
        },
      ],
    };
  });

  const currStyle = useAnimatedStyle(() => {
    return {
      // Remains invisible during the tension-building phase
      opacity: interpolate(
        progress.value,
        [0.2, 0.5],
        [0, 1],
        Extrapolate.CLAMP,
      ),
      transform: [
        {
          // Flies in from the far left
          translateX: interpolate(progress.value, [0, 1], [-200, 0]),
        },
      ],
    };
  });

  return (
    <View style={styles.textWrapper}>
      <Animated.Text
        style={[styles.agentProgress, prevStyle, { position: "absolute" }]}
      >
        {displayTexts.prev}
      </Animated.Text>
      <Animated.Text style={[styles.agentProgress, currStyle]}>
        {displayTexts.curr}
      </Animated.Text>
    </View>
  );
};

export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
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

  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      {agentProgress && <SlingshotTransitioner text={agentProgress} />}
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
    backgroundColor: "#E8ECEF",
    borderRadius: 14,
    marginLeft: 10,
    minHeight: 45,
    minWidth: 150,
  },
  textWrapper: {
    justifyContent: "center",
    alignItems: "center",
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
