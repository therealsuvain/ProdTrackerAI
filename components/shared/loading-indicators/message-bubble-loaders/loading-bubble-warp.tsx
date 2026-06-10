import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
  Extrapolation,
} from "react-native-reanimated";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

const WarpTransitioner = ({ text }: { text: string }) => {
  const [displayTexts, setDisplayTexts] = useState({ prev: "", curr: text });
  const progress = useSharedValue(1);

  useEffect(() => {
    if (text && text !== displayTexts.curr) {
      setDisplayTexts((state) => ({ prev: state.curr, curr: text }));
      progress.value = 0;

      // Fast, aggressive spring for a "hyperspace" feel
      progress.value = withSpring(1, {
        damping: 10,
        stiffness: 100,
        mass: 2,
      });
    }
  }, [text]);

  const prevStyle = useAnimatedStyle(() => {
    return {
      // Fades out quickly as it passes the "camera"
      opacity: interpolate(
        progress.value,
        [0, 0.4],
        [1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        // Simulates moving forward in the Z-axis past the user
        { scale: interpolate(progress.value, [0, 1], [1, 3]) },
      ],
    };
  });

  const currStyle = useAnimatedStyle(() => {
    return {
      // Fades in as it approaches the focal plane
      opacity: interpolate(
        progress.value,
        [0, 0.6],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        // Simulates emerging from deep inside the screen
        { scale: interpolate(progress.value, [0, 1], [0.2, 1]) },
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
      {agentProgress && <WarpTransitioner text={agentProgress} />}
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
