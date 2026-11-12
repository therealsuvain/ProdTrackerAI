import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

/**
 * NUKE MY BACKLOG — ACT 3
 * ============================================================================
 * Camera approach / nose-facing perspective transition.
 *
 * Act 2 hands this component a centred side-view rocket at its final scale.
 * Act 3 then:
 *   3.1  Pitches the rocket towards the viewer through 30 / 60 / 75 / 90 assets.
 *   3.2  Introduces the matching smoke wisps and the four-frame 90° smoke ring.
 *   3.3  Holds the head-on nose view and starts a dramatic camera approach.
 *   3.4  Adds an asymmetric roll: -30° left, then +90° right in two speeds.
 *   3.5  Expands smoke, atmospheric haze and a restrained final white bloom.
 *
 * IMPORTANT DESIGN LIMITATION
 * --------------------------
 * These are 2D perspective illustrations, not a 3D model. We preserve the
 * apparent cross-section width and let the actual transparent silhouette of
 * each view shorten as the viewing angle approaches the rocket's nose axis.
 * The zoom, roll, smoke and atmospheric layers sell the camera approach.
 *
 * This file deliberately does NOT own an AudioPlayer. It receives a callback
 * from the existing useNukeMyBacklogAudio owner, so Act 3 never creates or
 * disposes duplicate players.
 */

// ---------------------------------------------------------------------------
// ASSETS
// ---------------------------------------------------------------------------
// `rocket.png` is the already-calibrated Act 0–2 side-view rocket.
const rocketSide = require("@/assets/easter-eggs/nuke-backlog-assets/rocket.png");

// New perspective views. These are the user's generated matching views.
const rocket30 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_30.png");
const rocket60 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_60.png");
const rocket75 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_75.png");
const rocket90 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_90.png");

// Transitional smoke assets for the 30°, 60° and 75° portions of the turn.
const smoke30 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_30_smoke.png");
const smoke60 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_60_smoke.png");
const smoke75 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_75_smoke.png");

// Four variations of the head-on smoke ring. We cross-fade them like the
// existing flame-frame rig rather than abruptly replacing one frame with next.
const smoke90Frame1 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_90_smoke_1.png");
const smoke90Frame2 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_90_smoke_2.png");
const smoke90Frame3 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_90_smoke_3.png");
const smoke90Frame4 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_turn_up_90_smoke_4.png");

// ---------------------------------------------------------------------------
// TUNING — CHANGE THESE VALUES FIRST
// ---------------------------------------------------------------------------
// All timings are milliseconds. Angles are degrees. Ratios are screen ratios.
// The named sub-act comments below explain which part each group controls.
export const NUKE_MY_BACKLOG_ACT3_TUNING = {
  // ACT 3.1 — Perspective turn.
  // Increase duration if the switch between generated views feels too sudden.
  perspectiveTurnDurationMs: 2500, //1560,
  perspectiveCrossFadeSoftness: 0, //0.075,

  // ACT 3.2 — Transition smoke.
  smoke30VisibleWidthMultiplier: 0.5, //2.10,
  smoke60VisibleWidthMultiplier: 0.5, //4.15,
  smoke75VisibleWidthMultiplier: 0.5, //3.20,
  transitionSmokePeakOpacity: 0.82,

  // ACT 3.3 — 90-degree smoke ring.
  smokeRingVisibleWidthMultiplier: 1.25, // 3.55,
  smokeRingFinalCoverageWidthRatio: 1.0, //1.48,
  smokeRingFinalCoverageHeightRatio: 1.0, //1.42,
  smokeRingOpacity: 0.94,
  smokeRingFrameCrossFadeMs: 310,
  smokeRingRotationStartDeg: -3,
  smokeRingRotationEndDeg: 7,
  smokeRingExpandDurationMs: 10000, // 3650,
  // ACT 3.3 — Smoke ring positioning.
  // Negative X moves the smoke left; positive X moves it right.
  smokeRingOffsetXRatio: -0.01, //-0.015,
  smokeRingOffsetYRatio: 0,

  // ACT 3.4 — Rocket camera approach.
  // Final coverage chooses the larger of width/height targets, so it also
  // behaves sensibly on tablets and landscape layouts.
  approachFinalCoverageWidthRatio: 1.13,
  approachFinalCoverageHeightRatio: 0.91,
  approachZoomDurationMs: 10000, //3650,
  approachZoomEasing: "inCubic" as "inCubic" | "inOutCubic",

  // ACT 3.5 — Roll after the nose has become front-facing.
  // First: neutral -> -30° (fast first, then decelerates through the last 20°).
  rollLeftAngleDeg: -30,
  rollLeftDurationMs: 570,
  // Second: -30° -> +60° (90° sweep, easing into the move).
  rollRightSlowEndAngleDeg: 60,
  rollRightSlowDurationMs: 1040,
  // Final: +60° -> +90° (last 30° happens very quickly).
  rollRightFastEndAngleDeg: 90,
  rollRightFastDurationMs: 165,

  // ACT 3.6 — Atmospheric finish.
  radialRayCount: 18,
  radialRayOpacity: 0.16,
  atmosphericHazeMaximumOpacity: 0.22,
  finalWhiteBloomMaximumOpacity: 0.27,
  finalWhiteBloomDurationMs: 480,

  // ACT 3.7 — Existing flight audio bed.
  // expo-audio volume is 0.0–1.0. 1.0 is the API maximum.
  // Increase duration for a gentler approach; the audio player is not restarted.
  approachFlightVolume: 1.0,
  approachFlightVolumeFadeMs: 3100,

  // Accessibility fallback. Keeps the sequence but shortens its motion.
  reducedMotionTurnDurationMs: 650,
  reducedMotionZoomDurationMs: 1200,
};

// ---------------------------------------------------------------------------
// PIXEL / ALPHA METADATA
// ---------------------------------------------------------------------------
// Values are measured from the supplied PNGs' actual alpha bounds. The
// transparent canvas margins are intentionally included in the layout math.
// This aligns the *visible artwork*, not merely the PNG canvas centres.
type SpriteFrame = {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  alphaLeft: number;
  alphaTop: number;
  alphaRight: number;
  alphaBottom: number;
};

const ROCKET_FRAMES: SpriteFrame[] = [
  {
    source: rocketSide,
    sourceWidth: 654,
    sourceHeight: 1912,
    alphaLeft: 8,
    alphaTop: 31,
    alphaRight: 644,
    alphaBottom: 1912,
  },
  {
    source: rocket30,
    sourceWidth: 383,
    sourceHeight: 780,
    alphaLeft: 61,
    alphaTop: 51,
    alphaRight: 328,
    alphaBottom: 776,
  },
  {
    source: rocket60,
    sourceWidth: 638,
    sourceHeight: 786,
    alphaLeft: 72,
    alphaTop: 43,
    alphaRight: 586,
    alphaBottom: 759,
  },
  {
    source: rocket75,
    sourceWidth: 829,
    sourceHeight: 743,
    alphaLeft: 62,
    alphaTop: 25,
    alphaRight: 750,
    alphaBottom: 697,
  },
  {
    source: rocket90,
    sourceWidth: 818,
    sourceHeight: 810,
    alphaLeft: 30,
    alphaTop: 36,
    alphaRight: 780,
    alphaBottom: 752,
  },
];

const TRANSITION_SMOKE: SpriteFrame[] = [
  {
    source: smoke30,
    sourceWidth: 487,
    sourceHeight: 491,
    alphaLeft: 93,
    alphaTop: 102,
    alphaRight: 396,
    alphaBottom: 387,
  },
  {
    source: smoke60,
    sourceWidth: 1349,
    sourceHeight: 501,
    alphaLeft: 20,
    alphaTop: 33,
    alphaRight: 1311,
    alphaBottom: 451,
  },
  {
    source: smoke75,
    sourceWidth: 807,
    sourceHeight: 757,
    alphaLeft: 32,
    alphaTop: 29,
    alphaRight: 790,
    alphaBottom: 713,
  },
];

const SMOKE_RING_FRAMES: SpriteFrame[] = [
  {
    source: smoke90Frame1,
    sourceWidth: 983,
    sourceHeight: 896,
    alphaLeft: 49,
    alphaTop: 36,
    alphaRight: 923,
    alphaBottom: 867,
  },
  {
    source: smoke90Frame2,
    sourceWidth: 1023,
    sourceHeight: 920,
    alphaLeft: 43,
    alphaTop: 21,
    alphaRight: 976,
    alphaBottom: 878,
  },
  {
    source: smoke90Frame3,
    sourceWidth: 1030,
    sourceHeight: 895,
    alphaLeft: 31,
    alphaTop: 27,
    alphaRight: 962,
    alphaBottom: 869,
  },
  {
    source: smoke90Frame4,
    sourceWidth: 982,
    sourceHeight: 907,
    alphaLeft: 43,
    alphaTop: 47,
    alphaRight: 968,
    alphaBottom: 885,
  },
];

// Returns a native Image style where the visible alpha bounds have the target
// width and are centred exactly on the camera's centre point.
function getCentredSpriteLayout(
  frame: SpriteFrame,
  centreX: number,
  centreY: number,
  targetVisibleWidth: number,
) {
  const alphaWidth = frame.alphaRight - frame.alphaLeft;
  const pixelScale = targetVisibleWidth / alphaWidth;
  const alphaCentreX = (frame.alphaLeft + frame.alphaRight) / 2;
  const alphaCentreY = (frame.alphaTop + frame.alphaBottom) / 2;

  return {
    position: "absolute" as const,
    left: centreX - alphaCentreX * pixelScale,
    top: centreY - alphaCentreY * pixelScale,
    width: frame.sourceWidth * pixelScale,
    height: frame.sourceHeight * pixelScale,
  };
}

type Props = {
  active: boolean;
  canvasWidth: number;
  canvasHeight: number;
  /** Existing Act 2 rocket image canvas width, before its 0.72 final scale. */
  rocketWidth: number;
  /** Existing Act 2 final scale, normally bottomEntryEndScale (0.72). */
  initialRocketScale: number;
  /** Camera centre; Act 2 currently hands off at x=50%, y=50%. */
  centreX: number;
  centreY: number;
  /** Fade the already-playing thrust loop; do not create a second player. */
  onFlightVolumeTo?: (targetVolume: number, durationMs: number) => void;
  onComplete?: () => void;
};

export default function NukeMyBacklogAct3({
  active,
  canvasWidth,
  canvasHeight,
  rocketWidth,
  initialRocketScale,
  centreX,
  centreY,
  onFlightVolumeTo,
  onComplete,
}: Props) {
  // Every animation value is stable across renders. The parent hook keeps this
  // component mounted until the overall Easter egg is cancelled or completed.
  const pitchProgress = useRef(new Animated.Value(0)).current;
  const cameraScale = useRef(new Animated.Value(1)).current;
  const rollDegrees = useRef(new Animated.Value(0)).current;
  const smokeExpansion = useRef(new Animated.Value(0)).current;
  const smokeRotation = useRef(
    new Animated.Value(NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingRotationStartDeg),
  ).current;
  const hazeOpacity = useRef(new Animated.Value(0)).current;
  const whiteBloomOpacity = useRef(new Animated.Value(0)).current;

  const smokeFrame0 = useRef(new Animated.Value(1)).current;
  const smokeFrame1 = useRef(new Animated.Value(0)).current;
  const smokeFrame2 = useRef(new Animated.Value(0)).current;
  const smokeFrame3 = useRef(new Animated.Value(0)).current;
  const smokeFrameOpacities = useMemo(
    () => [smokeFrame0, smokeFrame1, smokeFrame2, smokeFrame3],
    [smokeFrame0, smokeFrame1, smokeFrame2, smokeFrame3],
  );

  const frameLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const runStartedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onFlightVolumeToRef = useRef(onFlightVolumeTo);

  // Callbacks are read from refs so a parent re-render cannot restart the act.
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFlightVolumeToRef.current = onFlightVolumeTo;
  }, [onComplete, onFlightVolumeTo]);

  // The existing side-view image's visible width is the calibration reference.
  // Every perspective view is scaled to this same visible cross-section width.
  // Its visible height therefore naturally reduces as the axis turns towards
  // the camera (30 -> 60 -> 75 -> 90). This is preferable to squashing each PNG.
  const sideFrame = ROCKET_FRAMES[0];
  const sideVisibleWidthRatio =
    (sideFrame.alphaRight - sideFrame.alphaLeft) / sideFrame.sourceWidth;
  const projectedRocketWidth =
    rocketWidth * initialRocketScale * sideVisibleWidthRatio;

  // At maximum approach, let the front-facing rocket exceed the viewport edge.
  const finalRocketCoverage = Math.max(
    canvasWidth * NUKE_MY_BACKLOG_ACT3_TUNING.approachFinalCoverageWidthRatio,
    canvasHeight * NUKE_MY_BACKLOG_ACT3_TUNING.approachFinalCoverageHeightRatio,
  );
  const finalCameraScale = Math.max(
    1.05,
    finalRocketCoverage / Math.max(1, projectedRocketWidth),
  );

  // The smoke ring begins wider than the rocket, then grows beyond the viewport.
  const smokeRingBaseWidth =
    projectedRocketWidth *
    NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingVisibleWidthMultiplier;
  const finalSmokeCoverage = Math.max(
    canvasWidth * NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingFinalCoverageWidthRatio,
    canvasHeight *
      NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingFinalCoverageHeightRatio,
  );
  const finalSmokeScale = Math.max(
    1.2,
    finalSmokeCoverage / Math.max(1, smokeRingBaseWidth),
  );

  // -------------------------------------------------------------------------
  // OPACITY CURVES — PERSPECTIVE ASSET CROSS-FADE
  // -------------------------------------------------------------------------
  // There is deliberate overlap around every cut. This avoids a one-frame gap
  // and makes the different authored angles read as one continuous pitch.
  const rocketOpacities = [
    pitchProgress.interpolate({
      inputRange: [0, 0.045, 0.125, 0.19],
      outputRange: [1, 1, 0.55, 0],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.035, 0.12, 0.235, 0.34],
      outputRange: [0, 1, 1, 0],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.18, 0.34, 0.49, 0.62],
      outputRange: [0, 1, 1, 0],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.43, 0.59, 0.73, 0.86],
      outputRange: [0, 1, 1, 0],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.68, 0.84, 1],
      outputRange: [0, 1, 1],
      extrapolate: "clamp",
    }),
  ];

  const transitionSmokeOpacities = [
    pitchProgress.interpolate({
      inputRange: [0.045, 0.13, 0.29],
      outputRange: [
        0,
        NUKE_MY_BACKLOG_ACT3_TUNING.transitionSmokePeakOpacity,
        0,
      ],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.23, 0.43, 0.63, 0.76],
      outputRange: [0, 0.9, 0.86, 0],
      extrapolate: "clamp",
    }),
    pitchProgress.interpolate({
      inputRange: [0.48, 0.69, 0.87],
      outputRange: [0, 0.88, 0],
      extrapolate: "clamp",
    }),
  ];

  const smokeRingOpacity = pitchProgress.interpolate({
    inputRange: [0.62, 0.78, 0.94, 1],
    outputRange: [
      0,
      0.72,
      NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingOpacity,
      NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingOpacity,
    ],
    extrapolate: "clamp",
  });

  /* const smokeRingScale = smokeExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, finalSmokeScale],
    extrapolate: "clamp",
  }); */
  // The smoke ring now follows the EXACT same camera progress as the rocket.
  //
  // This guarantees that:
  // - Smoke doesn't expand ahead of the rocket.
  // - Smoke and rocket start moving at the same time.
  // - Their acceleration/deceleration curves remain synchronized.
  // - Changing approachZoomDurationMs automatically changes both.
  //
  // 0.88 = initial ring scale.
  // finalSmokeScale = final cloud coverage.
  //
  // Do not animate smokeExpansion to control this scale anymore.
  const smokeRingScale = cameraScale.interpolate({
    inputRange: [1, finalCameraScale],
    outputRange: [0.88, finalSmokeScale],
    extrapolate: "clamp",
  });

  const hazePeak = NUKE_MY_BACKLOG_ACT3_TUNING.atmosphericHazeMaximumOpacity;
  const rayOpacity = smokeExpansion.interpolate({
    inputRange: [0, 0.18, 0.65, 1],
    outputRange: [0, 0.06, NUKE_MY_BACKLOG_ACT3_TUNING.radialRayOpacity, 0.04],
    extrapolate: "clamp",
  });

  // Pre-compute image positions. The rocket centre remains fixed while the
  // visible projected length changes across the four authored perspective PNGs.
  const rocketLayouts = useMemo(
    () =>
      ROCKET_FRAMES.map((frame) =>
        getCentredSpriteLayout(frame, centreX, centreY, projectedRocketWidth),
      ),
    [centreX, centreY, projectedRocketWidth],
  );

  const transitionSmokeLayouts = useMemo(
    () =>
      TRANSITION_SMOKE.map((frame, index) => {
        const multiplier = [
          NUKE_MY_BACKLOG_ACT3_TUNING.smoke30VisibleWidthMultiplier,
          NUKE_MY_BACKLOG_ACT3_TUNING.smoke60VisibleWidthMultiplier,
          NUKE_MY_BACKLOG_ACT3_TUNING.smoke75VisibleWidthMultiplier,
        ][index];
        return getCentredSpriteLayout(
          frame,
          centreX,
          centreY,
          projectedRocketWidth * multiplier,
        );
      }),
    [centreX, centreY, projectedRocketWidth],
  );

  const smokeRingLayouts = useMemo(
    () =>
      SMOKE_RING_FRAMES.map((frame) =>
        getCentredSpriteLayout(frame, centreX, centreY, smokeRingBaseWidth),
      ),
    [centreX, centreY, smokeRingBaseWidth],
  );

  const smokeRingOffsetX =
    canvasWidth * NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingOffsetXRatio;

  const smokeRingOffsetY =
    canvasHeight * NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingOffsetYRatio;

  // -------------------------------------------------------------------------
  // ACT 3 RUNNER
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!active || runStartedRef.current) return;
    runStartedRef.current = true;

    // Reset every value before starting. This makes a cancelled/reopened session
    // deterministic, rather than inheriting the previous camera pose.
    pitchProgress.setValue(0);
    cameraScale.setValue(1);
    rollDegrees.setValue(0);
    smokeExpansion.setValue(0);
    smokeRotation.setValue(
      NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingRotationStartDeg,
    );
    hazeOpacity.setValue(0);
    whiteBloomOpacity.setValue(0);
    smokeFrameOpacities.forEach((value, index) =>
      value.setValue(index === 0 ? 1 : 0),
    );

    const frameSwap = (fromIndex: number, toIndex: number) =>
      Animated.parallel([
        Animated.timing(smokeFrameOpacities[fromIndex], {
          toValue: 0,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingFrameCrossFadeMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(smokeFrameOpacities[toIndex], {
          toValue: 1,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingFrameCrossFadeMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    const frameLoop = Animated.loop(
      Animated.sequence([
        frameSwap(0, 1),
        frameSwap(1, 2),
        frameSwap(2, 3),
        frameSwap(3, 0),
      ]),
    );

    frameLoopRef.current = frameLoop;

    const turnDuration = NUKE_MY_BACKLOG_ACT3_TUNING.perspectiveTurnDurationMs;

    // CHAPTER 3.1 — Immediate pitch. No pause after Act 2's centre handoff.
    Animated.timing(pitchProgress, {
      toValue: 1,
      duration: turnDuration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;

      // CHAPTER 3.2 — The head-on smoke ring begins cycling as the 90° view lands.
      frameLoop.start();

      // CHAPTER 3.3 — Camera approach. Fade the *existing* thrust loop to the
      // Expo Audio maximum; do not create/restart another player.
      onFlightVolumeToRef.current?.(
        NUKE_MY_BACKLOG_ACT3_TUNING.approachFlightVolume,
        NUKE_MY_BACKLOG_ACT3_TUNING.approachFlightVolumeFadeMs,
      );

      const rollSequence = Animated.sequence([
        // LEFT: -30°. Easing.out means the first part turns quickly and the
        // last part eases into the final -30° pose.
        Animated.timing(rollDegrees, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.rollLeftAngleDeg,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.rollLeftDurationMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // RIGHT: -30° -> +60°. Start gently, building rotation through the sweep.
        Animated.timing(rollDegrees, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.rollRightSlowEndAngleDeg,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.rollRightSlowDurationMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // FINAL RIGHTWARD 30°: deliberately sharp and fast.
        Animated.timing(rollDegrees, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.rollRightFastEndAngleDeg,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.rollRightFastDurationMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      // One shared timing configuration for the entire camera approach.
      const approachDurationMs =
        NUKE_MY_BACKLOG_ACT3_TUNING.approachZoomDurationMs;

      const approachEasing =
        NUKE_MY_BACKLOG_ACT3_TUNING.approachZoomEasing === "inCubic"
          ? Easing.in(Easing.cubic)
          : Easing.inOut(Easing.cubic);

      Animated.parallel([
        Animated.timing(cameraScale, {
          toValue: finalCameraScale,
          /*  duration: NUKE_MY_BACKLOG_ACT3_TUNING.approachZoomDurationMs,
          easing:
            NUKE_MY_BACKLOG_ACT3_TUNING.approachZoomEasing === "inCubic"
              ? Easing.in(Easing.cubic)
              : Easing.inOut(Easing.cubic), */
          duration: approachDurationMs,
          easing: approachEasing,
          useNativeDriver: true,
        }),
        Animated.timing(smokeExpansion, {
          toValue: 1,
          /* duration: NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingExpandDurationMs,
          easing: Easing.out(Easing.cubic), */
          duration: approachDurationMs,
          easing: approachEasing,
          useNativeDriver: true,
        }),
        Animated.timing(smokeRotation, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingRotationEndDeg,
          /*  duration: NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingExpandDurationMs,
          easing: Easing.inOut(Easing.quad), */
          duration: approachDurationMs,
          easing: approachEasing,
          useNativeDriver: true,
        }),
        Animated.timing(hazeOpacity, {
          toValue: hazePeak,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.approachZoomDurationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        rollSequence,
      ]).start(({ finished: approachFinished }) => {
        if (!approachFinished) return;

        // CHAPTER 3.4 — Gentle bloom at the very end. It is intentionally not
        // a full white-out; the next act can take over the large front view.
        Animated.timing(whiteBloomOpacity, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.finalWhiteBloomMaximumOpacity,
          duration: NUKE_MY_BACKLOG_ACT3_TUNING.finalWhiteBloomDurationMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: bloomFinished }) => {
          if (!bloomFinished) return;
          onCompleteRef.current?.();
        });
      });
    });

    return () => {
      pitchProgress.stopAnimation();
      cameraScale.stopAnimation();
      rollDegrees.stopAnimation();
      smokeExpansion.stopAnimation();
      smokeRotation.stopAnimation();
      hazeOpacity.stopAnimation();
      whiteBloomOpacity.stopAnimation();
      smokeFrameOpacities.forEach((value) => value.stopAnimation());
      frameLoop.stop();
      frameLoopRef.current = null;
      runStartedRef.current = false;
    };
  }, [
    active,
    cameraScale,
    finalCameraScale,
    frameLoopRef,
    hazeOpacity,
    hazePeak,
    onCompleteRef,
    onFlightVolumeToRef,
    pitchProgress,
    rollDegrees,
    smokeExpansion,
    smokeFrameOpacities,
    smokeRotation,
    whiteBloomOpacity,
  ]);

  const rocketRoll = rollDegrees.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
    extrapolate: "clamp",
  });
  const smokeRotationString = smokeRotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
    extrapolate: "clamp",
  });

  // Subtle radial rays are generated in code, so they can respond to zoom speed.
  const radialRayAngles = useMemo(
    () =>
      Array.from(
        { length: NUKE_MY_BACKLOG_ACT3_TUNING.radialRayCount },
        (_, index) =>
          (360 / NUKE_MY_BACKLOG_ACT3_TUNING.radialRayCount) * index,
      ),
    [],
  );
  const rayLength = Math.hypot(canvasWidth, canvasHeight) * 1.12;

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFillObject}
    >
      {/* CHAPTER 3.2 — Transitional smoke follows the changing perspective. */}
      <Animated.View style={StyleSheet.absoluteFillObject}>
        {TRANSITION_SMOKE.map((frame, index) => (
          <Animated.Image
            key={`act3-transition-smoke-${index}`}
            source={frame.source}
            resizeMode="stretch"
            fadeDuration={0}
            style={[
              transitionSmokeLayouts[index],
              { opacity: transitionSmokeOpacities[index] },
            ]}
          />
        ))}
      </Animated.View>

      {/* CHAPTER 3.3 — Animated 90° cloud ring. It is rendered BEFORE the rocket. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              { translateX: smokeRingOffsetX },
              { translateY: smokeRingOffsetY },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: smokeRingOpacity,
              transform: [
                { scale: smokeRingScale },
                { rotate: smokeRotationString },
              ],
            },
          ]}
        >
          {SMOKE_RING_FRAMES.map((frame, index) => (
            <Animated.Image
              key={`act3-smoke-ring-${index}`}
              source={frame.source}
              resizeMode="stretch"
              fadeDuration={0}
              style={[
                smokeRingLayouts[index],
                { opacity: smokeFrameOpacities[index] },
              ]}
            />
          ))}
        </Animated.View>
      </Animated.View>

      {/* CHAPTER 3.4 — Radial streaks. These are few, lightweight code shapes;
          they complement the smoke instead of replacing the existing Act 1 streaks. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { opacity: rayOpacity }]}
      >
        {radialRayAngles.map((angle, index) => (
          <View
            key={`act3-ray-${index}`}
            style={{
              position: "absolute",
              left: centreX - (index % 3 === 0 ? 1.15 : 0.65),
              top: centreY - rayLength / 2,
              width: index % 3 === 0 ? 2.3 : 1.3,
              height: rayLength,
              borderRadius: 2,
              backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#DDEEFF",
              opacity: index % 3 === 0 ? 0.82 : 0.46,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        ))}
      </Animated.View>

      {/* CHAPTER 3.5 — Rocket perspective stack.
          The smoke ring is behind this entire layer, so the nose overlaps its centre. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{ scale: cameraScale }, { rotate: rocketRoll }],
          },
        ]}
      >
        {ROCKET_FRAMES.map((frame, index) => (
          <Animated.Image
            key={`act3-rocket-view-${index}`}
            source={frame.source}
            resizeMode="stretch"
            fadeDuration={0}
            style={[rocketLayouts[index], { opacity: rocketOpacities[index] }]}
          />
        ))}
      </Animated.View>

      {/* CHAPTER 3.6 — Soft atmospheric veil / final bloom. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: "#EAF5FF",
            opacity: hazeOpacity,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: "#FFFFFF",
            opacity: whiteBloomOpacity,
          },
        ]}
      />
    </View>
  );
}
