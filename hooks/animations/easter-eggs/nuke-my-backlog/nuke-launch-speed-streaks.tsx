import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

// These are pre-rendered, seamless-in-motion streak fields. Each texture contains
// 300 pure-white streaks at a different length stage. Replacing hundreds of
// individual React Native Views with eight image layers avoids the mount/layout
// spike seen on mid-range Android devices.
const STREAK_STAGE_1 = require("@/assets/easter-eggs/nuke-backlog-assets/launch-streaks/streaks_stage_1.png");
const STREAK_STAGE_2 = require("@/assets/easter-eggs/nuke-backlog-assets/launch-streaks/streaks_stage_2.png");
const STREAK_STAGE_3 = require("@/assets/easter-eggs/nuke-backlog-assets/launch-streaks/streaks_stage_3.png");
const STREAK_STAGE_4 = require("@/assets/easter-eggs/nuke-backlog-assets/launch-streaks/streaks_stage_4.png");

const ACCELERATION_STEPS_MS = [
  1800, 1400, 1100, 850, 660, 510, 390, 300, 235,
] as const;

const ACCELERATION_DURATION_MS = ACCELERATION_STEPS_MS.reduce(
  (total, duration) => total + duration,
  0,
);
const FASTEST_LOOP_MS = ACCELERATION_STEPS_MS[ACCELERATION_STEPS_MS.length - 1];

export const NUKE_LAUNCH_STREAK_TUNING = {
  streakCount: 300,
  accelerationDurationMs: ACCELERATION_DURATION_MS,
  fastestLoopMs: FASTEST_LOOP_MS,
  rootFadeInMs: 140,
  linesFadeOutMs: 850,
  whiteWashFadeOutMs: 1100,
  maximumWhiteWashOpacity: 0.24,
} as const;

type StreakStage = {
  source: ImageSourcePropType;
  opacity: Animated.AnimatedInterpolation<number>;
};

type Props = {
  active: boolean;
  fadeOut?: boolean;
  width: number;
  height: number;
};

export default function NukeLaunchSpeedStreaks({
  active,
  fadeOut = false,
  width,
  height,
}: Props) {
  const acceleration = useRef(new Animated.Value(0)).current;
  const fieldOffset = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const linesOpacity = useRef(new Animated.Value(1)).current;
  const whiteWashOpacity = useRef(new Animated.Value(0)).current;

  const stages = useMemo<StreakStage[]>(
    () => [
      {
        source: STREAK_STAGE_1,
        opacity: acceleration.interpolate({
          inputRange: [0, 0.18, 0.46, 0.72, 1],
          outputRange: [1, 0.92, 0.48, 0.1, 0],
          extrapolate: "clamp",
        }),
      },
      {
        source: STREAK_STAGE_2,
        opacity: acceleration.interpolate({
          inputRange: [0, 0.16, 0.38, 0.66, 0.9, 1],
          outputRange: [0, 0.18, 0.78, 0.92, 0.28, 0],
          extrapolate: "clamp",
        }),
      },
      {
        source: STREAK_STAGE_3,
        opacity: acceleration.interpolate({
          inputRange: [0, 0.34, 0.56, 0.78, 1],
          outputRange: [0, 0, 0.56, 0.92, 0.34],
          extrapolate: "clamp",
        }),
      },
      {
        source: STREAK_STAGE_4,
        opacity: acceleration.interpolate({
          inputRange: [0, 0.58, 0.82, 1],
          outputRange: [0, 0, 0.42, 1],
          extrapolate: "clamp",
        }),
      },
    ],
    [acceleration],
  );

  useEffect(() => {
    acceleration.stopAnimation();
    fieldOffset.stopAnimation();
    rootOpacity.stopAnimation();
    linesOpacity.stopAnimation();
    whiteWashOpacity.stopAnimation();

    if (!active || width <= 0 || height <= 0) {
      rootOpacity.setValue(0);
      linesOpacity.setValue(0);
      whiteWashOpacity.setValue(0);
      acceleration.setValue(0);
      fieldOffset.setValue(0);
      return;
    }

    acceleration.setValue(0);
    fieldOffset.setValue(-height); //fieldOffset.setValue(0);
    rootOpacity.setValue(0);
    linesOpacity.setValue(1);
    whiteWashOpacity.setValue(0);

    // One shared native-driver offset scrolls two identical image tiles. The
    // offset reset is visually invisible because tile A and tile B are copies.
    const tilePass = (durationMs: number) =>
      Animated.sequence([
        Animated.timing(fieldOffset, {
          toValue: 0, //-height,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(fieldOffset, {
          toValue: -height, //0,
          duration: 1,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]);

    const movement = Animated.sequence([
      ...ACCELERATION_STEPS_MS.map(tilePass),
      Animated.loop(tilePass(FASTEST_LOOP_MS)),
    ]);

    const reveal = Animated.parallel([
      Animated.timing(rootOpacity, {
        toValue: 1,
        duration: NUKE_LAUNCH_STREAK_TUNING.rootFadeInMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(acceleration, {
        toValue: 1,
        duration: ACCELERATION_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(whiteWashOpacity, {
        toValue: NUKE_LAUNCH_STREAK_TUNING.maximumWhiteWashOpacity,
        duration: ACCELERATION_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      movement,
    ]);

    reveal.start();
    return () => reveal.stop();
  }, [
    active,
    acceleration,
    fieldOffset,
    height,
    linesOpacity,
    rootOpacity,
    whiteWashOpacity,
    width,
  ]);

  useEffect(() => {
    if (!active || !fadeOut) return;
    // Freeze the final streak arrangement before fading it away.
    // This prevents the repeating 235ms tile cycle from resetting underneath
    // the fade-out transition.
    acceleration.stopAnimation();
    fieldOffset.stopAnimation();
    const fade = Animated.parallel([
      Animated.timing(linesOpacity, {
        toValue: 0,
        duration: NUKE_LAUNCH_STREAK_TUNING.linesFadeOutMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(whiteWashOpacity, {
        toValue: 0,
        duration: NUKE_LAUNCH_STREAK_TUNING.whiteWashFadeOutMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    fade.start();
    return () => fade.stop();
  }, [
    active,
    fadeOut,
    linesOpacity,
    whiteWashOpacity,
    acceleration,
    fieldOffset,
  ]);

  if (!active || width <= 0 || height <= 0) return null;

  const renderTile = (tileKey: string, tileTop: number) => (
    <View
      key={tileKey}
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: tileTop, width, height }}
    >
      {stages.map((stage, index) => (
        <Animated.Image
          key={`${tileKey}-stage-${index}`}
          source={stage.source}
          resizeMode="stretch"
          fadeDuration={0}
          /* pointerEvents="none" */
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            opacity: stage.opacity,
          }}
        />
      ))}
    </View>
  );

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[
        StyleSheet.absoluteFillObject,
        styles.root,
        { opacity: rootOpacity },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#F8FCFF", opacity: whiteWashOpacity },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { opacity: linesOpacity }]}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height: height * 2,
            transform: [{ translateY: fieldOffset }],
          }}
        >
          {renderTile("tile-a", 0)}
          {renderTile("tile-b", height)}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    zIndex: 0,
  },
});
