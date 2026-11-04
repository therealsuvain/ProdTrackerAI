import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

type SpeedGroup = "slow" | "medium" | "fast";

type StreakSpec = {
  id: number;
  x: number;
  length: number;
  width: number;
  opacity: number;
  color: string;
  durationMs: number;
  delayMs: number;
  group: SpeedGroup;
};

// Deterministic positions make the streak field visually consistent on every run.
// The three speed groups are cross-faded to make the field feel as though it is
// accelerating, rather than changing every line's animation clock mid-flight.
const STREAKS: StreakSpec[] = Array.from({ length: 42 }, (_, index) => {
  const seed = index + 1;
  const group: SpeedGroup =
    index % 3 === 0 ? "slow" : index % 3 === 1 ? "medium" : "fast";
  const palette = ["#F8FCFF", "#C4E6FF", "#75B9F2", "#4E83B8", "#E9F4FF"];
  const groupDuration =
    group === "slow" ? 1850 : group === "medium" ? 820 : 330;

  return {
    id: index,
    x: ((seed * 37) % 97) / 100,
    length: 0.28 + (((seed * 19) % 68) / 100),
    width: seed % 11 === 0 ? 2.1 : seed % 4 === 0 ? 1.55 : 1,
    opacity: 0.34 + (((seed * 13) % 55) / 100),
    color: palette[seed % palette.length],
    durationMs: groupDuration + ((seed * 43) % 260),
    delayMs: (seed * 71) % groupDuration,
    group,
  };
});

const GROUPS: SpeedGroup[] = ["slow", "medium", "fast"];

export const NUKE_LAUNCH_STREAK_TUNING = {
  accelerationDurationMs: 2600,
  rootFadeInMs: 240,
  linesFadeOutMs: 650,
  whiteWashFadeOutMs: 1900,
  maximumWhiteWashOpacity: 0.22,
  travelOverscanRatio: 1.25,
  glowOpacity: 0.28,
  glowRadius: 5,
} as const;

type Props = {
  active: boolean;
  fadeOut?: boolean;
  width: number;
  height: number;
};

type StreakLineProps = {
  spec: StreakSpec;
  width: number;
  height: number;
  active: boolean;
};

function StreakLine({ spec, width, height, active }: StreakLineProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active || width <= 0 || height <= 0) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delayMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: spec.durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      progress.stopAnimation();
    };
  }, [active, height, progress, spec.delayMs, spec.durationMs, width]);

  const lineHeight = Math.max(50, height * spec.length);
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * NUKE_LAUNCH_STREAK_TUNING.travelOverscanRatio + lineHeight],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: width * spec.x,
        top: -lineHeight,
        width: spec.width,
        height: lineHeight,
        borderRadius: spec.width,
        backgroundColor: spec.color,
        opacity: spec.opacity,
        shadowColor: spec.color,
        shadowOpacity: NUKE_LAUNCH_STREAK_TUNING.glowOpacity,
        shadowRadius: NUKE_LAUNCH_STREAK_TUNING.glowRadius,
        shadowOffset: { width: 0, height: 0 },
        transform: [{ translateY }],
      }}
    />
  );
}

/**
 * Procedural launch-speed field. All streaks are ordinary native-driver
 * Animated.Views; no streak bitmap or additional animation library is needed.
 */
export default function NukeLaunchSpeedStreaks({
  active,
  fadeOut = false,
  width,
  height,
}: Props) {
  const acceleration = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(0)).current;
  const linesOpacity = useRef(new Animated.Value(1)).current;
  const whiteWashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    acceleration.stopAnimation();
    rootOpacity.stopAnimation();
    linesOpacity.stopAnimation();
    whiteWashOpacity.stopAnimation();

    if (!active) {
      rootOpacity.setValue(0);
      linesOpacity.setValue(0);
      whiteWashOpacity.setValue(0);
      acceleration.setValue(0);
      return;
    }

    acceleration.setValue(0);
    rootOpacity.setValue(0);
    linesOpacity.setValue(1);
    whiteWashOpacity.setValue(0);
    const show = Animated.parallel([
      Animated.timing(rootOpacity, {
        toValue: 1,
        duration: NUKE_LAUNCH_STREAK_TUNING.rootFadeInMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(acceleration, {
        toValue: 1,
        duration: NUKE_LAUNCH_STREAK_TUNING.accelerationDurationMs,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(whiteWashOpacity, {
        toValue: NUKE_LAUNCH_STREAK_TUNING.maximumWhiteWashOpacity,
        duration: NUKE_LAUNCH_STREAK_TUNING.accelerationDurationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    show.start();
    return () => show.stop();
  }, [active, acceleration, linesOpacity, rootOpacity, whiteWashOpacity]);

  useEffect(() => {
    if (!active || !fadeOut) return;
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
  }, [active, fadeOut, linesOpacity, whiteWashOpacity]);

  const groupOpacities = useMemo(
    () => ({
      slow: acceleration.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [0.62, 0.40, 0.12],
        extrapolate: "clamp",
      }),
      medium: acceleration.interpolate({
        inputRange: [0, 0.40, 1],
        outputRange: [0.02, 0.32, 0.72],
        extrapolate: "clamp",
      }),
      fast: acceleration.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [0, 0.12, 0.88],
        extrapolate: "clamp",
      }),
    }),
    [acceleration],
  );

  if (!active || width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFillObject, styles.root, { opacity: rootOpacity }]}
    >
      {/* A restrained white wash prepares the transition into the cloud deck. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#F6FBFF", opacity: whiteWashOpacity }]}
      />

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { opacity: linesOpacity }]}
      >
        {GROUPS.map((group) => (
          <Animated.View
            key={group}
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { opacity: groupOpacities[group] }]}
          >
            {STREAKS.filter((spec) => spec.group === group).map((spec) => (
              <StreakLine
                key={spec.id}
                spec={spec}
                width={width}
                height={height}
                active={active}
              />
            ))}
          </Animated.View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    zIndex: 2,
  },
});
