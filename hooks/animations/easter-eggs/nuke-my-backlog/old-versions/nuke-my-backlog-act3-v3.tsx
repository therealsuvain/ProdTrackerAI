import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 *   3.1  Pitches the rocket through twelve authored views from 0° to 90°.
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

// The new 12-view perspective sequence, in order from 0° through 90°.
// rocket.png remains the established Act 0–2 side-view frame (0°).
const rocket07_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_07.5.png");
const rocket15 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_15.png");
const rocket22_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_22.5.png");
const rocket30 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_30.png");
const rocket37_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_37.5.png");
const rocket45 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_45.png");
const rocket52_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_52.5.png");
const rocket60 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_60.png");
const rocket67_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_67.5.png");
const rocket82_5 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_82.5.png");
const rocket90 = require("@/assets/easter-eggs/nuke-backlog-assets/act3/rocket_90.png");

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

// Existing Act 1 exhaust frames are reused during the beginning of the pitch.
// They foreshorten towards the camera axis and fade behind the rocket by ~37.5°.
const flame1 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_1.png");
const flame2 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_2.png");
const flame3 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_3.png");
const flame4 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_4.png");
const flame5 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_5.png");

// ---------------------------------------------------------------------------
// TUNING — CHANGE THESE VALUES FIRST
// ---------------------------------------------------------------------------
// All timings are milliseconds. Angles are degrees. Ratios are screen ratios.
// The named sub-act comments below explain which part each group controls.
export const NUKE_MY_BACKLOG_ACT3_TUNING = {
  // ACT 3.1 — Perspective turn.
  // Increase duration if the switch between generated views feels too sudden.
  perspectiveTurnDurationMs: 1250, //1250, //1560,
  perspectiveCrossFadeSoftness: 0, //0.075,

  // ACT 3.1 — Preserve forward momentum while the rocket pitches.
  // The forward surge starts quickly, then eases off as the rocket faces camera.
  // Increase these ratios for more visible travel; keep them subtle initially.
  pitchForwardTravelXRatio: 0.01, //0.004,
  pitchForwardTravelYRatio: 0.075, //0.055,
  pitchForwardScale: 1.08,
  pitchForwardEasing: "outQuad" as "outQuad" | "outCubic",

  // ACT 3.1 — Exhaust perspective.
  // The flame remains visible through frames 4–5 (30°–37.5°),
  // then foreshortens into depth and fades behind the body.
  pitchFlameVisibleWidthRatio: 0.6,
  pitchFlameFadeStartProgress: 0.31,
  pitchFlameFadeEndProgress: 1, // 0.455,
  pitchFlameEndScaleY: 0.14,
  pitchFlameEndRotateXDeg: 76,
  pitchFlameBaseOverlapDp: 4,
  pitchFlameFrameIntervalMs: 250, //92,

  // ACT 3.2 — The head-on smoke ring rotates from edge-on to face-on
  // in the same pitch, rather than simply fading in as a flat circle.
  smokeRingStartPitchXDeg: 82,
  smokeRingPerspectiveDp: 1100,

  // ACT 3.2 — Transition smoke.
  smoke30VisibleWidthMultiplier: 1.5, //2.10,
  smoke60VisibleWidthMultiplier: 1.5, //4.15,
  smoke75VisibleWidthMultiplier: 0.5, //3.20,
  transitionSmokePeakOpacity: 0.82,
  // The transitional plume sprites are shallow 3D planes, not flat overlays.
  // These are intentionally restrained because each sprite already contains perspective artwork.
  transitionSmokePitchAnglesDeg: [12, 22, 30] as [number, number, number],
  transitionSmokePlaneScaleY: [0.98, 0.93, 0.86] as [number, number, number],

  // ACT 3.3 — 90-degree smoke ring.
  /*   smokeRingVisibleWidthMultiplier: 1.25, // 3.55,
  smokeRingFinalCoverageWidthRatio: 1.0, //1.48,
  smokeRingFinalCoverageHeightRatio: 1.0, //1.42, */
  // The smoke starts wider around the nose-facing rocket.
  smokeRingVisibleWidthMultiplier: 1.55,

  // The final smoke formation also extends further beyond the viewport.
  smokeRingFinalCoverageWidthRatio: 1.12,
  smokeRingFinalCoverageHeightRatio: 1.1,
  smokeRingOpacity: 0.94,
  smokeRingFrameCrossFadeMs: 310,
  smokeRingRotationStartDeg: -3,
  smokeRingRotationEndDeg: 7,
  smokeRingExpandDurationMs: 10000, // 3650,
  // ACT 3.3 — Smoke ring positioning.
  // Negative X moves the smoke left; positive X moves it right.
  smokeRingOffsetXRatio: -0.01, //-0.015,
  smokeRingOffsetYRatio: 0,
  smokeFollowPivotStrength: 1.0,

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
  // ACT 3.5B — Continued micro-rotations during camera approach.
  // These are absolute Z rotation angles, not relative offsets.
  // They oscillate around the final 90° pose.
  //
  // Smaller angle differences = more subtle movement.
  // Shorter durations = quicker rotations.
  // ACT 3.5B — Secondary rotations relative to the main 90° pose.
  //
  // IMPORTANT:
  // The first and last values MUST remain 0.
  // This makes every loop begin and end at exactly the same rotation.
  /* approachMicroRollOffsetsDeg: [0, 5, -5, 4, -3, 2, -2, 0] as number[], */
  approachMicroRollOffsetsDeg: [0, 15, -25, 40, -30, 20, -20, 0] as number[],

  approachMicroRollDurationsMs: [250, 480, 760, 560, 840, 640, 780] as number[],

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

// The generated set intentionally contains no 75° image; keep the actual
// 67.5°→82.5° gap non-uniform so the turn does not double its angular speed there.
const ROCKET_FRAME_ANGLES_DEG = [
  0, 7.5, 15, 22.5, 30, 37.5, 45, 52.5, 60, 67.5, 82.5, 90,
] as const;

const ROCKET_FRAMES: SpriteFrame[] = [
  // 0° — original Act 0–2 rocket.png.
  {
    source: rocketSide,
    sourceWidth: 654,
    sourceHeight: 1912,
    alphaLeft: 8,
    alphaTop: 31,
    alphaRight: 644,
    alphaBottom: 1912,
  },
  // 7.5°
  {
    source: rocket07_5,
    sourceWidth: 711,
    sourceHeight: 2048,
    alphaLeft: 36,
    alphaTop: 46,
    alphaRight: 670,
    alphaBottom: 1967,
  },
  // 15°
  {
    source: rocket15,
    sourceWidth: 685,
    sourceHeight: 1972,
    alphaLeft: 30,
    alphaTop: 83,
    alphaRight: 652,
    alphaBottom: 1938,
  },
  // 22.5°
  {
    source: rocket22_5,
    sourceWidth: 685,
    sourceHeight: 1908,
    alphaLeft: 33,
    alphaTop: 76,
    alphaRight: 664,
    alphaBottom: 1827,
  },
  // 30°
  {
    source: rocket30,
    sourceWidth: 714,
    sourceHeight: 1684,
    alphaLeft: 6,
    alphaTop: 44,
    alphaRight: 692,
    alphaBottom: 1658,
  },
  // 37.5°
  {
    source: rocket37_5,
    sourceWidth: 751,
    sourceHeight: 1491,
    alphaLeft: 25,
    alphaTop: 74,
    alphaRight: 741,
    alphaBottom: 1460,
  },
  // 45°
  {
    source: rocket45,
    sourceWidth: 759,
    sourceHeight: 1587,
    alphaLeft: 19,
    alphaTop: 67,
    alphaRight: 715,
    alphaBottom: 1579,
  },
  // 52.5°
  {
    source: rocket52_5,
    sourceWidth: 809,
    sourceHeight: 1460,
    alphaLeft: 15,
    alphaTop: 115,
    alphaRight: 788,
    alphaBottom: 1436,
  },
  // 60°
  {
    source: rocket60,
    sourceWidth: 780,
    sourceHeight: 1362,
    alphaLeft: 34,
    alphaTop: 73,
    alphaRight: 749,
    alphaBottom: 1246,
  },
  // 67.5°
  {
    source: rocket67_5,
    sourceWidth: 804,
    sourceHeight: 1148,
    alphaLeft: 31,
    alphaTop: 37,
    alphaRight: 758,
    alphaBottom: 1062,
  },
  // 82.5° — the generated sequence has a 15° gap between 67.5° and 82.5°.
  {
    source: rocket82_5,
    sourceWidth: 1203,
    sourceHeight: 1534,
    alphaLeft: 27,
    alphaTop: 40,
    alphaRight: 1190,
    alphaBottom: 1467,
  },
  // 90° — full nose-facing view.
  {
    source: rocket90,
    sourceWidth: 1529,
    sourceHeight: 2048,
    alphaLeft: 28,
    alphaTop: 65,
    alphaRight: 1519,
    alphaBottom: 1830,
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

type FlameFrame = {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  alphaLeft: number;
  alphaTop: number;
  alphaRight: number;
  alphaBottom: number;
};

// These are the same calibrated flame frames already used in Act 1.
const FLAME_FRAMES: FlameFrame[] = [
  {
    source: flame1,
    sourceWidth: 480,
    sourceHeight: 992,
    alphaLeft: 3,
    alphaTop: 3,
    alphaRight: 479,
    alphaBottom: 983,
  },
  {
    source: flame2,
    sourceWidth: 479,
    sourceHeight: 623,
    alphaLeft: 75,
    alphaTop: 22,
    alphaRight: 426,
    alphaBottom: 606,
  },
  {
    source: flame3,
    sourceWidth: 479,
    sourceHeight: 857,
    alphaLeft: 63,
    alphaTop: 50,
    alphaRight: 443,
    alphaBottom: 838,
  },
  {
    source: flame4,
    sourceWidth: 480,
    sourceHeight: 910,
    alphaLeft: 53,
    alphaTop: 33,
    alphaRight: 450,
    alphaBottom: 897,
  },
  {
    source: flame5,
    sourceWidth: 481,
    sourceHeight: 765,
    alphaLeft: 60,
    alphaTop: 50,
    alphaRight: 427,
    alphaBottom: 748,
  },
];

// ACT 3.3 — Rocket optical-centre offsets.
//
// Measured from the supplied PNG alpha distributions.
// Values are normalized against each frame's visible alpha width.
//
// These compensate for the difference between the PNG's visible bounding-box
// centre and the actual visual mass centre.
//
// This is what makes the smoke follow the rocket's apparent movement
// when it rotates around the image/container centre.

const ROCKET_OPTICAL_OFFSET_X_RATIO = [
  0.000157, -0.000631, 0.002572, 0.013471, 0.000729, 0.007273, 0.006034,
  0.000906, 0.006993, 0.00055, 0.001377, 0.000604,
];

const ROCKET_OPTICAL_OFFSET_Y_RATIO = [
  0.184724, 0.180599, 0.079421, -0.011569, 0.003353, -0.092308, 0.017098,
  -0.060414, 0.124615, 0.161898, 0.104733, 0.118536,
];

// Lookup table for smooth rotation of the optical-centre offset.
// Covers the existing -30° to +90° rotation and the new micro-rotations.
const ROCKET_ROLL_PIVOT_ANGLES = Array.from(
  { length: 29 },
  (_, index) => -40 + index * 5,
);

const FLAME_FRAME_SEQUENCE = [0, 1, 2, 3, 4, 3, 2, 1] as const;

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
  /** Fires after every Act 3 rocket/smoke/exhaust PNG has loaded or failed. */
  onAssetsReady?: () => void;
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
  onAssetsReady,
  onComplete,
}: Props) {
  // Every animation value is stable across renders. The parent hook keeps this
  // component mounted until the overall Easter egg is cancelled or completed.
  const pitchProgress = useRef(new Animated.Value(0)).current;
  const [rocketFrameIndex, setRocketFrameIndex] = useState(0);
  // Separate forward-motion progress prevents the rocket from looking parked
  // while its perspective frames are changing.
  const pitchForwardProgress = useRef(new Animated.Value(0)).current;
  const smokeRingPitchX = useRef(
    new Animated.Value(NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingStartPitchXDeg),
  ).current;
  const [flameFrameIndex, setFlameFrameIndex] = useState(0);
  const [pitchFlameVisible, setPitchFlameVisible] = useState(true);
  const cameraScale = useRef(new Animated.Value(1)).current;
  const rollDegrees = useRef(new Animated.Value(0)).current;
  // Independent secondary rotation.
  // This is an offset added to the main rotation, NOT an absolute angle.
  const approachMicroRollDegrees = useRef(new Animated.Value(0)).current;

  // Both rotations are combined for the actual rocket transform.
  const combinedRocketRollDegrees = Animated.add(
    rollDegrees,
    approachMicroRollDegrees,
  );
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
  const postApproachRollLoopRef = useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const runStartedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onFlightVolumeToRef = useRef(onFlightVolumeTo);
  const onAssetsReadyRef = useRef(onAssetsReady);
  const loadedAssetKeysRef = useRef<Set<string>>(new Set());
  const assetsReadyReportedRef = useRef(false);

  // Callbacks are read from refs so a parent re-render cannot restart the act.
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFlightVolumeToRef.current = onFlightVolumeTo;
    onAssetsReadyRef.current = onAssetsReady;
  }, [onComplete, onFlightVolumeTo, onAssetsReady]);

  // Act 3 is mounted invisibly as soon as the rocket is measured. Keep every
  // perspective/smoke sprite mounted during Acts 0–2 so native image decoding
  // happens well before the camera handoff. `onError` also counts as settled so
  // a bad/missing optional sprite cannot deadlock the main animation.
  const handleAssetSettled = useCallback((assetKey: string) => {
    if (assetsReadyReportedRef.current) return;
    loadedAssetKeysRef.current.add(assetKey);

    const expectedAssetCount =
      ROCKET_FRAMES.length +
      TRANSITION_SMOKE.length +
      SMOKE_RING_FRAMES.length +
      FLAME_FRAMES.length;

    if (loadedAssetKeysRef.current.size >= expectedAssetCount) {
      assetsReadyReportedRef.current = true;
      onAssetsReadyRef.current?.();
    }
  }, []);

  // The existing side-view image's visible width is the calibration reference.
  // Every perspective view is calibrated to the same projected cross-section
  // width using its own visible alpha bounds. The increasingly head-on artwork
  // therefore becomes shorter in projection without stretching/squashing PNGs.
  const sideFrame = ROCKET_FRAMES[0];
  const sideVisibleWidthRatio =
    (sideFrame.alphaRight - sideFrame.alphaLeft) / sideFrame.sourceWidth;
  const projectedRocketWidth =
    rocketWidth * initialRocketScale * sideVisibleWidthRatio;

  // ACT 3.1 — Motion continues during the turn.
  // Easing is applied to this separate progress value so the rocket surges
  // forward immediately, then coasts into the camera-facing pose.
  const pitchTravelX = pitchForwardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0,
      canvasWidth * NUKE_MY_BACKLOG_ACT3_TUNING.pitchForwardTravelXRatio,
    ],
    extrapolate: "clamp",
  });
  const pitchTravelY = pitchForwardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      0,
      -canvasHeight * NUKE_MY_BACKLOG_ACT3_TUNING.pitchForwardTravelYRatio,
    ],
    extrapolate: "clamp",
  });
  const pitchForwardScale = pitchForwardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, NUKE_MY_BACKLOG_ACT3_TUNING.pitchForwardScale],
    extrapolate: "clamp",
  });

  // Optical centre movement during the 12-view perspective transition.
  // As the visible rocket changes, this offset follows its actual artwork.

  const rocketOpticalOffsetX = pitchProgress.interpolate({
    inputRange: ROCKET_FRAME_ANGLES_DEG.map((angle) => angle / 90),
    outputRange: ROCKET_OPTICAL_OFFSET_X_RATIO.map(
      (ratio) =>
        ratio *
        projectedRocketWidth *
        NUKE_MY_BACKLOG_ACT3_TUNING.smokeFollowPivotStrength,
    ),
    extrapolate: "clamp",
  });

  const rocketOpticalOffsetY = pitchProgress.interpolate({
    inputRange: ROCKET_FRAME_ANGLES_DEG.map((angle) => angle / 90),
    outputRange: ROCKET_OPTICAL_OFFSET_Y_RATIO.map(
      (ratio) =>
        ratio *
        projectedRocketWidth *
        NUKE_MY_BACKLOG_ACT3_TUNING.smokeFollowPivotStrength,
    ),
    extrapolate: "clamp",
  });

  // Rotation is used only to calculate the new position of the optical centre.
  // We do NOT rotate the smoke texture itself.

  const rollCos = combinedRocketRollDegrees.interpolate({
    inputRange: ROCKET_ROLL_PIVOT_ANGLES,
    outputRange: ROCKET_ROLL_PIVOT_ANGLES.map((angle) =>
      Math.cos((angle * Math.PI) / 180),
    ),
    extrapolate: "clamp",
  });

  const rollSin = combinedRocketRollDegrees.interpolate({
    inputRange: ROCKET_ROLL_PIVOT_ANGLES,
    outputRange: ROCKET_ROLL_PIVOT_ANGLES.map((angle) =>
      Math.sin((angle * Math.PI) / 180),
    ),
    extrapolate: "clamp",
  });

  // Rotate the rocket's visual-centre offset around the same pivot.
  const rotatedOpticalOffsetX = Animated.subtract(
    Animated.multiply(rocketOpticalOffsetX, rollCos),
    Animated.multiply(rocketOpticalOffsetY, rollSin),
  );

  const rotatedOpticalOffsetY = Animated.add(
    Animated.multiply(rocketOpticalOffsetX, rollSin),
    Animated.multiply(rocketOpticalOffsetY, rollCos),
  );

  // The optical offset must grow along with the rocket.
  const smokeFollowOffsetX = Animated.multiply(
    Animated.multiply(rotatedOpticalOffsetX, pitchForwardScale),
    cameraScale,
  );

  const smokeFollowOffsetY = Animated.multiply(
    Animated.multiply(rotatedOpticalOffsetY, pitchForwardScale),
    cameraScale,
  );

  // The exhaust starts attached to the 0° engine anchor, then converges
  // towards the projection centre as it turns behind the rocket.
  const sidePixelScale =
    projectedRocketWidth /
    Math.max(1, sideFrame.alphaRight - sideFrame.alphaLeft);
  const sideAlphaCentreX = (sideFrame.alphaLeft + sideFrame.alphaRight) / 2;
  const sideAlphaCentreY = (sideFrame.alphaTop + sideFrame.alphaBottom) / 2;
  const sideImageLeft = centreX - sideAlphaCentreX * sidePixelScale;
  const sideImageTop = centreY - sideAlphaCentreY * sidePixelScale;
  const initialExhaustX = sideImageLeft + 327 * sidePixelScale;
  const initialExhaustY = sideImageTop + 1842 * sidePixelScale;

  const flameVisibleWidth =
    projectedRocketWidth *
    NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameVisibleWidthRatio;
  const flameLayouts = useMemo(
    () =>
      FLAME_FRAMES.map((frame) => {
        const visibleWidth = frame.alphaRight - frame.alphaLeft;
        const scale = flameVisibleWidth / Math.max(1, visibleWidth);
        const alphaCentreX = (frame.alphaLeft + frame.alphaRight) / 2;
        const flippedBaseOffsetY = frame.sourceHeight - frame.alphaBottom;
        return {
          position: "absolute" as const,
          left: initialExhaustX - alphaCentreX * scale,
          top:
            initialExhaustY -
            flippedBaseOffsetY * scale -
            NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameBaseOverlapDp,
          width: frame.sourceWidth * scale,
          height: frame.sourceHeight * scale,
        };
      }),
    [flameVisibleWidth, initialExhaustX, initialExhaustY],
  );

  const flameShiftX = pitchProgress.interpolate({
    inputRange: [0, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress],
    outputRange: [0, centreX - initialExhaustX],
    extrapolate: "clamp",
  });
  const flameShiftY = pitchProgress.interpolate({
    inputRange: [0, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress],
    outputRange: [0, centreY + projectedRocketWidth * 0.08 - initialExhaustY],
    extrapolate: "clamp",
  });
  const flameOpacity = pitchProgress.interpolate({
    inputRange: [
      0,
      NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeStartProgress,
      NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress,
      Math.min(
        1,
        NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress + 0.035,
      ),
    ],
    outputRange: [1, 1, 0.12, 0],
    extrapolate: "clamp",
  });
  /*  const flameOpacity = pitchProgress.interpolate({
    inputRange: [
      0,
      NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeStartProgress,
      NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress,
    ],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  }); */
  const flamePitchRotateX = pitchProgress.interpolate({
    inputRange: [0, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress],
    outputRange: [
      "0deg",
      `${NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameEndRotateXDeg}deg`,
    ],
    extrapolate: "clamp",
  });
  const flamePerspectiveScaleY = pitchProgress.interpolate({
    inputRange: [0, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress],
    outputRange: [1, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameEndScaleY],
    extrapolate: "clamp",
  });
  const smokeRingPitchXString = smokeRingPitchX.interpolate({
    inputRange: [0, 90],
    outputRange: ["0deg", "90deg"],
    extrapolate: "clamp",
  });

  // At maximum approach, let the front-facing rocket exceed the viewport edge.
  const finalRocketCoverage = Math.max(
    canvasWidth * NUKE_MY_BACKLOG_ACT3_TUNING.approachFinalCoverageWidthRatio,
    canvasHeight * NUKE_MY_BACKLOG_ACT3_TUNING.approachFinalCoverageHeightRatio,
  );
  const finalCameraScale = Math.max(
    1.05,
    finalRocketCoverage /
      Math.max(
        1,
        projectedRocketWidth * NUKE_MY_BACKLOG_ACT3_TUNING.pitchForwardScale,
      ),
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
  // OPACITY CURVES — 12 VIEW PERSPECTIVE CROSS-FADE
  // -------------------------------------------------------------------------
  // Every generated angle is one evenly spaced stop in the 0°→90° turn.
  // Adjacent views overlap so the rocket never disappears between frames.
  // `perspectiveCrossFadeSoftness` widens the blend window without changing
  // the overall turn duration.
  /* const rocketOpacities = useMemo(() => {
    const lastIndex = ROCKET_FRAMES.length - 1;
    const softness = Math.max(
      0,
      NUKE_MY_BACKLOG_ACT3_TUNING.perspectiveCrossFadeSoftness,
    );
    const centres = ROCKET_FRAME_ANGLES_DEG.map((angle) => angle / 90);

    return ROCKET_FRAMES.map((_, index) => {
      const centre = centres[index];
      const previous = centres[Math.max(0, index - 1)];
      const next = centres[Math.min(lastIndex, index + 1)];
      const left = Math.max(0, centre - (centre - previous) * (1 + softness));
      const right = Math.min(1, centre + (next - centre) * (1 + softness));

      if (index === 0) {
        return pitchProgress.interpolate({
          inputRange: [0, right],
          outputRange: [1, 0],
          extrapolate: "clamp",
        });
      }

      if (index === lastIndex) {
        return pitchProgress.interpolate({
          inputRange: [left, 1],
          outputRange: [0, 1],
          extrapolate: "clamp",
        });
      }

      return pitchProgress.interpolate({
        inputRange: [left, centre, right],
        outputRange: [0, 1, 0],
        extrapolate: "clamp",
      });
    });
  }, [pitchProgress]); */

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
    // It begins as a faint, nearly edge-on ellipse, then becomes a full ring
    // as the rocket completes its turn towards the camera.
    inputRange: [0.36, 0.58, 0.82, 1],
    outputRange: [
      0,
      0.48,
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

  // Pre-compute image positions from each PNG's alpha bounds. All twelve visible
  // silhouettes share one optical centre while their projected lengths change.
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
  // ACT 3.1 — EXHAUST FRAME CYCLING
  // -------------------------------------------------------------------------
  // Reuse the five existing Act 1 flame drawings only while the rocket is
  // turning away from the side view. The opacity/perspective curves below
  // shorten and hide the plume by the 30°–37.5° frames.
  useEffect(() => {
    if (!active) return;
    setPitchFlameVisible(true);
    let sequenceStep = 0;
    setFlameFrameIndex(FLAME_FRAME_SEQUENCE[0]);

    const frameTimer = setInterval(() => {
      sequenceStep = (sequenceStep + 1) % FLAME_FRAME_SEQUENCE.length;
      setFlameFrameIndex(FLAME_FRAME_SEQUENCE[sequenceStep]);
    }, NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFrameIntervalMs);

    /*  const stopFrameTimer = setTimeout(() => {
      clearInterval(frameTimer);
    }, NUKE_MY_BACKLOG_ACT3_TUNING.perspectiveTurnDurationMs * NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress); */
    const stopFrameTimer = setTimeout(
      () => {
        clearInterval(frameTimer);
        setPitchFlameVisible(false);
      },
      NUKE_MY_BACKLOG_ACT3_TUNING.perspectiveTurnDurationMs *
        (NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameFadeEndProgress + 0.02),
    );

    return () => {
      clearInterval(frameTimer);
      clearTimeout(stopFrameTimer);
    };
  }, [active]);

  // -------------------------------------------------------------------------
  // ACT 3 RUNNER
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!active || runStartedRef.current) return;
    runStartedRef.current = true;

    // Reset every value before starting. This makes a cancelled/reopened session
    // deterministic, rather than inheriting the previous camera pose.
    pitchProgress.setValue(0);
    setRocketFrameIndex(0);

    const rocketFrameListenerId = pitchProgress.addListener(({ value }) => {
      const currentAngle = value * 90;

      let nextIndex = 0;

      for (let index = 1; index < ROCKET_FRAME_ANGLES_DEG.length; index += 1) {
        const switchAngle =
          (ROCKET_FRAME_ANGLES_DEG[index - 1] +
            ROCKET_FRAME_ANGLES_DEG[index]) /
          2;

        if (currentAngle >= switchAngle) {
          nextIndex = index;
        } else {
          break;
        }
      }

      setRocketFrameIndex((current) =>
        current === nextIndex ? current : nextIndex,
      );
    });
    pitchForwardProgress.setValue(0);
    smokeRingPitchX.setValue(
      NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingStartPitchXDeg,
    );
    setFlameFrameIndex(0);
    cameraScale.setValue(1);
    rollDegrees.setValue(0);
    approachMicroRollDegrees.setValue(0);
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
    let approachHasCompleted = false;
    // CHAPTER 3.1 — Immediate pitch WITH forward momentum.
    // The rocket surges upward/forward while the 12 authored perspectives blend.
    // The smoke ring rotates from almost edge-on to face-on during the same move.
    const forwardEasing =
      NUKE_MY_BACKLOG_ACT3_TUNING.pitchForwardEasing === "outCubic"
        ? Easing.out(Easing.cubic)
        : Easing.out(Easing.quad);

    Animated.parallel([
      Animated.timing(pitchProgress, {
        toValue: 1,
        duration: turnDuration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pitchForwardProgress, {
        toValue: 1,
        duration: turnDuration,
        easing: forwardEasing,
        useNativeDriver: true,
      }),
      Animated.timing(smokeRingPitchX, {
        toValue: 0,
        duration: turnDuration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
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
      // The original larger rotation is preserved.
      // When it finishes, smaller rotations continue throughout the zoom.

      /*  const postApproachRollLoop = Animated.loop(
        Animated.sequence(
          NUKE_MY_BACKLOG_ACT3_TUNING.approachMicroRollAnglesDeg.map(
            (angle, index) =>
              Animated.timing(rollDegrees, {
                toValue: angle,
                duration:
                  NUKE_MY_BACKLOG_ACT3_TUNING.approachMicroRollDurationsMs[
                    index
                  ] ?? 650,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
          ),
        ),
      ); */
      // Secondary rotation uses its own offset value.
      // It never changes or resets the main rollDegrees value.
      const postApproachRollLoop = Animated.loop(
        Animated.sequence(
          NUKE_MY_BACKLOG_ACT3_TUNING.approachMicroRollOffsetsDeg.map(
            (offset, index) =>
              Animated.timing(approachMicroRollDegrees, {
                toValue: offset,
                duration:
                  NUKE_MY_BACKLOG_ACT3_TUNING.approachMicroRollDurationsMs[
                    index
                  ],
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
          ),
        ),
        {
          resetBeforeIteration: true,
        },
      );
      rollSequence.start(({ finished }) => {
        if (!finished || approachHasCompleted || !runStartedRef.current) {
          return;
        }

        postApproachRollLoopRef.current = postApproachRollLoop;
        postApproachRollLoop.start();
      });

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
        /*  rollSequence, */
      ]).start(({ finished: approachFinished }) => {
        if (!approachFinished) return;

        Animated.timing(rollDegrees, {
          toValue: NUKE_MY_BACKLOG_ACT3_TUNING.rollRightFastEndAngleDeg,
          duration: 190,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: rollSettled }) => {
          if (!rollSettled) return;

          // Keep your existing final white-bloom animation here.
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
        // CHAPTER 3.4 — Gentle bloom at the very end. It is intentionally not
        // a full white-out; the next act can take over the large front view.
      });
    });

    return () => {
      approachHasCompleted = true;
      postApproachRollLoopRef.current?.stop();
      postApproachRollLoopRef.current = null;
      pitchProgress.stopAnimation();
      pitchForwardProgress.stopAnimation();
      smokeRingPitchX.stopAnimation();
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
      pitchProgress.removeListener(rocketFrameListenerId);
      approachMicroRollDegrees.stopAnimation();
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
    pitchForwardProgress,
    smokeRingPitchX,
    rollDegrees,
    smokeExpansion,
    smokeFrameOpacities,
    smokeRotation,
    whiteBloomOpacity,
  ]);

  /* const rocketRoll = rollDegrees.interpolate({
    inputRange: [-360, 360],
    outputRange: ["-360deg", "360deg"],
    extrapolate: "clamp",
  }); */
  const rocketRoll = combinedRocketRollDegrees.interpolate({
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

  // IMPORTANT: do not return null while inactive. This entire tree stays
  // mounted, invisible and non-interactive during Acts 0–2, allowing all local
  // PNGs to decode before Act 2 hands the screen over to this component.
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      style={[
        StyleSheet.absoluteFillObject,
        { opacity: active ? 1 : 0 },
      ]}
    >
      {/* CHAPTER 3.2 — Transitional smoke follows the rocket's forward motion.
          Each authored plume is given a restrained 3D plane tilt, rather than
          being left as a completely flat screen-space sticker. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              { translateX: pitchTravelX },
              { translateY: pitchTravelY },
              { scale: pitchForwardScale },
            ],
          },
        ]}
      >
        {TRANSITION_SMOKE.map((frame, index) => (
          <Animated.Image
            key={`act3-transition-smoke-${index}`}
            source={frame.source}
            resizeMode="stretch"
            fadeDuration={0}
            onLoad={() => handleAssetSettled(`transition-smoke-${index}`)}
            onError={() => handleAssetSettled(`transition-smoke-${index}`)}
            style={[
              transitionSmokeLayouts[index],
              {
                opacity: transitionSmokeOpacities[index],
                transform: [
                  { perspective: 1200 },
                  {
                    rotateX: `${NUKE_MY_BACKLOG_ACT3_TUNING.transitionSmokePitchAnglesDeg[index]}deg`,
                  },
                  {
                    scaleY:
                      NUKE_MY_BACKLOG_ACT3_TUNING.transitionSmokePlaneScaleY[
                        index
                      ],
                  },
                ],
              },
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
            /* transform: [
              { translateX: pitchTravelX },
              { translateY: pitchTravelY },
              { translateX: smokeRingOffsetX },
              { translateY: smokeRingOffsetY },
            ], */
            transform: [
              { translateX: pitchTravelX },
              { translateY: pitchTravelY },

              // Existing manual ring alignment.
              { translateX: smokeRingOffsetX },
              { translateY: smokeRingOffsetY },

              // Follow the rocket's visual movement around the same pivot.
              { translateX: smokeFollowOffsetX },
              { translateY: smokeFollowOffsetY },
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
                {
                  perspective:
                    NUKE_MY_BACKLOG_ACT3_TUNING.smokeRingPerspectiveDp,
                },
                { rotateX: smokeRingPitchXString },
                { scale: pitchForwardScale },
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
              onLoad={() => handleAssetSettled(`smoke-ring-${index}`)}
              onError={() => handleAssetSettled(`smoke-ring-${index}`)}
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

      {/* CHAPTER 3.5 — ROCKET + EXHAUST PERSPECTIVE STACK.
          The smoke is behind this entire layer; the rocket covers the ring's centre.
          The same forward-motion transform is shared by the exhaust and rocket. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [
              { translateX: pitchTravelX },
              { translateY: pitchTravelY },
              { scale: pitchForwardScale },
              { scale: cameraScale },
              { rotate: rocketRoll },
            ],
          },
        ]}
      >
        {/* CHAPTER 3.5A — Animated exhaust remains attached during the first part
            of the turn, then foreshortens in perspective and disappears behind
            the rocket by the 30°–37.5° views. The 3D transforms are an intentional
            2.5D approximation; no separate 3D model is required. */}
        {pitchFlameVisible && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                transform: [
                  { translateX: flameShiftX },
                  { translateY: flameShiftY },
                ],
              },
            ]}
          >
            {FLAME_FRAMES.map((frame, index) => {
              const imageHeight = flameLayouts[index].height;
              const flameBaseCompensation = flamePerspectiveScaleY.interpolate({
                inputRange: [
                  NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameEndScaleY,
                  1,
                ],
                outputRange: [
                  (imageHeight *
                    (1 - NUKE_MY_BACKLOG_ACT3_TUNING.pitchFlameEndScaleY)) /
                    2,
                  0,
                ],
                extrapolate: "clamp",
              });

              return (
                <Animated.Image
                  key={`act3-exhaust-frame-${index}`}
                  source={frame.source}
                  resizeMode="stretch"
                  fadeDuration={0}
                  onLoad={() => handleAssetSettled(`exhaust-${index}`)}
                  onError={() => handleAssetSettled(`exhaust-${index}`)}
                  style={[
                    flameLayouts[index],
                    {
                      opacity: flameFrameIndex === index ? flameOpacity : 0,
                      zIndex: 0,
                      transform: [
                        // Match Act 1's exhaust orientation first, then rotate its
                        // image plane towards depth as the rocket pitches at camera.
                        { perspective: 900 },
                        { rotateX: flamePitchRotateX },
                        { scaleY: -1 },
                        { scaleY: flamePerspectiveScaleY },
                        { translateY: flameBaseCompensation },
                      ],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
        )}
        {/* CHAPTER 3.5B — Twelve authored rocket views, evenly cross-faded. */}
        {ROCKET_FRAMES.map((frame, index) => (
          <Animated.Image
            key={`act3-rocket-view-${index}`}
            source={frame.source}
            resizeMode="stretch"
            fadeDuration={0}
            onLoad={() => handleAssetSettled(`rocket-view-${index}`)}
            onError={() => handleAssetSettled(`rocket-view-${index}`)}
            style={[
              rocketLayouts[index],
              {
                opacity: rocketFrameIndex === index ? 1 : 0,
                /* opacity: rocketOpacities[index], */ zIndex: 2,
              },
            ]}
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
