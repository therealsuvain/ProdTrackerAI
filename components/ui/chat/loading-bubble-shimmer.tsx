import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  isUser?: boolean; // You can paste your 3-dots legacy code here if needed
  agentProgress?: string | null;
}

export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
  // We translate the gradient from -100% to 100%
  const shimmerTranslate = useSharedValue(-200);

  useEffect(() => {
    // Infinite linear sweep
    shimmerTranslate.value = withRepeat(
      withTiming(200, {
        duration: 2500,
        easing: Easing.linear, // Linear easing is crucial for a smooth endless loop
      }),
      -1,
      false, // False means it restarts from the beginning, creating a continuous beam
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shimmerTranslate.value }],
    };
  });

  if (isUser) return null; // Add your user dot logic back here

  return (
    <View style={styles.premiumBubble}>
      {/* The Masked View takes an 'element' and uses its opacity to mask the children */}
      <MaskedView
        style={styles.maskedContainer}
        maskElement={
          <View style={styles.maskWrapper}>
            <Text style={styles.maskText}>{agentProgress}</Text>
          </View>
        }
      >
        {/* Everything inside here is only visible WHERE THE TEXT IS */}

        {/* 1. The default text color (visible when the shimmer beam isn't over it) */}
        <View style={styles.baseTextLayer} />

        {/* 2. The Shimmer Beam (Moving Left to Right) */}
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={[
              "transparent",
              "#FF2A54", // Vibrant Pink
              "#FF9000", // Warm Orange
              "#00D0FF", // Neon Cyan
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBeam}
          />
        </Animated.View>
      </MaskedView>
    </View>
  );
};

const styles = StyleSheet.create({
  premiumBubble: {
    alignSelf: "flex-start",
    marginLeft: 10,
    marginBottom: 8,
    backgroundColor: "#1C1C1E", // Sleek dark bubble looks best with neon shimmers
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 18,
    // Provide a fixed min-height so the mask calculates layout correctly
    minHeight: 45,
    justifyContent: "center",
  },
  maskedContainer: {
    // Flex 1 ensures the mask fills the padding of the bubble
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  maskWrapper: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
  },
  maskText: {
    fontFamily: "serif",
    fontWeight: "900", // Heaviest weight possible for maximum gradient visibility
    fontSize: 15,
    letterSpacing: 0.5,
    color: "black", // The mask element MUST be black/opaque to cut the hole
  },
  baseTextLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#666666", // The resting color of the text
  },
  gradientBeam: {
    // We make the gradient extra wide so the beam feels large and soft
    width: "300%",
    height: "100%",
    left: "-100%", // Offset it so the animation starts out of frame
  },
});
