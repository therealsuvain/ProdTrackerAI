import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Text } from "react-native";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}
export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
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

  return (
    <View
      style={[
        styles.bubble,
        isUser ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
      ]}
    >
      {!isUser && agentProgress && (
        <Text style={styles.agentProgress}>{agentProgress}</Text>
      )}
      {[dot1, dot2, dot3].map((anim, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: "#F0F0F0",
    padding: 12,
    borderRadius: 18,
    flexDirection: "row",
    marginLeft: 10,
    alignItems: "center",
  },
  agentProgress: {
    fontFamily: "serif",
    fontWeight: "bold",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
