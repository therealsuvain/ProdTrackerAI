import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

type HelloThereEasterEggAnimationProps = {
  /** Set true only while the Hello There egg owns the shared activation lock. */
  active: boolean;
  /** Called once when the full entrance, greeting, and exit have completed. */
  onFinished: () => void;
};

const helloThereHead = require("@/assets/easter-eggs/hello-there-head.png");
const helloThereRaisedHand = require("@/assets/easter-eggs/hello-there-raised-hand-cropped.png");
/**
 * A decorative, row-anchored Hello There animation.
 *
 * Mount this inside the Hello There egg row (or a nearby unclipped overlay host),
 * whose parent should allow overflow. The component is pointer-transparent and
 * does not own matching, activation locking, or discovery persistence.
 */
export function HelloThereEasterEggAnimation({
  active,
  onFinished,
}: HelloThereEasterEggAnimationProps) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const onFinishedRef = useRef(onFinished);
  const finishedRef = useRef(false);
  const entrance = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  // This lifetime guard also releases the parent activation lock if the row is
  // removed before the OS reduced-motion preference resolves.
  useEffect(() => {
    if (!active) return;
    finishedRef.current = false;
    return () => {
      if (!finishedRef.current) onFinishedRef.current();
    };
  }, [active]);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // If the system setting cannot be queried, use the normal animation.
        if (isMounted) setReduceMotion(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      entrance.setValue(0);
      exit.setValue(0);
      wave.setValue(0);
      bubble.setValue(0);
      return;
    }

    // Wait until the OS motion preference has been read so we do not briefly
    // play the full entrance for users who have reduced motion enabled.
    if (reduceMotion === null) return;

    entrance.setValue(0);
    exit.setValue(0);
    wave.setValue(0);
    bubble.setValue(0);

    // This component is mounted per activation, so the preference is sampled
    // once and cannot restart the animation midway through its lifecycle.
    const prefersReducedMotion = reduceMotion;

    const inAnimation = Animated.timing(entrance, {
      toValue: 1,
      duration: prefersReducedMotion ? 0 : 380,
      easing: prefersReducedMotion
        ? Easing.linear
        : Easing.out(Easing.back(1.15)),
      useNativeDriver: true,
    });

    const waveAnimation = prefersReducedMotion
      ? Animated.delay(1)
      : Animated.sequence([
          Animated.timing(wave, {
            toValue: 1,
            duration: 115,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wave, {
            toValue: -1,
            duration: 170,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(wave, {
            toValue: 0,
            duration: 145,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]);

    const bubbleAnimation = Animated.sequence([
      Animated.delay(prefersReducedMotion ? 0 : 120),
      Animated.timing(bubble, {
        toValue: 1,
        duration: prefersReducedMotion ? 0 : 190,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const animation = Animated.sequence([
      inAnimation,
      Animated.parallel([waveAnimation, bubbleAnimation]),
      Animated.delay(prefersReducedMotion ? 520 : 700),
      Animated.parallel([
        Animated.timing(exit, {
          toValue: 1,
          duration: prefersReducedMotion ? 160 : 290,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bubble, {
          toValue: 0,
          duration: prefersReducedMotion ? 120 : 170,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        finishedRef.current = true;
        onFinishedRef.current();
      }
    });

    return () => {
      animation.stop();
    };
  }, [active, reduceMotion, entrance, exit, wave, bubble]);

  if (!active) return null;

  const exitOpacity = exit.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const translateX = Animated.add(
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: reduceMotion ? [0, 0] : [105, 0],
    }),
    exit.interpolate({
      inputRange: [0, 1],
      outputRange: reduceMotion ? [0, 0] : [0, 78],
    }),
  );
  const translateY = Animated.add(
    entrance.interpolate({
      inputRange: [0, 1],
      outputRange: reduceMotion ? [0, 0] : [18, 0],
    }),
    exit.interpolate({
      inputRange: [0, 1],
      outputRange: reduceMotion ? [0, 0] : [0, 22],
    }),
  );
  const scale = Animated.multiply(
    entrance.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: reduceMotion ? [1, 1, 1] : [0.82, 1.045, 1],
    }),
    exit.interpolate({
      inputRange: [0, 1],
      outputRange: reduceMotion ? [1, 1] : [1, 0.93],
    }),
  );
  const armRotation = wave.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-2.5deg", "0deg", "2.5deg"],
  });
  const bubbleOpacity = Animated.multiply(bubble, exitOpacity);
  const bubbleTranslateY = bubble.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.overlay}
    >
      <Animated.View
        style={[
          styles.mascotStage,
          {
            opacity: Animated.multiply(entrance, exitOpacity),
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.raisedHandLayer,
            { transform: [{ rotate: armRotation }] },
          ]}
        >
          <Image
            source={helloThereRaisedHand}
            resizeMode="contain"
            fadeDuration={0}
            style={styles.raisedHandImage}
          />
        </Animated.View>

        <Image
          source={helloThereHead}
          resizeMode="contain"
          fadeDuration={0}
          style={styles.headImage}
        />

        <Animated.View
          style={[
            styles.speechBubble,
            {
              opacity: bubbleOpacity,
              transform: [{ translateY: bubbleTranslateY }],
            },
          ]}
        >
          <View style={styles.speechBubbleTail} />
          <Text style={styles.speechBubbleText}>HELLO THERE.</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
    zIndex: 1000,
    elevation: 20,
  },
  mascotStage: {
    position: "absolute",
    right: 20,
    bottom: -24,
    width: 248,
    height: 250,
    overflow: "visible",
  },
  raisedHandLayer: {
    position: "absolute",
    left: 34,
    top: -2,
    width: 205,
    height: 250,
    zIndex: 1,
  },
  raisedHandImage: {
    width: "100%",
    height: "100%",
  },
  headImage: {
    position: "absolute",
    left: 2,
    top: 26,
    width: 143,
    height: 202,
    zIndex: 2,
  },
  speechBubble: {
    position: "absolute",
    top: -18,
    left: 0,
    width: 155,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7D7D7",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 3,
  },
  speechBubbleTail: {
    position: "absolute",
    right: 18,
    bottom: -5,
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#D7D7D7",
    transform: [{ rotate: "45deg" }],
  },
  speechBubbleText: {
    color: "#252525",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
});
