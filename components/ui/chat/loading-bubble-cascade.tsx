// loading-bubble-cascade.tsx
import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

const parseText = (text: string) => {
  let gIndex = 0;
  return text.split(" ").map((word) => {
    const chars = word.split("").map((char) => ({ char, index: gIndex++ }));
    gIndex++;
    return chars;
  });
};

const AnimatedLetter = ({
  char,
  index,
  isPrev,
}: {
  char: string;
  index: number;
  isPrev: boolean;
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = index * 15; // Tighter delay for a faster, fluid wave
    if (isPrev) {
      progress.value = withDelay(delay, withTiming(1, { duration: 250 }));
    } else {
      progress.value = withDelay(
        delay,
        withSpring(1, { damping: 11, stiffness: 220 }),
      );
    }
  }, []);

  const style = useAnimatedStyle(() => {
    if (isPrev) {
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.8],
          [1, 0],
          Extrapolate.CLAMP,
        ),
        transform: [
          { translateY: interpolate(progress.value, [0, 1], [0, 20]) },
        ],
      };
    } else {
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.4],
          [0, 1],
          Extrapolate.CLAMP,
        ),
        transform: [
          { translateY: interpolate(progress.value, [0, 1], [25, 0]) },
        ],
      };
    }
  });

  return (
    <Animated.Text style={[styles.agentProgress, style]}>{char}</Animated.Text>
  );
};

const CascadeTransitioner = ({ text }: { text: string }) => {
  const [state, setState] = useState({ prev: "", curr: text, key: 0 });

  useEffect(() => {
    if (text && text !== state.curr) {
      setState((s) => ({ prev: s.curr, curr: text, key: s.key + 1 }));
    }
  }, [text]);

  const renderWords = (textToRender: string, isPrev: boolean) => (
    <View style={styles.wordsContainer}>
      {parseText(textToRender).map((word, wIdx) => (
        <View key={wIdx} style={styles.wordRow}>
          {word.map((item) => (
            <AnimatedLetter
              key={item.index}
              char={item.char}
              index={item.index}
              isPrev={isPrev}
            />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.textWrapper}>
      <View style={{ position: "absolute" }} key={"prev" + state.key}>
        {renderWords(state.prev, true)}
      </View>
      <View key={"curr" + state.key}>{renderWords(state.curr, false)}</View>
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
      {agentProgress && <CascadeTransitioner text={agentProgress} />}
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
    flexWrap: "nowrap",
    justifyContent: "center",
    alignItems: "center",
  },
  wordRow: { flexDirection: "row", marginRight: 4 },
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
