import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

const cloudDeckBackground = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/cloud_deck_background.jpg");
const cloudBank01 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/cloud_bank_01.png");
const cloudBank02 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/cloud_bank_02.png");
const cloudBank04 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/cloud_bank_04.png");

const midCloud01 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/mid_cloud_01.png");
const midCloud06 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/mid_cloud_06.png");
const midCloud08 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/mid_cloud_08.png");
const midCloud10 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/mid_cloud_10.png");

const wispy01 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/wispy_01.png");
const wispy02 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/wispy_02.png");
const wispy03 = require("@/assets/easter-eggs/nuke-backlog-assets/flight-scene/wispy_03.png");

export const NUKE_FLIGHT_ENVIRONMENT_TUNING = {
  // The background image already contains a full cloud-deck view. Keep the
  // extra sprites restrained so they add parallax rather than form more stripes.
  cloudDeckOpacity: 0.92,
  skyWashColor: "rgba(166, 207, 232, 0.10)",
  bank01: {
    left: -0.28,
    top: 0.42,
    width: 1.5,
    opacity: 0.11,
    driftX: 16,
    driftY: 3,
    durationMs: 22000,
  },
  bank02: {
    left: -0.28,
    top: 0.73,
    width: 1.55,
    opacity: 0.13,
    driftX: -22,
    driftY: 5,
    durationMs: 26000,
    delayMs: 900,
  },
  bank04: {
    left: -0.34,
    top: 0.84,
    width: 1.62,
    opacity: 0.07,
    driftX: 14,
    driftY: 3,
    durationMs: 30000,
    delayMs: 1500,
  },
  mid08: {
    left: -0.18,
    top: 0.2,
    width: 0.52,
    opacity: 0.09,
    driftX: -16,
    driftY: 6,
    durationMs: 18000,
    delayMs: 400,
  },
  mid01: {
    left: 0.48,
    top: 0.37,
    width: 0.48,
    opacity: 0.1,
    driftX: 18,
    driftY: -5,
    durationMs: 22000,
    delayMs: 1200,
  },
  mid06: {
    left: -0.14,
    top: 0.6,
    width: 0.43,
    opacity: 0.08,
    driftX: -14,
    driftY: 4,
    durationMs: 20000,
    delayMs: 700,
  },
  mid10: {
    left: 0.7,
    top: 0.66,
    width: 0.34,
    opacity: 0.1,
    driftX: 16,
    driftY: -4,
    durationMs: 19000,
    delayMs: 1800,
  },
  wispy01: {
    left: -0.08,
    top: 0.14,
    width: 1.0,
    opacity: 0.07,
    driftX: 32,
    driftY: -4,
    durationMs: 28000,
  },
  wispy02: {
    left: 0.22,
    top: 0.47,
    width: 0.76,
    opacity: 0.06,
    driftX: -26,
    driftY: 4,
    durationMs: 26000,
    delayMs: 1300,
  },
  wispy03: {
    left: -0.16,
    top: 0.73,
    width: 1.02,
    opacity: 0.06,
    driftX: 22,
    driftY: -3,
    durationMs: 30000,
    delayMs: 2100,
  },
} as const;

type DriftImageProps = {
  active: boolean;
  source: ImageSourcePropType;
  left: number;
  top: number;
  width: number;
  aspectRatio: number;
  opacity: number;
  driftX: number;
  driftY: number;
  durationMs: number;
  delayMs?: number;
  scale?: number;
};

/** A small, native-driver drift loop for a single transparent cloud asset. */
function DriftImage({
  active,
  source,
  left,
  top,
  width,
  aspectRatio,
  opacity,
  driftX,
  driftY,
  durationMs,
  delayMs = 0,
  scale = 1,
}: DriftImageProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!active) return;

    const drift = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(progress, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    drift.start();

    return () => {
      drift.stop();
      progress.stopAnimation();
    };
  }, [active, delayMs, durationMs, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-driftX / 2, driftX / 2],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-driftY / 2, driftY / 2],
  });

  return (
    <Animated.Image
      /* pointerEvents="none" */
      source={source}
      resizeMode="contain"
      fadeDuration={0}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height: width / aspectRatio,
        opacity: active ? opacity : 0,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

type NukeFlightEnvironmentProps = {
  active: boolean;
  width: number;
  height: number;
  /** The aircraft-style shadow is inserted above the deck but below cloud sprites. */
  shadowLayer?: React.ReactNode;
  fadeDurationMs?: number;
};

/**
 * Lightweight layered cloud environment for the Nuke My Backlog flight.
 * The broad cloud-deck JPEG is the base; transparent PNGs provide depth and
 * parallax. The component only becomes visible during autonomous flight.
 */
export default function NukeFlightEnvironment({
  active,
  width,
  height,
  shadowLayer,
  fadeDurationMs = 1900,
}: NukeFlightEnvironmentProps) {
  const sceneOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(sceneOpacity, {
      toValue: active ? 1 : 0,
      duration: active ? fadeDurationMs : 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, fadeDurationMs, sceneOpacity]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[
        StyleSheet.absoluteFillObject,
        styles.root,
        { opacity: sceneOpacity },
      ]}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.skyBase]} />
      <Animated.Image
        source={cloudDeckBackground}
        resizeMode="cover"
        fadeDuration={0}
        style={[
          StyleSheet.absoluteFillObject,
          styles.deck,
          { opacity: NUKE_FLIGHT_ENVIRONMENT_TUNING.cloudDeckOpacity },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: NUKE_FLIGHT_ENVIRONMENT_TUNING.skyWashColor },
        ]}
      />

      {/* The moving shadow sits on the cloud deck, behind nearer cloud sprites. */}
      {shadowLayer}

      {/* Distant horizontal cloud banks. Their slow drift establishes depth. */}
      <DriftImage
        active={active}
        source={cloudBank01}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.width}
        aspectRatio={2048 / 351}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank01.durationMs}
      />
      <DriftImage
        active={active}
        source={cloudBank02}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.width}
        aspectRatio={2048 / 479}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank02.delayMs}
      />
      <DriftImage
        active={active}
        source={cloudBank04}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.width}
        aspectRatio={2048 / 623}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.bank04.delayMs}
      />

      {/* Mid-distance clouds: sparse placement avoids turning the scene busy. */}
      <DriftImage
        active={active}
        source={midCloud08}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.width}
        aspectRatio={1852 / 813}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid08.delayMs}
      />
      <DriftImage
        active={active}
        source={midCloud01}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.width}
        aspectRatio={1716 / 842}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid01.delayMs}
      />
      <DriftImage
        active={active}
        source={midCloud06}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.width}
        aspectRatio={1823 / 856}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid06.delayMs}
      />
      <DriftImage
        active={active}
        source={midCloud10}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.width}
        aspectRatio={1312 / 797}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.mid10.delayMs}
      />

      {/* Wispy high-altitude layers: deliberately faint and slow. */}
      <DriftImage
        active={active}
        source={wispy01}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.width}
        aspectRatio={1300 / 189}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy01.durationMs}
      />
      <DriftImage
        active={active}
        source={wispy02}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.width}
        aspectRatio={1300 / 217}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy02.delayMs}
      />
      <DriftImage
        active={active}
        source={wispy03}
        left={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.left}
        top={height * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.top}
        width={width * NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.width}
        aspectRatio={1300 / 181}
        opacity={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.opacity}
        driftX={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.driftX}
        driftY={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.driftY}
        durationMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.durationMs}
        delayMs={NUKE_FLIGHT_ENVIRONMENT_TUNING.wispy03.delayMs}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 0,
    elevation: 0,
    overflow: "hidden",
    backgroundColor: "#B8D8EC",
  },
  skyBase: {
    backgroundColor: "#B8D8EC",
  },
  deck: {
    width: "100%",
    height: "100%",
  },
});
