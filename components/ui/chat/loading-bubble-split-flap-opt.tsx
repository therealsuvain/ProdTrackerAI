import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  SharedValue,
} from "react-native-reanimated";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

// THE C++ MATH ENGINE: No useEffects, no local state. Pure UI-thread math.
const AnimatedLetter = React.memo(
  ({
    char,
    index,
    totalLength,
    isPrev,
    progress,
  }: {
    char: string;
    index: number;
    totalLength: number;
    isPrev: boolean;
    progress: SharedValue<number>;
  }) => {
    const style = useAnimatedStyle(() => {
      // We reserve the first 50% of the progress for the EXIT, and the last 50% for the ENTRY.
      // We calculate a stagger step so letters flip sequentially from left to right.
      const staggerStep = 0.4 / Math.max(totalLength, 1);

      if (isPrev) {
        // EXIT PHASE (Progress 0.0 -> 0.5)
        const startExit = index * staggerStep;
        const endExit = startExit + 0.1; // Takes 10% of the total animation time to flip 90deg

        const rotate = interpolate(
          progress.value,
          [startExit, endExit],
          [0, 90],
          Extrapolation.CLAMP,
        );
        const opacity = interpolate(
          progress.value,
          [startExit, endExit],
          [1, 0],
          Extrapolation.CLAMP,
        );

        return {
          opacity,
          transform: [{ perspective: 400 }, { rotateX: `${rotate}deg` }],
        };
      } else {
        // ENTRY PHASE (Progress 0.5 -> 1.0)
        const startEnter = 0.5 + index * staggerStep;
        const endEnter = startEnter + 0.1;

        const rotate = interpolate(
          progress.value,
          [startEnter, endEnter],
          [-90, 0],
          Extrapolation.CLAMP,
        );
        const opacity = interpolate(
          progress.value,
          [startEnter, endEnter],
          [0, 1],
          Extrapolation.CLAMP,
        );

        return {
          opacity,
          transform: [{ perspective: 400 }, { rotateX: `${rotate}deg` }],
        };
      }
    });

    const displayChar = char === " " ? "\u00A0" : char;
    return (
      <Animated.Text style={[styles.agentProgress, style]}>
        {displayChar}
      </Animated.Text>
    );
  },
);

const SplitFlapTransitioner = ({ text }: { text: string }) => {
  const [state, setState] = useState({ prev: "", curr: text });
  // ONE master driver for all letters
  const progress = useSharedValue(1);

  useEffect(() => {
    if (text && text !== state.curr) {
      setState((s) => ({ prev: s.curr, curr: text }));

      // Reset to 0 instantly
      progress.value = 0;

      // ONE bridge crossing to drive the entire sequence
      progress.value = withTiming(1, {
        duration: 800, // Total time for both words to fully transition
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  }, [text]);

  const renderText = (textToRender: string, isPrev: boolean) => {
    const chars = textToRender.split("");
    return (
      <View style={styles.wordsContainer}>
        {chars.map((char, idx) => (
          <AnimatedLetter
            key={idx}
            char={char}
            index={idx}
            totalLength={chars.length}
            isPrev={isPrev}
            progress={progress} // Pass the master driver down
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.textWrapper}>
      <View style={{ position: "absolute" }}>
        {renderText(state.prev, true)}
      </View>
      <View>{renderText(state.curr, false)}</View>
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
      {agentProgress && <SplitFlapTransitioner text={agentProgress} />}
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
  wordsContainer: {
    flexDirection: "row",
    flexWrap: "nowrap", // Strictly prevents the multiline glitch
    justifyContent: "center",
    alignItems: "center",
  },
  agentProgress: {
    fontFamily: "serif",
    fontWeight: "bold",
    color: "#2C3E50",
    fontSize: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
