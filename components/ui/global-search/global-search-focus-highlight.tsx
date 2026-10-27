import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

import { withAlpha } from "@/utils/common-utils";

export interface GlobalSearchFocusHighlightRequest {
  id: string;
  requestId: string;
}

interface GlobalSearchFocusHighlightProps {
  request?: GlobalSearchFocusHighlightRequest | null;
  accentColor: string;
  borderRadius?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlobalSearchFocusHighlight({
  request,
  accentColor,
  borderRadius = 14,
  children,
  style,
}: GlobalSearchFocusHighlightProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.stopAnimation();

    if (!request?.requestId) {
      opacity.setValue(0);
      return;
    }

    opacity.setValue(0);

    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.delay(1100),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => animation.stop();
  }, [request?.requestId, accentColor, opacity]);

  return (
    <View style={[styles.container, style]}>
      {children}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.highlight,
          {
            borderRadius,
            borderColor: accentColor,
            backgroundColor: withAlpha(accentColor, "22"),
            opacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "stretch",
  },
  highlight: {
    borderWidth: 2,
  },
});
