import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";
import { useNukeMyBacklogAudio } from "./use-nuke-my-backlog-audio-v6";
import NukeFlightEnvironment from "./nuke-flight-environment";
import NukeLaunchSpeedStreaks from "./nuke-launch-speed-streaks";
import NukeMyBacklogAct3 from "./nuke-my-backlog-act3-v5";

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type NukeAnchor = Rect & {
  rocketWidth: number;
  rocketHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};
type MeasurableRef = React.RefObject<View | null>;
type Phase =
  | "measuring"
  | "pumping"
  | "igniting"
  | "boosting"
  | "launching"
  | "firstOffscreen"
  | "upperReturn"
  | "secondExit"
  | "bottomEntry"
  | "approachReady"
  | "cameraApproach"
  | "cameraApproachComplete"
  | null;

type PressCallbacks = {
  /** Called synchronously on the first accepted press of this pumping session. */
  onFirstPress?: () => void;
  /** Called when the rocket reaches the pre-3D approach position. The run stays active. */
  onApproachReady?: () => void;
  /** Called once when the entire Easter egg is eventually completed or cancelled. */
  onFinished?: () => void;
};

// TEMPORARY ACT 3 DEVELOPMENT TEST.
// Set false to restore the normal Easter egg sequence.
const DEBUG_START_ACT3_DIRECTLY = false;

/**
 * Nuke My Backlog — Act 0: manual rocket pumping.
 *
 * Implements Act 0 (manual pumping), vertical liftoff, a continuous arc-length
 * upper-flight path, layered cloud environment, and the pre-3D Act 2 handoff.
 *
 * Layering mirrors the working Hello There architecture:
 * - Render `behindLayer` AFTER normal search content.
 * - Its transparent viewport ends at the top edge of the Easter egg row.
 * - The row remains independently pressable while pumping is active.
 *
 * Asset expectation:
 *   @/assets/easter-eggs/nuke-backlog-assets/rocket.png
 *   @/assets/easter-eggs/nuke-backlog-assets/flight-scene/*
 */
const rocketAsset = require("@/assets/easter-eggs/nuke-backlog-assets/rocket.png");
const rocketBlur02Asset = require("@/assets/easter-eggs/nuke-backlog-assets/rocket_blur_02.png");
const rocketBlur05Asset = require("@/assets/easter-eggs/nuke-backlog-assets/rocket_blur_05.png");
const rocketBlur08Asset = require("@/assets/easter-eggs/nuke-backlog-assets/rocket_blur_08.png");

const ROCKET_SOURCE_WIDTH = 654;
const ROCKET_SOURCE_HEIGHT = 1912;
const ROCKET_ASPECT_RATIO = ROCKET_SOURCE_HEIGHT / ROCKET_SOURCE_WIDTH;

// Flame artwork is supplied as five independent PNGs in the same asset folder.
// Their visible alpha bounds were measured from the actual supplied files.
const flame1 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_1.png");
const flame2 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_2.png");
const flame3 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_3.png");
const flame4 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_4.png");
const flame5 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_5.png");

type FlameFrame = {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  alphaLeft: number;
  alphaTop: number;
  alphaRight: number;
  alphaBottom: number;
};

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

// A forward-and-back cycle avoids a hard visual reset from the last frame to the first.
const FLAME_FRAME_SEQUENCE = [0, 1, 2, 3, 4, 3, 2, 1] as const;

/**
 * Central tuning surface. Values are dp / ms unless their name says Ratio.
 * Pumping progression is intentionally tuned to reward a quick rhythm while
 * still allowing slower taps to make some progress.
 */
export const NUKE_MY_BACKLOG_TUNING = {
  // Act 0.1 — Rocket composition. Preserve the user's latest calibrated values.
  rocketWidthRatio: 0.15,
  rocketMaxWidth: 112,
  rocketMinWidth: 58,
  rocketHiddenStartOffset: 3,
  rocketHorizontalCenterRatio: 0.5,

  // Act 0.2 — Pump pressure. Preserve the user's latest calibrated values.
  pumpBaseProgressDp: 6,
  pumpPressureProgressDp: 3,
  pressureGainPerTap: 0.2,
  rapidTapPressureBonus: 0.16,
  rapidTapWindowMs: 150,
  pressureDecayMs: 400,
  maxPressure: 1,

  // Act 0.3 — Gravity / recoil. Preserve the user's full-drop idle behaviour.
  progressGraceMs: 50,
  progressGravityDpPerMs: 0.018,
  maxProgressLossPerTapDp: 10000,
  pumpUpstrokeOvershootDp: 1,
  pumpRecoilDp: 0,
  idleRecoilDelayMs: 100,
  // Kept as a reference tuning value; full-return idle sag below currently
  // targets 0 rather than subtracting only this small amount.
  idleSagDp: 1,
  pumpRiseSpringSpeed: 18,
  pumpRiseSpringBounciness: 7,
  pumpRecoilMs: 50,
  idleSagMs: 25,

  // Act 0.4 — Hint. Preserve the user's current instant-hint test configuration.
  hintDelayMs: 0,
  hintVisibleMs: 12000,
  hintMinTapCount: 3,
  hintOnlyBeforeProgressRatio: 0.72,

  // Act 0.5 — Automatic ignition-ready beat.
  ignitionSpringSpeed: 16,
  ignitionSpringBounciness: 4,
  ignitionHoldMs: 700,
  ignitionGlowSize: 38,
  ignitionGlowOpacity: 0.72,
  ignitionGlowPulseMs: 190,

  // Act 1.1 — Flame composition. All five flame PNGs are flipped vertically;
  // each frame's measured transparent bounds are used to keep its base attached
  // to the same rocket exhaust point while preserving its natural aspect ratio.
  rocketExhaustAnchorX: 327,
  rocketExhaustAnchorY: 1842,
  flameVisibleWidthRatio: 0.58,
  flameBaseOverlapDp: 4,
  flameFrameIntervalMs: 92,

  // Act 1.2 — Launch audio / bottom-to-centre ascent.
  // launch.mp3 is ~4.4s; the rocket travels from below the viewport to centre
  // for the duration of that sound, with a restrained high-frequency vibration.
  boostCenterYRatio: 0.48,
  boostCenterMoveMs: 4500,
  boostLaunchVibrationX: 0.3,
  boostLaunchVibrationY: 0.24,
  boostLaunchVibrationRotation: 0.48,

  // Act 1.3 — Stationary high-speed acceleration spectacle.
  // The streak component uses the same acceleration duration (7.245s).
  boostAccelerationMs: 7245,
  boostHoldAfterAccelerationMs: 650,
  boostVibrationX: 0.54,
  boostVibrationY: 0.43,
  boostVibrationRotation: 0.82,
  rocketBlurMaximumPercent: 8,
  cloudRevealDurationMs: 2100,

  // Act 1.4 — Final vertical departure after the speed build-up.
  launchExitDurationMs: 3500, //950,
  launchOffscreenMarginDp: 96,

  // Act 2.1 — Off-screen interval before the high-speed return passes.
  firstOffscreenHoldMs: 4500,
  distantFlightScale: 0.38,

  // Act 2.2 — Three v5-inspired spiral passes at different vertical positions.
  // The final pass is counter-clockwise so its tangent points upward into the exit.
  upperFlightPathDurationMs: 10500, //4200,
  /*   flightLoopRadiusContractRatio: 0.84,
  flightLoop1CenterXRatio: 0.42,
  flightLoop1CenterYRatio: 0.19,
  flightLoop1RadiusXRatio: 0.3,
  flightLoop1RadiusYRatio: 0.105,
  flightLoop1Direction: 1,
  flightLoop2CenterXRatio: 0.61,
  flightLoop2CenterYRatio: 0.48,
  flightLoop2RadiusXRatio: 0.28,
  flightLoop2RadiusYRatio: 0.105,
  flightLoop2Direction: 1,
  flightLoop3CenterXRatio: 0.41,
  flightLoop3CenterYRatio: 0.74,
  flightLoop3RadiusXRatio: 0.29,
  flightLoop3RadiusYRatio: 0.11,
  flightLoop3Direction: -1, */
  flightTopExitMarginDp: 100,
  projectedShadowOffsetX: -20,
  projectedShadowOffsetY: 26,
  projectedShadowOpacity: 0.22,
  projectedShadowBlurRadius: 5,

  // Change to "left" to mirror both continuous spiral passes.
  upperReturnFromSide: "right" as "left" | "right",

  // Act 2.3 — Short hidden transition before the lower re-entry.
  secondOffscreenPauseMs: 80,

  // Act 2.4 — Final bottom-to-middle pass. This stops at the pre-3D pose;
  // Act 3 will take over from this exact point for the Z-depth/camera approach.
  bottomEntryXRatio: 0.5,
  bottomEntryStartMarginDp: 90,
  bottomEntryEndCenterYRatio: 0.5,
  bottomEntryDurationMs: 1450,
  bottomEntryEndScale: 0.72,
  bottomEntryRotationDegrees: 0,

  // Accessibility fallback. Reduced motion keeps the interaction but removes springs.
  reducedMotionPumpMs: 150,

  launchAscentMs: 3500, //1450,
  launchOffscreenMargin: 400, //36,
  launchScale: 1.04,

  // Flight audio — these changes start only after streak acceleration.
  flightDistantVolume: 0.5,
  flightNearVolume: 0.9,
  flightFadeDownMs: 3800,
  flightFadeUpMs: 1200,
};

type AnimationController = {
  /**
   * First press starts/measures the rocket. Subsequent presses while pumping
   * add impulses. Taps during ignition are ignored.
   */
  press: (
    rowRef: MeasurableRef,
    canvasRef: MeasurableRef,
    callbacks?: PressCallbacks,
  ) => void;
  cancel: () => void;
  isRunning: () => boolean;
  active: boolean;
  hintVisible: boolean;
  hintText: string | undefined;
  /** Exposed now so Act 3/4 can trigger their one-shot sounds without new wiring. */
  playExplosionSound: () => void;
  playCrashSound: () => void;
  playScreenCrackSound: () => void;
  fadeFlightAudioTo: (targetVolume: number, durationMs: number) => void;
  stage: Phase;
  behindLayer: React.ReactNode;
};

function measureInWindow(ref: MeasurableRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type FlightValueSpec = {
  value: Animated.Value;
  toValue: number;
  duration: number;
  easing?: (value: number) => number;
};

function runFlightValues(
  id: number,
  currentRunId: React.MutableRefObject<number>,
  specs: FlightValueSpec[],
): Promise<boolean> {
  return new Promise((resolve) => {
    const animations = specs.map((spec) =>
      Animated.timing(spec.value, {
        toValue: spec.toValue,
        duration: spec.duration,
        easing: spec.easing ?? Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    Animated.parallel(animations, { stopTogether: true }).start(
      ({ finished }) => {
        resolve(Boolean(finished && id === currentRunId.current));
      },
    );
  });
}

type FlightPathSample = {
  x: number;
  y: number;
  rotation: number;
};

type FlightRouteNode = Point & {
  finalApproachStart?: boolean;
};

type ContinuousFlightPath = {
  inputRange: number[];
  x: number[];
  y: number[];
  rotation: number[];
  finalApproachProgress: number;
  end: FlightPathSample;
};

/**
 * Builds three distinct v5-inspired spiral passes at different vertical
 * positions, joined with tangent-matched cubic transitions. The final pass
 * turns upward and blends directly into a vertical top exit. One progress
 * value drives the entire path, then arc-length resampling keeps speed even.
 */
/* function buildContinuousFlightPath(
  screenWidth: number,
  screenHeight: number,
  rocketWidth: number,
  rocketHeight: number,
  baseLeft: number,
  baseTop: number,
  fromSide: "left" | "right",
): ContinuousFlightPath {
  const raw: Point[] = [];
  const appendCubic = (
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    sampleCount = 96,
    skipFirst = false,
  ) => {
    for (let index = skipFirst ? 1 : 0; index < sampleCount; index += 1) {
      const t = index / (sampleCount - 1);
      const oneMinusT = 1 - t;
      const b0 = oneMinusT * oneMinusT * oneMinusT;
      const b1 = 3 * oneMinusT * oneMinusT * t;
      const b2 = 3 * oneMinusT * t * t;
      const b3 = t * t * t;
      raw.push({
        x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
        y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
      });
    }
  };

  const appendSpiral = (
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    direction: number,
    skipFirst: boolean,
  ): { start: Point; end: Point } => {
    const start: Point = { x: centerX + radiusX, y: centerY };
    let end = start;
    const sampleCount = 220;
    for (let index = skipFirst ? 1 : 0; index < sampleCount; index += 1) {
      const t = index / (sampleCount - 1);
      const easedRadius = t * t * (3 - 2 * t);
      const radiusFactor =
        1 +
        (NUKE_MY_BACKLOG_TUNING.flightLoopRadiusContractRatio - 1) *
          easedRadius;
      const angle = direction * Math.PI * 2 * t;
      end = {
        x: centerX + radiusX * radiusFactor * Math.cos(angle),
        y: centerY + radiusY * radiusFactor * Math.sin(angle),
      };
      raw.push(end);
    }
    return { start, end };
  };

  const appendConnector = (
    start: Point,
    end: Point,
    startDirectionY: number,
    endDirectionY: number,
    skipFirst = true,
  ) => {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const handle = Math.min(distance * 0.34, screenHeight * 0.105);
    const control1 = {
      x: start.x,
      y: start.y + startDirectionY * handle,
    };
    const control2 = {
      x: end.x,
      y: end.y - endDirectionY * handle,
    };
    appendCubic(start, control1, control2, end, 100, skipFirst);
  };

  const loop1 = {
    centerX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop1CenterXRatio,
    centerY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop1CenterYRatio,
    radiusX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop1RadiusXRatio,
    radiusY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop1RadiusYRatio,
    direction: NUKE_MY_BACKLOG_TUNING.flightLoop1Direction,
  };
  const loop2 = {
    centerX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop2CenterXRatio,
    centerY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop2CenterYRatio,
    radiusX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop2RadiusXRatio,
    radiusY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop2RadiusYRatio,
    direction: NUKE_MY_BACKLOG_TUNING.flightLoop2Direction,
  };
  const loop3 = {
    centerX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop3CenterXRatio,
    centerY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop3CenterYRatio,
    radiusX: screenWidth * NUKE_MY_BACKLOG_TUNING.flightLoop3RadiusXRatio,
    radiusY: screenHeight * NUKE_MY_BACKLOG_TUNING.flightLoop3RadiusYRatio,
    direction: NUKE_MY_BACKLOG_TUNING.flightLoop3Direction,
  };

  const firstStart = {
    x: screenWidth * 1.18,
    y: loop1.centerY - screenHeight * 0.13,
  };
  const firstLoopStart = {
    x: loop1.centerX + loop1.radiusX,
    y: loop1.centerY,
  };
  // Arrive from beyond the right edge, banking into the first upper loop.
  appendCubic(
    firstStart,
    { x: screenWidth * 1.02, y: firstStart.y + screenHeight * 0.035 },
    { x: firstLoopStart.x, y: firstLoopStart.y - screenHeight * 0.065 },
    firstLoopStart,
    100,
    false,
  );

  const first = appendSpiral(
    loop1.centerX,
    loop1.centerY,
    loop1.radiusX,
    loop1.radiusY,
    loop1.direction,
    true,
  );
  const secondStart = {
    x: loop2.centerX + loop2.radiusX,
    y: loop2.centerY,
  };
  appendConnector(first.end, secondStart, loop1.direction, loop2.direction);

  const second = appendSpiral(
    loop2.centerX,
    loop2.centerY,
    loop2.radiusX,
    loop2.radiusY,
    loop2.direction,
    true,
  );
  const thirdStart = {
    x: loop3.centerX + loop3.radiusX,
    y: loop3.centerY,
  };
  appendConnector(second.end, thirdStart, loop2.direction, loop3.direction);

  const third = appendSpiral(
    loop3.centerX,
    loop3.centerY,
    loop3.radiusX,
    loop3.radiusY,
    loop3.direction,
    true,
  );

  // The final loop is counter-clockwise, so its tangent points upward at the
  // end. Continue that heading into a curved, uninterrupted top-of-screen exit.
  const exitTarget = {
    x: third.end.x + screenWidth * 0.025,
    y: -rocketHeight / 2 - NUKE_MY_BACKLOG_TUNING.flightTopExitMarginDp,
  };
  const exitHandle = Math.min(screenHeight * 0.18, screenWidth * 0.34);
  appendCubic(
    third.end,
    { x: third.end.x, y: third.end.y - exitHandle },
    { x: exitTarget.x, y: exitTarget.y + exitHandle },
    exitTarget,
    120,
    true,
  );

  const directed = raw.map((point) => ({
    x: fromSide === "right" ? point.x : screenWidth - point.x,
    y: point.y,
  }));

  // Arc-length resampling removes speed fluctuations caused by curved sections
  // and the connectors between differently positioned loops.
  const cumulative: number[] = [0];
  for (let index = 1; index < directed.length; index += 1) {
    const dx = directed[index].x - directed[index - 1].x;
    const dy = directed[index].y - directed[index - 1].y;
    cumulative.push(cumulative[index - 1] + Math.hypot(dx, dy));
  }

  const totalLength = cumulative[cumulative.length - 1] || 1;
  const sampleCount = 560;
  const even: Point[] = [];
  let segmentIndex = 1;
  for (let index = 0; index < sampleCount; index += 1) {
    const targetDistance = (index / (sampleCount - 1)) * totalLength;
    while (
      segmentIndex < cumulative.length - 1 &&
      cumulative[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }
    const segmentStart = cumulative[segmentIndex - 1];
    const segmentEnd = cumulative[segmentIndex];
    const span = Math.max(0.0001, segmentEnd - segmentStart);
    const localT = (targetDistance - segmentStart) / span;
    const a = directed[segmentIndex - 1];
    const b = directed[segmentIndex];
    even.push({
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
    });
  }

  const rotations: number[] = [];
  for (let index = 0; index < even.length; index += 1) {
    const previous = even[Math.max(0, index - 1)];
    const next = even[Math.min(even.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (rotations.length > 0) {
      const previousAngle = rotations[rotations.length - 1];
      while (angle - previousAngle > 180) angle -= 360;
      while (angle - previousAngle < -180) angle += 360;
    }
    rotations.push(angle);
  }

  const x = even.map((point) => point.x - rocketWidth / 2 - baseLeft);
  const y = even.map((point) => point.y - rocketHeight / 2 - baseTop);
  const end = {
    x: x[x.length - 1],
    y: y[y.length - 1],
    rotation: rotations[rotations.length - 1],
  };

  return {
    inputRange: even.map((_, index) => index / (even.length - 1)),
    x,
    y,
    rotation: rotations,
    end,
  };
} */

/* function buildContinuousFlightPath(
  screenWidth: number,
  screenHeight: number,
  rocketWidth: number,
  rocketHeight: number,
  baseLeft: number,
  baseTop: number,
  fromSide: "left" | "right",
): ContinuousFlightPath {
  // All coordinates are screen percentages (0–100).
  // Change these points to adjust the flight path.
  const routePercent: Point[] = [
    // ENTRY — approach from outside the right edge
    { x: 122, y: 13 },
    { x: 98, y: 12 },
    { x: 74, y: 12 },
    { x: 54, y: 18 },

    // LOOP 1 — upper-left, rounder, clockwise
    { x: 50, y: 19 },
    { x: 44, y: 27 },
    { x: 28, y: 30 },
    { x: 12, y: 27 },
    { x: 6, y: 19 },
    { x: 12, y: 11 },
    { x: 28, y: 8 },
    { x: 44, y: 11 },
    { x: 50, y: 19 },

    // CONNECTOR — sweep down and across
    { x: 44, y: 27 },
    { x: 56, y: 34 },
    { x: 72, y: 42 },
    { x: 84, y: 47 },

    // LOOP 2 — middle-right, wider and flatter, clockwise
    { x: 88, y: 49 },
    { x: 82, y: 55 },
    { x: 66, y: 57 },
    { x: 50, y: 55 },
    { x: 44, y: 49 },
    { x: 50, y: 43 },
    { x: 66, y: 41 },
    { x: 82, y: 43 },
    { x: 88, y: 49 },

    // CONNECTOR — sweep towards the lower-left
    { x: 82, y: 55 },
    { x: 79, y: 65 },
    { x: 68, y: 77 },
    { x: 57, y: 82 },

    // LOOP 3 — lower-left, counter-clockwise
    { x: 56, y: 74 },
    { x: 51, y: 67 },
    { x: 38, y: 65 },
    { x: 25, y: 67 },
    { x: 20, y: 74 },
    { x: 25, y: 81 },
    { x: 38, y: 83 },
    { x: 51, y: 81 },
    { x: 56, y: 74 },

    // EXIT — bank upwards and leave through the top
    { x: 62, y: 61 },
    { x: 67, y: 46 },
    { x: 62, y: 30 },
    { x: 56, y: 12 },
    { x: 59, y: -20 },
  ];

  const points = routePercent.map((point) => ({
    x: (point.x / 100) * screenWidth,
    y: (point.y / 100) * screenHeight,
  }));

  // Internal curve interpolation. You shouldn't need to change this
  // when adjusting the routePercent coordinates above.
  const catmullRom = (
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number,
  ): Point => {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  };

  // Sample the continuous curve before converting it to equal-distance samples.
  const raw: Point[] = [];
  const samplesPerSegment = 28;

  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];

    for (
      let step = segment === 0 ? 0 : 1;
      step < samplesPerSegment;
      step += 1
    ) {
      const t = step / (samplesPerSegment - 1);
      raw.push(catmullRom(p0, p1, p2, p3, t));
    }
  }

  // Mirror the route when entering from the left.
  const directed = raw.map((point) => ({
    x: fromSide === "right" ? point.x : screenWidth - point.x,
    y: point.y,
  }));

  // Calculate cumulative distance along the curve.
  const cumulative: number[] = [0];

  for (let index = 1; index < directed.length; index += 1) {
    const previous = directed[index - 1];
    const current = directed[index];

    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(current.x - previous.x, current.y - previous.y),
    );
  }

  // Resample at equal distances to maintain consistent flight speed.
  const totalLength = cumulative[cumulative.length - 1] || 1;
  const sampleCount = 760;
  const even: Point[] = [];
  let segmentIndex = 1;

  for (let index = 0; index < sampleCount; index += 1) {
    const targetDistance = (index / (sampleCount - 1)) * totalLength;

    while (
      segmentIndex < cumulative.length - 1 &&
      cumulative[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }

    const startDistance = cumulative[segmentIndex - 1];
    const endDistance = cumulative[segmentIndex];
    const span = Math.max(0.0001, endDistance - startDistance);
    const t = (targetDistance - startDistance) / span;

    const a = directed[segmentIndex - 1];
    const b = directed[segmentIndex];

    even.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }

  // Calculate the rocket's heading from its actual direction of travel.
  const rotations: number[] = [];

  for (let index = 0; index < even.length; index += 1) {
    const previous = even[Math.max(0, index - 1)];
    const next = even[Math.min(even.length - 1, index + 1)];

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

    // Prevent abrupt rotation jumps at the -180 / 180 degree boundary.
    if (rotations.length > 0) {
      const previousAngle = rotations[rotations.length - 1];

      while (angle - previousAngle > 180) angle -= 360;
      while (angle - previousAngle < -180) angle += 360;
    }

    rotations.push(angle);
  }

  // Find when the rocket first becomes visible at the screen edge.
  const entryIndex = even.findIndex((point) =>
    fromSide === "right"
      ? point.x <= screenWidth + rocketWidth * 0.5
      : point.x >= -rocketWidth * 0.5,
  );

  const entryProgress = entryIndex >= 0 ? entryIndex / (sampleCount - 1) : 0;

  const x = even.map((point) => point.x - rocketWidth / 2 - baseLeft);

  const y = even.map((point) => point.y - rocketHeight / 2 - baseTop);

  const end = {
    x: x[x.length - 1],
    y: y[y.length - 1],
    rotation: rotations[rotations.length - 1],
  };

  return {
    inputRange: even.map((_, index) => index / (even.length - 1)),
    x,
    y,
    rotation: rotations,
    entryProgress,
    end,
  };
} */

function buildContinuousFlightPath(
  screenWidth: number,
  screenHeight: number,
  rocketWidth: number,
  rocketHeight: number,
  baseLeft: number,
  baseTop: number,
  fromSide: "left" | "right",
): ContinuousFlightPath {
  /*
   * COMPLETE FLIGHT ROUTE
   *
   * Coordinates are screen ratios:
   * x = 0 is left edge, x = 1 is right edge.
   * y = 0 is top edge, y = 1 is bottom edge.
   *
   * Values outside 0–1 represent off-screen travel.
   *
   * The spline passes through every node. Add/change nodes to
   * reshape the flight without changing the interpolation code.
   */

  const routeNodes: FlightRouteNode[] = [
    // START: approach from outside the upper-right edge.
    { x: 1.2, y: 0.22 },

    // 1: enter upper-right.
    { x: 0.99, y: 0.22 },

    // Sweep across the upper portion.
    { x: 0.76, y: 0.18 },
    { x: 0.52, y: 0.22 },
    { x: 0.29, y: 0.3 },
    { x: 0.08, y: 0.23 },

    // 2: exit upper-left.
    { x: 0.015, y: 0.16 },

    // Travel around the outside of the left edge.
    { x: -0.15, y: 0.21 },
    { x: -0.22, y: 0.37 },
    { x: -0.21, y: 0.54 },
    { x: -0.11, y: 0.59 },

    // 3: re-enter left-middle.
    { x: 0.015, y: 0.52 },

    // Sweep across the middle.
    { x: 0.23, y: 0.52 },
    { x: 0.48, y: 0.49 },
    { x: 0.74, y: 0.44 },

    // 4: exit right-middle.
    { x: 0.99, y: 0.4 },

    // Travel around the outside-right and over the top.
    { x: 1.17, y: 0.34 },
    { x: 1.23, y: 0.17 },
    { x: 1.15, y: 0.0 },
    { x: 0.96, y: -0.12 },
    { x: 0.73, y: -0.17 },
    { x: 0.56, y: -0.1 },

    // 5: re-enter from the top.
    { x: 0.52, y: -0.015 },

    // Broad descending curve through the left side.
    { x: 0.44, y: 0.12 },
    { x: 0.34, y: 0.28 },
    { x: 0.25, y: 0.46 },
    { x: 0.2, y: 0.65 },

    // Turn around the lower portion and sweep right.
    { x: 0.27, y: 0.8 },
    { x: 0.43, y: 0.89 },
    { x: 0.63, y: 0.9 },
    { x: 0.81, y: 0.86 },

    // 6: exit lower-right.
    { x: 0.99, y: 0.82 },

    // Travel around the outside-bottom.
    { x: 1.17, y: 0.9 },
    { x: 1.24, y: 1.08 },
    { x: 1.15, y: 1.25 },
    { x: 0.94, y: 1.31 },
    { x: 0.72, y: 1.29 },
    { x: 0.56, y: 1.19 },

    // 7: final entry from below.
    {
      x: 0.5,
      y: 1.04,
      finalApproachStart: true,
    },

    // Final upward movement towards the centre.
    { x: 0.49, y: 0.94 },
    { x: 0.52, y: 0.81 },
    { x: 0.5, y: 0.67 },
    {
      x: 0.5,
      y: NUKE_MY_BACKLOG_TUNING.bottomEntryEndCenterYRatio,
    },
  ];

  const finalApproachNodeIndex = routeNodes.findIndex(
    (node) => node.finalApproachStart,
  );

  // Convert percentage-based coordinates to actual screen coordinates.
  const points: Point[] = routeNodes.map((node) => ({
    x: node.x * screenWidth,
    y: node.y * screenHeight,
  }));

  /*
   * CENTRIPETAL KNOT SPACING
   *
   * Longer gaps between route nodes receive more curve parameter space.
   * This prevents tight turns and unevenly spaced nodes from producing
   * unnecessary loops or cusps.
   */
  const knots: number[] = [0];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);

    knots.push(knots[index - 1] + Math.sqrt(Math.max(distance, 1)));
  }

  const tangents: Point[] = [];
  const accelerations: Point[] = [];

  const slope = (a: Point, b: Point, duration: number): Point => ({
    x: (b.x - a.x) / duration,
    y: (b.y - a.y) / duration,
  });

  // First endpoint.
  tangents.push(slope(points[0], points[1], knots[1] - knots[0]));
  accelerations.push({ x: 0, y: 0 });

  // Interior nodes: shared first and second derivatives.
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    const h0 = knots[index] - knots[index - 1];
    const h1 = knots[index + 1] - knots[index];

    const previousSlope = slope(previous, current, h0);
    const nextSlope = slope(current, next, h1);

    tangents.push({
      x: (previousSlope.x * h1 + nextSlope.x * h0) / (h0 + h1),
      y: (previousSlope.y * h1 + nextSlope.y * h0) / (h0 + h1),
    });

    accelerations.push({
      x: (2 * (nextSlope.x - previousSlope.x)) / (h0 + h1),
      y: (2 * (nextSlope.y - previousSlope.y)) / (h0 + h1),
    });
  }

  // Last endpoint.
  const lastIndex = points.length - 1;

  tangents.push(
    slope(
      points[lastIndex - 1],
      points[lastIndex],
      knots[lastIndex] - knots[lastIndex - 1],
    ),
  );
  accelerations.push({ x: 0, y: 0 });

  /*
   * QUINTIC HERMITE INTERPOLATION
   *
   * Each segment matches position, tangent and acceleration
   * at both ends. Adjacent segments therefore join smoothly.
   */
  const evaluateAxis = (
    p0: number,
    p1: number,
    v0: number,
    v1: number,
    a0: number,
    a1: number,
    h: number,
    t: number,
  ) => {
    const d0 = v0 * h;
    const d1 = v1 * h;

    const dd0 = a0 * h * h;
    const dd1 = a1 * h * h;

    const delta = p1 - p0 - d0 - dd0 * 0.5;
    const deltaVelocity = d1 - d0 - dd0;
    const deltaAcceleration = dd1 - dd0;

    const c3 = 10 * delta - 4 * deltaVelocity + 0.5 * deltaAcceleration;

    const c4 = -15 * delta + 7 * deltaVelocity - deltaAcceleration;

    const c5 = 6 * delta - 3 * deltaVelocity + 0.5 * deltaAcceleration;

    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    return p0 + d0 * t + 0.5 * dd0 * t2 + c3 * t3 + c4 * t4 + c5 * t5;
  };

  const samplesPerSegment = 44;
  const raw: Point[] = [];

  let finalApproachRawIndex = 0;

  for (let segment = 0; segment < points.length - 1; segment += 1) {
    const p0 = points[segment];
    const p1 = points[segment + 1];

    const v0 = tangents[segment];
    const v1 = tangents[segment + 1];

    const a0 = accelerations[segment];
    const a1 = accelerations[segment + 1];

    const h = knots[segment + 1] - knots[segment];

    for (
      let step = segment === 0 ? 0 : 1;
      step <= samplesPerSegment;
      step += 1
    ) {
      const t = step / samplesPerSegment;

      raw.push({
        x: evaluateAxis(p0.x, p1.x, v0.x, v1.x, a0.x, a1.x, h, t),
        y: evaluateAxis(p0.y, p1.y, v0.y, v1.y, a0.y, a1.y, h, t),
      });
    }

    // Record the exact route position where point 7 begins.
    if (segment + 1 === finalApproachNodeIndex) {
      finalApproachRawIndex = raw.length - 1;
    }
  }

  // Mirror the complete route when the entry side is changed.
  const directed = raw.map((point) => ({
    x: fromSide === "right" ? point.x : screenWidth - point.x,
    y: point.y,
  }));

  /*
   * ARC-LENGTH RESAMPLING
   *
   * Makes the rocket travel approximately equal distances per frame,
   * rather than slowing down at waypoint transitions.
   */
  const cumulative: number[] = [0];

  for (let index = 1; index < directed.length; index += 1) {
    const previous = directed[index - 1];
    const current = directed[index];

    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(current.x - previous.x, current.y - previous.y),
    );
  }

  const totalLength = cumulative[cumulative.length - 1] || 1;

  const finalApproachDistance =
    cumulative[finalApproachRawIndex] ?? totalLength * 0.85;

  const finalApproachProgress = clamp(
    finalApproachDistance / totalLength,
    0.01,
    0.99,
  );

  const sampleCount = 960;
  const even: Point[] = [];

  let segmentIndex = 1;

  for (let index = 0; index < sampleCount; index += 1) {
    const targetDistance = (index / (sampleCount - 1)) * totalLength;

    while (
      segmentIndex < cumulative.length - 1 &&
      cumulative[segmentIndex] < targetDistance
    ) {
      segmentIndex += 1;
    }

    const segmentStart = cumulative[segmentIndex - 1];
    const segmentEnd = cumulative[segmentIndex];

    const span = Math.max(0.0001, segmentEnd - segmentStart);
    const localT = (targetDistance - segmentStart) / span;

    const a = directed[segmentIndex - 1];
    const b = directed[segmentIndex];

    even.push({
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
    });
  }

  // Rocket orientation follows the actual direction of travel.
  const rotations: number[] = [];

  for (let index = 0; index < even.length; index += 1) {
    const previous = even[Math.max(0, index - 1)];
    const next = even[Math.min(even.length - 1, index + 1)];

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

    // Unwrap angles to prevent sudden rotation jumps.
    if (rotations.length > 0) {
      const previousAngle = rotations[rotations.length - 1];

      while (angle - previousAngle > 180) angle -= 360;
      while (angle - previousAngle < -180) angle += 360;
    }

    rotations.push(angle);
  }

  // Convert absolute screen positions into Animated.View offsets.
  const x = even.map((point) => point.x - rocketWidth / 2 - baseLeft);

  const y = even.map((point) => point.y - rocketHeight / 2 - baseTop);

  const end = {
    x: x[x.length - 1],
    y: y[y.length - 1],
    rotation: rotations[rotations.length - 1],
  };

  return {
    inputRange: even.map((_, index) => index / (even.length - 1)),
    x,
    y,
    rotation: rotations,
    finalApproachProgress,
    end,
  };
}

export function useNukeMyBacklogAnimation(): AnimationController {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<NukeAnchor | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [ignitionVisible, setIgnitionVisible] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
  const [cloudSceneVisible, setCloudSceneVisible] = useState(false);
  const [launchStreaksActive, setLaunchStreaksActive] = useState(false);
  const [launchStreaksFadeOut, setLaunchStreaksFadeOut] = useState(false);
  const [flightPathActive, setFlightPathActive] = useState(false);
  // Act 3 is mounted and prepared during Act 2, then activated at the handoff.
  const [act3Preparing, setAct3Preparing] = useState(false);
  const [act3Active, setAct3Active] = useState(false);
  const act3ReadyRef = useRef(false);
  const act3HandoffPendingRef = useRef(false);
  const [flameActive, setFlameActive] = useState(false);
  const [flameFrameStep, setFlameFrameStep] = useState(0);
  const [flightStage, setFlightStage] = useState<Phase>(null);

  // Synchronous refs are used for taps because React state updates are asynchronous.
  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>(null);
  const runIdRef = useRef(0);
  const strokeIdRef = useRef(0);
  const lastTapTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const hintShownRef = useRef(false);
  const pendingTapTimesRef = useRef<number[]>([]);
  const pressureRef = useRef(0);
  const progressRef = useRef(0);
  const tapCountRef = useRef(0);
  const requiredTravelRef = useRef(1);
  const reduceMotionRef = useRef(false);
  const callbacksRef = useRef<PressCallbacks>({});
  const anchorRef = useRef<NukeAnchor | null>(null);
  const flightWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightWaitResolveRef = useRef<((completed: boolean) => void) | null>(
    null,
  );
  const flameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ignitionGlowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rocketVibrationLoopRef = useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const rocketShakeX = useRef(new Animated.Value(0)).current;
  const rocketShakeY = useRef(new Animated.Value(0)).current;
  const rocketShakeRotation = useRef(new Animated.Value(0)).current;
  const audio = useNukeMyBacklogAudio();
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The parent controller remains the sequence orchestrator. Act 3 reports
  // readiness after its final image views have loaded into the hidden scene.
  const activateAct3 = useCallback((id: number) => {
    if (
      id !== runIdRef.current ||
      !activeRef.current ||
      !act3ReadyRef.current
    ) {
      return;
    }

    act3HandoffPendingRef.current = false;
    phaseRef.current = "cameraApproach";
    setFlightStage("cameraApproach");
    setAct3Active(true);

    try {
      callbacksRef.current.onApproachReady?.();
    } catch (error) {
      console.warn("[Nuke My Backlog] Approach-ready callback failed.", error);
    }
  }, []);

  const handleAct3Prepared = useCallback(() => {
    if (!activeRef.current) return;
    act3ReadyRef.current = true;

    if (act3HandoffPendingRef.current) {
      activateAct3(runIdRef.current);
    }
  }, [activateAct3]);

  /*   const requestAct3Handoff = useCallback(
    (id: number) => {
      if (id !== runIdRef.current || !activeRef.current) return;

      // Keep the Act 2 rocket visible at its final pose if preparation has not
      // completed. The handoff itself is only a visibility/animation change.
      act3HandoffPendingRef.current = true;
      phaseRef.current = "approachReady";
      setFlightStage("approachReady");

      if (act3ReadyRef.current) {
        activateAct3(id);
      }
    },
    [activateAct3],
  ); */
  const requestAct3Handoff = useCallback(
    (id: number) => {
      if (id !== runIdRef.current || !activeRef.current) return;

      // Act 2 has finished. Only now begin preparing Act 3.
      act3HandoffPendingRef.current = true;
      phaseRef.current = "approachReady";
      setFlightStage("approachReady");

      if (act3ReadyRef.current) {
        activateAct3(id);
      } else {
        setAct3Preparing(true);
      }
    },
    [activateAct3],
  );

  const rocketY = useRef(new Animated.Value(0)).current;
  const rocketX = useRef(new Animated.Value(0)).current;
  const rocketRotation = useRef(new Animated.Value(0)).current;
  const rocketScale = useRef(new Animated.Value(1)).current;
  const flightPathProgress = useRef(new Animated.Value(0)).current;
  const rocketBlurProgress = useRef(new Animated.Value(0)).current;
  const ignitionGlowOpacity = useRef(new Animated.Value(0)).current;
  const ignitionGlowScale = useRef(new Animated.Value(0.72)).current;

  const stopRocketVibration = useCallback(() => {
    rocketVibrationLoopRef.current?.stop();
    rocketVibrationLoopRef.current = null;
    Animated.parallel([
      Animated.timing(rocketShakeX, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(rocketShakeY, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(rocketShakeRotation, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rocketShakeRotation, rocketShakeX, rocketShakeY]);

  const startRocketVibration = useCallback(
    (amplitudeX: number, amplitudeY: number, rotationAmplitude: number) => {
      rocketVibrationLoopRef.current?.stop();
      rocketShakeX.setValue(0);
      rocketShakeY.setValue(0);
      rocketShakeRotation.setValue(0);

      const pulse = (x: number, y: number, rotation: number) =>
        Animated.parallel([
          Animated.timing(rocketShakeX, {
            toValue: x,
            duration: 12,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rocketShakeY, {
            toValue: y,
            duration: 12,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(rocketShakeRotation, {
            toValue: rotation,
            duration: 12,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]);

      // Four tiny, asymmetric impulses form a ~48ms jitter cycle (~21Hz).
      // The launch uses a restrained amplitude; the stationary boost uses a
      // stronger amplitude while keeping total displacement below the old rig.
      const loop = Animated.loop(
        Animated.sequence([
          pulse(amplitudeX, -amplitudeY, rotationAmplitude),
          pulse(-amplitudeX, amplitudeY * 0.72, -rotationAmplitude),
          pulse(-amplitudeX * 0.62, -amplitudeY, rotationAmplitude * 0.55),
          pulse(
            amplitudeX * 0.32,
            amplitudeY * 0.48,
            -rotationAmplitude * 0.42,
          ),
        ]),
      );
      rocketVibrationLoopRef.current = loop;
      loop.start();
    },
    [rocketShakeRotation, rocketShakeX, rocketShakeY],
  );

  const clearTimers = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (idleSagTimerRef.current) clearTimeout(idleSagTimerRef.current);
    if (flightWaitTimerRef.current) clearTimeout(flightWaitTimerRef.current);
    flightWaitResolveRef.current?.(false);
    flightWaitResolveRef.current = null;
    if (flameIntervalRef.current) clearInterval(flameIntervalRef.current);
    hintTimerRef.current = null;
    hintHideTimerRef.current = null;
    finishTimerRef.current = null;
    idleSagTimerRef.current = null;
    flightWaitTimerRef.current = null;
    flameIntervalRef.current = null;
  }, []);

  const finishSession = useCallback(
    (id: number) => {
      if (id !== runIdRef.current) return;
      clearTimers();
      rocketY.stopAnimation();
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();
      rocketX.stopAnimation();
      rocketRotation.stopAnimation();
      rocketScale.stopAnimation();
      flightPathProgress.stopAnimation();
      rocketBlurProgress.stopAnimation();
      rocketBlurProgress.setValue(0);
      setFlightPathActive(false);
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      stopRocketVibration();
      audio.stopAll();

      activeRef.current = false;
      phaseRef.current = null;
      pendingTapTimesRef.current = [];
      setActive(false);
      setAnchor(null);
      setHintVisible(false);
      setIgnitionVisible(false);
      setFlightMode(false);
      setCloudSceneVisible(false);
      setLaunchStreaksActive(false);
      setLaunchStreaksFadeOut(false);
      setFlameActive(false);
      setFlameFrameStep(0);
      setFlightStage(null);
      setAct3Preparing(false);
      setAct3Active(false);
      act3ReadyRef.current = false;
      act3HandoffPendingRef.current = false;
      anchorRef.current = null;

      hintShownRef.current = false;
      sessionStartTimeRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [
      audio,
      clearTimers,
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
      flightPathProgress,
      rocketBlurProgress,
      stopRocketVibration,
      rocketShakeX,
      rocketShakeY,
      rocketShakeRotation,
    ],
  );

  const maybeShowHint = useCallback((id: number, now: number) => {
    if (
      id !== runIdRef.current ||
      phaseRef.current !== "pumping" ||
      hintShownRef.current ||
      tapCountRef.current < NUKE_MY_BACKLOG_TUNING.hintMinTapCount
    ) {
      return;
    }

    const startedAt = sessionStartTimeRef.current ?? now;
    if (now - startedAt < NUKE_MY_BACKLOG_TUNING.hintDelayMs) return;

    const progressRatio =
      progressRef.current / Math.max(1, requiredTravelRef.current);
    if (progressRatio >= NUKE_MY_BACKLOG_TUNING.hintOnlyBeforeProgressRatio)
      return;

    hintShownRef.current = true;
    setHintVisible(true);
    hintHideTimerRef.current = setTimeout(
      () => setHintVisible(false),
      NUKE_MY_BACKLOG_TUNING.hintVisibleMs,
    );
  }, []);

  const waitForFlightStage = useCallback((id: number, durationMs: number) => {
    return new Promise<boolean>((resolve) => {
      if (id !== runIdRef.current) {
        resolve(false);
        return;
      }
      flightWaitResolveRef.current = resolve;
      flightWaitTimerRef.current = setTimeout(() => {
        flightWaitTimerRef.current = null;
        flightWaitResolveRef.current = null;
        resolve(id === runIdRef.current);
      }, durationMs);
    });
  }, []);

  const animate = useCallback(
    (animation: Animated.CompositeAnimation, id: number) => {
      return new Promise<boolean>((resolve) => {
        if (id !== runIdRef.current) {
          resolve(false);
          return;
        }
        animation.start(({ finished }) =>
          resolve(finished && id === runIdRef.current),
        );
      });
    },
    [],
  );

  const runFlightSequence = useCallback(
    async (id: number) => {
      const currentAnchor = anchorRef.current;
      if (!currentAnchor || id !== runIdRef.current) return;

      const baseLeft =
        currentAnchor.x +
        currentAnchor.width *
          NUKE_MY_BACKLOG_TUNING.rocketHorizontalCenterRatio -
        currentAnchor.rocketWidth / 2;
      const baseTop =
        currentAnchor.y + NUKE_MY_BACKLOG_TUNING.rocketHiddenStartOffset;
      const screenWidth = currentAnchor.canvasWidth;
      const screenHeight = currentAnchor.canvasHeight;
      const rocketWidth = currentAnchor.rocketWidth;
      const rocketHeight = currentAnchor.rocketHeight;
      const side = NUKE_MY_BACKLOG_TUNING.upperReturnFromSide;
      const distantScale = NUKE_MY_BACKLOG_TUNING.distantFlightScale;

      // ACT 1.2 — The launch sound and bottom-to-centre movement begin together.
      // The row reveal/pumping mechanic remains untouched; at this handoff the
      // rocket is placed entirely below the screen, then rises into the scene.
      phaseRef.current = "boosting";
      setFlightStage("boosting");
      setFlightMode(true);
      setCloudSceneVisible(false);
      setLaunchStreaksActive(false);
      setLaunchStreaksFadeOut(false);
      setFlightPathActive(false);
      setFlameActive(true);
      setFlameFrameStep(0);
      setIgnitionVisible(false);
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;

      const centreLeft = screenWidth / 2 - rocketWidth / 2;
      const offscreenBottomTop = screenHeight + rocketHeight * 0.9;
      const boostTop =
        screenHeight * NUKE_MY_BACKLOG_TUNING.boostCenterYRatio -
        rocketHeight / 2;
      const boostX = centreLeft - baseLeft;
      const boostY = boostTop - baseTop;
      const bottomStartY = offscreenBottomTop - baseTop;

      /* rocketX.setValue(boostX);
      rocketY.setValue(bottomStartY);
      rocketRotation.setValue(0);
      rocketScale.setValue(1);
      rocketBlurProgress.setValue(0); */
      startRocketVibration(
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationX,
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationY,
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationRotation,
      );

      // playLaunch is called at the start of the 4.5s ascent, not after the
      // acceleration spectacle. The file's ~4.4s duration aligns to this travel.
      const reduced = reduceMotionRef.current;

      const offscreenY =
        -rocketTop -
        rocketHeight -
        NUKE_MY_BACKLOG_TUNING.launchOffscreenMargin;

      const ascentDuration = reduced
        ? NUKE_MY_BACKLOG_TUNING.reducedMotionPumpMs
        : NUKE_MY_BACKLOG_TUNING.launchAscentMs;

      void audio.playLaunch();
      const liftedOff = await animate(
        Animated.parallel([
          Animated.timing(rocketY, {
            toValue: offscreenY,
            duration: ascentDuration,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketScale, {
            toValue: reduced ? 1 : NUKE_MY_BACKLOG_TUNING.launchScale,
            duration: ascentDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        id,
      );
      if (!liftedOff || id !== runIdRef.current) return;
      void audio.startFlightLoop();
      rocketX.setValue(boostX);
      rocketY.setValue(bottomStartY);
      rocketRotation.setValue(0);
      rocketScale.setValue(1);
      rocketBlurProgress.setValue(0);
      const enteredFromBottom = await runFlightValues(id, runIdRef, [
        {
          value: rocketY,
          toValue: boostY,
          duration: NUKE_MY_BACKLOG_TUNING.boostCenterMoveMs,
          easing: Easing.out(Easing.quad),
        },
        {
          value: rocketX,
          toValue: boostX,
          duration: NUKE_MY_BACKLOG_TUNING.boostCenterMoveMs,
          easing: Easing.linear,
        },
        {
          value: rocketRotation,
          toValue: 0,
          duration: NUKE_MY_BACKLOG_TUNING.boostCenterMoveMs,
        },
      ]);
      if (!enteredFromBottom || id !== runIdRef.current) return;

      // ACT 1.3 — Hold at centre. Start the thrust loop and intensify the jitter
      // as 210 white streaks lengthen and accelerate over roughly eight seconds.

      if (id !== runIdRef.current) return;
      startRocketVibration(
        NUKE_MY_BACKLOG_TUNING.boostVibrationX,
        NUKE_MY_BACKLOG_TUNING.boostVibrationY,
        NUKE_MY_BACKLOG_TUNING.boostVibrationRotation,
      );
      setLaunchStreaksActive(true);
      setLaunchStreaksFadeOut(false);

      Animated.timing(rocketBlurProgress, {
        toValue: 1,
        duration: NUKE_MY_BACKLOG_TUNING.boostAccelerationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();

      const boostCompleted = await waitForFlightStage(
        id,
        NUKE_MY_BACKLOG_TUNING.boostAccelerationMs +
          NUKE_MY_BACKLOG_TUNING.boostHoldAfterAccelerationMs,
      );
      if (!boostCompleted || id !== runIdRef.current) return;

      // ACT 1.4 — The rocket leaves the streak field. Reveal the cloud deck while
      // the streaks and white wash fade behind it.
      phaseRef.current = "launching";
      setFlightStage("launching");
      // The rocket is leaving the high-speed streak field.
      // Begin fading its thrust sound into the distance.
      audio.fadeFlightTo(
        NUKE_MY_BACKLOG_TUNING.flightDistantVolume,
        NUKE_MY_BACKLOG_TUNING.flightFadeDownMs,
      );
      setCloudSceneVisible(true);
      setLaunchStreaksFadeOut(true);
      stopRocketVibration();

      const fullyOffscreenTop =
        -rocketHeight - NUKE_MY_BACKLOG_TUNING.launchOffscreenMarginDp;
      const launchOffscreenY = fullyOffscreenTop - baseTop;
      const leavingBoost = await runFlightValues(id, runIdRef, [
        {
          value: rocketY,
          toValue: launchOffscreenY,
          duration: NUKE_MY_BACKLOG_TUNING.launchExitDurationMs,
          easing: Easing.in(Easing.cubic),
        },
        {
          value: rocketScale,
          toValue: distantScale,
          duration: NUKE_MY_BACKLOG_TUNING.launchExitDurationMs,
          easing: Easing.inOut(Easing.quad),
        },
      ]);
      if (!leavingBoost || id !== runIdRef.current) return;

      const remainingRevealMs = Math.max(
        0,
        NUKE_MY_BACKLOG_TUNING.cloudRevealDurationMs -
          NUKE_MY_BACKLOG_TUNING.launchExitDurationMs,
      );
      if (remainingRevealMs > 0) {
        const revealCompleted = await waitForFlightStage(id, remainingRevealMs);
        if (!revealCompleted || id !== runIdRef.current) return;
      }
      setLaunchStreaksActive(false);
      setLaunchStreaksFadeOut(false);

      // The thrust loop is already running. Keep it running for the entire
      // remaining flight instead of restarting it or fading it out here.
      phaseRef.current = "firstOffscreen";
      /* setFlightStage("firstOffscreen");
      if (
        !(await waitForFlightStage(
          id,
          NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs,
        ))
      ) {
        return;
      }

      // ACT 2 — Three differently positioned v5-inspired spirals: upper,
      // middle and lower. The final curve exits through the top of the viewport.
      const path = buildContinuousFlightPath(
        screenWidth,
        screenHeight,
        rocketWidth,
        rocketHeight,
        baseLeft,
        baseTop,
        side,
      );
      flightPathProgress.stopAnimation();
      flightPathProgress.setValue(0);
      rocketBlurProgress.setValue(0.42);
      phaseRef.current = "upperReturn";
      setFlightStage("upperReturn");
      setFlightPathActive(true);

      const pathOk = await runFlightValues(id, runIdRef, [
        {
          value: flightPathProgress,
          toValue: 1,
          duration: NUKE_MY_BACKLOG_TUNING.upperFlightPathDurationMs,
          easing: Easing.linear,
        },
      ]);
      if (!pathOk || id !== runIdRef.current) return; */

      phaseRef.current = "firstOffscreen";
      setFlightStage("firstOffscreen");

      // Build the path now so we know exactly when the rocket crosses
      // back into the visible screen.
      // ACT 2 — One continuous route from point 1 through point 7.
      //
      // The path includes every off-screen transition and the final
      // bottom-to-centre climb. Nothing is repositioned or restarted.

      const path = buildContinuousFlightPath(
        screenWidth,
        screenHeight,
        rocketWidth,
        rocketHeight,
        baseLeft,
        baseTop,
        side,
      );

      flightPathProgress.stopAnimation();
      flightPathProgress.setValue(0);

      rocketBlurProgress.setValue(0.42);

      // ACT 2 → ACT 3 PREPARATION.
      // Mount Act 3's final visual tree now, hidden, while the long flight path
      // is running. Its images are added in small batches; the visible Act 2
      // rocket remains untouched until Act 3 reports that it is ready.
      act3ReadyRef.current = false;
      act3HandoffPendingRef.current = false;
      setAct3Preparing(false);
      setAct3Active(false);

      phaseRef.current = "upperReturn";
      setFlightStage("upperReturn");
      setFlightPathActive(true);

      const pathOk = await runFlightValues(id, runIdRef, [
        {
          value: flightPathProgress,
          toValue: 1,
          duration: NUKE_MY_BACKLOG_TUNING.upperFlightPathDurationMs,
          easing: Easing.linear,
        },
      ]);

      if (!pathOk || id !== runIdRef.current) return;

      // Commit the final approach position before returning to the
      // ordinary rocket transform values.
      rocketX.setValue(path.end.x);
      rocketY.setValue(path.end.y);
      rocketRotation.setValue(path.end.rotation);

      rocketScale.setValue(NUKE_MY_BACKLOG_TUNING.bottomEntryEndScale);

      rocketBlurProgress.setValue(0);

      flightPathProgress.setValue(1);
      setFlightPathActive(false);

      // The global path already finished at the final centre position.
      // No separate bottomEntry animation or 80ms repositioning is needed.
      // Act 2 is complete. Request Act 3 preparation at its final pose.
      // The Act 2 rocket remains visible until Act 3 reports readiness.
      requestAct3Handoff(id);
      /* const path = buildContinuousFlightPath(
        screenWidth,
        screenHeight,
        rocketWidth,
        rocketHeight,
        baseLeft,
        baseTop,
        side,
      );

      const pathDurationMs = NUKE_MY_BACKLOG_TUNING.upperFlightPathDurationMs;

      // How long before the path begins must the audio fade start,
      // so it reaches near volume at the actual screen-entry point?
      const fadeUpLeadBeforePathMs = Math.max(
        0,
        NUKE_MY_BACKLOG_TUNING.flightFadeUpMs -
          path.entryProgress * pathDurationMs,
      );

      // Preserve the total off-screen hold duration.
      // Split it into: distant hold -> audio fade-up -> re-entry.
      const waitBeforeFadeUpMs = Math.max(
        0,
        NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs - fadeUpLeadBeforePathMs,
      );

      const waitAfterFadeUpMs =
        NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs - waitBeforeFadeUpMs;

      if (
        waitBeforeFadeUpMs > 0 &&
        !(await waitForFlightStage(id, waitBeforeFadeUpMs))
      ) {
        return;
      }

      // The rocket is still off-screen, but it is about to return.
      // Increase the thrust volume so it reaches near volume
      // precisely as the rocket crosses the screen edge.
      audio.fadeFlightTo(
        NUKE_MY_BACKLOG_TUNING.flightNearVolume,
        NUKE_MY_BACKLOG_TUNING.flightFadeUpMs,
      );

      if (
        waitAfterFadeUpMs > 0 &&
        !(await waitForFlightStage(id, waitAfterFadeUpMs))
      ) {
        return;
      }

      flightPathProgress.stopAnimation();
      flightPathProgress.setValue(0);

      rocketBlurProgress.setValue(0.42);
      phaseRef.current = "upperReturn";
      setFlightStage("upperReturn");
      setFlightPathActive(true);

      const pathOk = await runFlightValues(id, runIdRef, [
        {
          value: flightPathProgress,
          toValue: 1,
          duration: pathDurationMs,
          easing: Easing.linear,
        },
      ]);

      if (!pathOk || id !== runIdRef.current) return;

      // The continuous path has already carried the rocket all the way out
      // through the top edge. Commit that off-screen pose, then begin bottom
      // re-entry after only a near-immediate 80ms visual beat.
      rocketX.setValue(path.end.x);
      rocketY.setValue(path.end.y);
      rocketRotation.setValue(path.end.rotation);
      rocketScale.setValue(distantScale);
      setFlightPathActive(false);

      phaseRef.current = "secondExit";
      setFlightStage("secondExit");
      if (
        !(await waitForFlightStage(
          id,
          NUKE_MY_BACKLOG_TUNING.secondOffscreenPauseMs,
        ))
      ) {
        return;
      }

      // Re-enter immediately from below, preserving the continuous thrust bed.
      const bottomEntryLeft = screenWidth / 2 - rocketWidth / 2;
      const bottomEntryTop =
        screenHeight + NUKE_MY_BACKLOG_TUNING.bottomEntryStartMarginDp;
      rocketX.setValue(bottomEntryLeft - baseLeft);
      rocketY.setValue(bottomEntryTop - baseTop);
      rocketRotation.setValue(
        NUKE_MY_BACKLOG_TUNING.bottomEntryRotationDegrees,
      );
      rocketScale.setValue(distantScale);
      rocketBlurProgress.setValue(0);

      phaseRef.current = "bottomEntry";
      setFlightStage("bottomEntry");
      const finalTop =
        screenHeight * NUKE_MY_BACKLOG_TUNING.bottomEntryEndCenterYRatio -
        rocketHeight / 2;
      const bottomEntryOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketX,
          toValue: bottomEntryLeft - baseLeft,
          duration: NUKE_MY_BACKLOG_TUNING.bottomEntryDurationMs,
          easing: Easing.linear,
        },
        {
          value: rocketY,
          toValue: finalTop - baseTop,
          duration: NUKE_MY_BACKLOG_TUNING.bottomEntryDurationMs,
          easing: Easing.out(Easing.cubic),
        },
        {
          value: rocketRotation,
          toValue: 0,
          duration: NUKE_MY_BACKLOG_TUNING.bottomEntryDurationMs,
        },
        {
          value: rocketScale,
          toValue: NUKE_MY_BACKLOG_TUNING.bottomEntryEndScale,
          duration: NUKE_MY_BACKLOG_TUNING.bottomEntryDurationMs,
          easing: Easing.out(Easing.quad),
        },
      ]);
      if (!bottomEntryOk || id !== runIdRef.current) return;

      phaseRef.current = "approachReady";
      setFlightStage("approachReady");
      try {
        callbacksRef.current.onApproachReady?.();
      } catch (error) {
        console.warn(
          "[Nuke My Backlog] Approach-ready callback failed.",
          error,
        );
      } */
    },
    [
      audio,
      flightPathProgress,
      rocketBlurProgress,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
      requestAct3Handoff,
      startRocketVibration,
      stopRocketVibration,
      waitForFlightStage,
    ],
  );

  const triggerIgnition = useCallback(
    (id: number) => {
      if (id !== runIdRef.current || phaseRef.current !== "pumping") return;
      phaseRef.current = "igniting";
      setFlightStage("igniting");
      clearTimers();
      setHintVisible(false);
      setIgnitionVisible(false);

      rocketY.stopAnimation();
      const finalTravel = requiredTravelRef.current;

      const settle = reduceMotionRef.current
        ? Animated.timing(rocketY, {
            toValue: -finalTravel,
            duration: NUKE_MY_BACKLOG_TUNING.reducedMotionPumpMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(rocketY, {
            toValue: -finalTravel,
            speed: NUKE_MY_BACKLOG_TUNING.ignitionSpringSpeed,
            bounciness: NUKE_MY_BACKLOG_TUNING.ignitionSpringBounciness,
            useNativeDriver: true,
          });

      settle.start(({ finished }) => {
        if (!finished || id !== runIdRef.current) return;
        setIgnitionVisible(true);

        // The glow is the short ignition-ready beat. Act 1 takes over after it.
        const glowLoop = Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(ignitionGlowOpacity, {
                toValue: NUKE_MY_BACKLOG_TUNING.ignitionGlowOpacity,
                duration: NUKE_MY_BACKLOG_TUNING.ignitionGlowPulseMs,
                useNativeDriver: true,
              }),
              Animated.timing(ignitionGlowScale, {
                toValue: 1,
                duration: NUKE_MY_BACKLOG_TUNING.ignitionGlowPulseMs,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(ignitionGlowOpacity, {
                toValue: 0.22,
                duration: NUKE_MY_BACKLOG_TUNING.ignitionGlowPulseMs,
                useNativeDriver: true,
              }),
              Animated.timing(ignitionGlowScale, {
                toValue: 0.82,
                duration: NUKE_MY_BACKLOG_TUNING.ignitionGlowPulseMs,
                useNativeDriver: true,
              }),
            ]),
          ]),
        );
        ignitionGlowLoopRef.current = glowLoop;
        glowLoop.start();

        finishTimerRef.current = setTimeout(() => {
          finishTimerRef.current = null;
          void runFlightSequence(id).catch((error) => {
            console.warn("[Nuke My Backlog] Flight sequence failed.", error);
            finishSession(id);
          });
        }, NUKE_MY_BACKLOG_TUNING.ignitionHoldMs);
      });
    },
    [
      audio,
      clearTimers,
      finishSession,
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketY,
      runFlightSequence,
    ],
  );

  const applyPumpTap = useCallback(
    (tapTime: number, id: number) => {
      if (id !== runIdRef.current || phaseRef.current !== "pumping") return;

      const previousTap = lastTapTimeRef.current;
      const gapMs =
        previousTap == null
          ? Number.POSITIVE_INFINITY
          : Math.max(0, tapTime - previousTap);
      lastTapTimeRef.current = tapTime;
      tapCountRef.current += 1;

      if (previousTap != null) {
        // A pause lets pressure leak and gravity pull the rocket back down.
        const pressureRetention = Math.exp(
          -gapMs / NUKE_MY_BACKLOG_TUNING.pressureDecayMs,
        );
        pressureRef.current *= pressureRetention;

        const gravityLoss =
          Math.max(0, gapMs - NUKE_MY_BACKLOG_TUNING.progressGraceMs) *
          NUKE_MY_BACKLOG_TUNING.progressGravityDpPerMs;
        progressRef.current = Math.max(
          0,
          progressRef.current -
            Math.min(
              NUKE_MY_BACKLOG_TUNING.maxProgressLossPerTapDp,
              gravityLoss,
            ),
        );
      }

      const rapidTap = gapMs <= NUKE_MY_BACKLOG_TUNING.rapidTapWindowMs;
      pressureRef.current = clamp(
        pressureRef.current +
          NUKE_MY_BACKLOG_TUNING.pressureGainPerTap +
          (rapidTap ? NUKE_MY_BACKLOG_TUNING.rapidTapPressureBonus : 0),
        0,
        NUKE_MY_BACKLOG_TUNING.maxPressure,
      );

      const progressGain =
        NUKE_MY_BACKLOG_TUNING.pumpBaseProgressDp +
        pressureRef.current * NUKE_MY_BACKLOG_TUNING.pumpPressureProgressDp;
      progressRef.current = Math.min(
        requiredTravelRef.current,
        progressRef.current + progressGain,
      );
      maybeShowHint(id, tapTime);

      if (idleSagTimerRef.current) {
        clearTimeout(idleSagTimerRef.current);
        idleSagTimerRef.current = null;
      }

      // Each tap interrupts the current recoil and applies a new upward stroke.
      // A fast rhythm interrupts the previous downstroke, so progress stacks visibly.
      const motionId = ++strokeIdRef.current;
      rocketY.stopAnimation();

      const upstrokeTarget = -Math.min(
        requiredTravelRef.current,
        progressRef.current + NUKE_MY_BACKLOG_TUNING.pumpUpstrokeOvershootDp,
      );
      const recoilTarget = -Math.max(
        0,
        progressRef.current - NUKE_MY_BACKLOG_TUNING.pumpRecoilDp,
      );

      const riseAnimation = reduceMotionRef.current
        ? Animated.timing(rocketY, {
            toValue: upstrokeTarget,
            duration: NUKE_MY_BACKLOG_TUNING.reducedMotionPumpMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(rocketY, {
            toValue: upstrokeTarget,
            speed: NUKE_MY_BACKLOG_TUNING.pumpRiseSpringSpeed,
            bounciness: NUKE_MY_BACKLOG_TUNING.pumpRiseSpringBounciness,
            useNativeDriver: true,
          });

      riseAnimation.start(({ finished }) => {
        if (
          !finished ||
          id !== runIdRef.current ||
          motionId !== strokeIdRef.current
        )
          return;

        Animated.timing(rocketY, {
          toValue: recoilTarget,
          duration: NUKE_MY_BACKLOG_TUNING.pumpRecoilMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: recoilFinished }) => {
          if (
            !recoilFinished ||
            id !== runIdRef.current ||
            motionId !== strokeIdRef.current
          )
            return;

          // If no new tap arrives, let the rocket sag a little farther down.
          // The next tap interrupts this motion and pumps from its current position.
          idleSagTimerRef.current = setTimeout(() => {
            if (
              id !== runIdRef.current ||
              phaseRef.current !== "pumping" ||
              motionId !== strokeIdRef.current
            )
              return;
            Animated.timing(rocketY, {
              // User-tuned behaviour: after the pause, the rocket returns fully
              // to its resting/hidden position. The time scales with how far it
              // had already been pumped out, so a deeper rise takes longer to fall.
              toValue: 0,
              duration: Math.max(
                1,
                progressRef.current * NUKE_MY_BACKLOG_TUNING.idleSagMs,
              ),
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }).start();
          }, NUKE_MY_BACKLOG_TUNING.idleRecoilDelayMs);
        });
      });

      if (progressRef.current >= requiredTravelRef.current) {
        // The visual stroke gets to finish its upward movement before ignition.
        triggerIgnition(id);
      }
    },
    [maybeShowHint, rocketY, triggerIgnition],
  );

  const beginMeasurement = useCallback(
    async (rowRef: MeasurableRef, canvasRef: MeasurableRef, id: number) => {
      try {
        const [rowWindowRect, canvasWindowRect, reduceMotion] =
          await Promise.all([
            measureInWindow(rowRef),
            measureInWindow(canvasRef),
            AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
          ]);

        if (id !== runIdRef.current) return;
        if (!rowWindowRect || !canvasWindowRect) {
          console.warn(
            "[Nuke My Backlog] Could not measure the Easter egg row/canvas.",
          );
          finishSession(id);
          return;
        }

        const localRow: Rect = {
          x: rowWindowRect.x - canvasWindowRect.x,
          y: rowWindowRect.y - canvasWindowRect.y,
          width: rowWindowRect.width,
          height: rowWindowRect.height,
        };

        reduceMotionRef.current = reduceMotion;

        // Fit the complete rocket above the row without clipping its nose off-screen.
        const maxHeightBeforeScreenTop = Math.max(72, localRow.y - 12);
        const maxWidthByHeight = maxHeightBeforeScreenTop / ROCKET_ASPECT_RATIO;
        const rocketWidth = clamp(
          Math.min(
            localRow.width * NUKE_MY_BACKLOG_TUNING.rocketWidthRatio,
            NUKE_MY_BACKLOG_TUNING.rocketMaxWidth,
            maxWidthByHeight,
          ),
          NUKE_MY_BACKLOG_TUNING.rocketMinWidth,
          NUKE_MY_BACKLOG_TUNING.rocketMaxWidth,
        );
        const rocketHeight = rocketWidth * ROCKET_ASPECT_RATIO;
        const requiredTravel =
          rocketHeight + NUKE_MY_BACKLOG_TUNING.rocketHiddenStartOffset;
        const nextAnchor: NukeAnchor = {
          ...localRow,
          rocketWidth,
          rocketHeight,
          canvasWidth: canvasWindowRect.width,
          canvasHeight: canvasWindowRect.height,
        };

        requiredTravelRef.current = requiredTravel;
        pressureRef.current = 0;
        progressRef.current = 0;
        tapCountRef.current = 0;
        lastTapTimeRef.current = null;
        rocketY.setValue(0);
        rocketX.setValue(0);
        rocketRotation.setValue(0);
        rocketScale.setValue(1);
        rocketShakeX.setValue(0);
        rocketShakeY.setValue(0);
        rocketShakeRotation.setValue(0);
        flightPathProgress.setValue(0);
        rocketBlurProgress.setValue(0);
        setFlightPathActive(false);
        ignitionGlowOpacity.setValue(0);
        ignitionGlowScale.setValue(0.72);
        anchorRef.current = nextAnchor;
        setAnchor(nextAnchor);
        // TEMPORARY: bypass Acts 0–2 and enter Act 3 directly.
        // The first row press still dismisses the keyboard and measures
        // the actual canvas and rocket dimensions.
        if (DEBUG_START_ACT3_DIRECTLY) {
          phaseRef.current = "cameraApproach";
          setFlightStage("cameraApproach");

          setFlightMode(true);
          setCloudSceneVisible(true);

          setLaunchStreaksActive(false);
          setLaunchStreaksFadeOut(false);
          setFlameActive(false);

          act3ReadyRef.current = false;
          act3HandoffPendingRef.current = true;
          setAct3Preparing(true);
          phaseRef.current = "approachReady";
          setFlightStage("approachReady");
          return;
        }
        phaseRef.current = "pumping";
        setFlightStage("pumping");

        // Process taps received while row/canvas measurements were pending.
        const pending = pendingTapTimesRef.current.splice(0);
        pending.forEach((tapTime) => applyPumpTap(tapTime, id));
      } catch (error) {
        console.warn(
          "[Nuke My Backlog] Failed to prepare rocket pumping.",
          error,
        );
        finishSession(id);
      }
    },
    [
      applyPumpTap,
      finishSession,
      flightPathProgress,
      rocketBlurProgress,
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
      rocketShakeX,
      rocketShakeY,
      rocketShakeRotation,
    ],
  );

  const press = useCallback(
    (
      rowRef: MeasurableRef,
      canvasRef: MeasurableRef,
      callbacks: PressCallbacks = {},
    ) => {
      const now = Date.now();

      if (phaseRef.current === "igniting") return;

      if (!activeRef.current) {
        activeRef.current = true;
        phaseRef.current = "measuring";
        runIdRef.current += 1;
        const id = runIdRef.current;
        callbacksRef.current = callbacks;
        pendingTapTimesRef.current = [now];
        setActive(true);
        setHintVisible(false);
        setIgnitionVisible(false);
        setFlightMode(false);
        setAct3Preparing(false);
        setAct3Active(false);
        act3ReadyRef.current = false;
        act3HandoffPendingRef.current = false;
        setCloudSceneVisible(false);
        setLaunchStreaksActive(false);
        setLaunchStreaksFadeOut(false);
        setFlameActive(false);
        setFlameFrameStep(0);
        setFlightStage("measuring");
        try {
          callbacks.onFirstPress?.();
        } catch (error) {
          console.warn("[Nuke My Backlog] First-press callback failed.", error);
          finishSession(id);
          return;
        }

        sessionStartTimeRef.current = now;
        hintShownRef.current = false;
        hintTimerRef.current = setTimeout(
          () => maybeShowHint(id, Date.now()),
          NUKE_MY_BACKLOG_TUNING.hintDelayMs,
        );

        void beginMeasurement(rowRef, canvasRef, id);
        return;
      }

      // The row remains pressable while pumping. These taps are the mechanic.
      if (phaseRef.current === "measuring") {
        pendingTapTimesRef.current.push(now);
        return;
      }
      if (phaseRef.current === "pumping") {
        applyPumpTap(now, runIdRef.current);
      }
    },
    [applyPumpTap, beginMeasurement, finishSession, maybeShowHint],
  );

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    runIdRef.current += 1;
    strokeIdRef.current += 1;
    clearTimers();
    rocketY.stopAnimation();
    rocketX.stopAnimation();
    rocketRotation.stopAnimation();
    rocketScale.stopAnimation();
    flightPathProgress.stopAnimation();
    rocketBlurProgress.stopAnimation();
    rocketBlurProgress.setValue(0);
    setFlightPathActive(false);
    ignitionGlowOpacity.stopAnimation();
    ignitionGlowScale.stopAnimation();
    ignitionGlowLoopRef.current?.stop();
    ignitionGlowLoopRef.current = null;
    stopRocketVibration();
    audio.stopAll();
    activeRef.current = false;
    phaseRef.current = null;
    pendingTapTimesRef.current = [];
    hintShownRef.current = false;
    sessionStartTimeRef.current = null;
    setActive(false);
    setAnchor(null);
    setHintVisible(false);
    setIgnitionVisible(false);
    setFlightMode(false);
    setCloudSceneVisible(false);
    setLaunchStreaksActive(false);
    setLaunchStreaksFadeOut(false);
    setFlameActive(false);
    setFlameFrameStep(0);
    setFlightStage(null);
    setAct3Preparing(false);
    setAct3Active(false);
    act3ReadyRef.current = false;
    act3HandoffPendingRef.current = false;
    anchorRef.current = null;
    const callback = callbacksRef.current.onFinished;
    callbacksRef.current = {};
    callback?.();
  }, [
    audio,
    clearTimers,
    ignitionGlowOpacity,
    ignitionGlowScale,
    rocketRotation,
    rocketScale,
    flightPathProgress,
    rocketBlurProgress,
    rocketX,
    rocketY,
    stopRocketVibration,
    rocketShakeX,
    rocketShakeY,
    rocketShakeRotation,
  ]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      strokeIdRef.current += 1;
      clearTimers();
      rocketY.stopAnimation();
      rocketX.stopAnimation();
      rocketRotation.stopAnimation();
      rocketScale.stopAnimation();
      flightPathProgress.stopAnimation();
      rocketBlurProgress.stopAnimation();
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      stopRocketVibration();
      /*  audio.stopAll(); */
      activeRef.current = false;
      phaseRef.current = null;
      hintShownRef.current = false;
      sessionStartTimeRef.current = null;
      anchorRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    };
  }, [
    /* audio, */
    clearTimers,
    ignitionGlowOpacity,
    ignitionGlowScale,
    rocketRotation,
    rocketScale,
    flightPathProgress,
    rocketBlurProgress,
    rocketX,
    rocketY,
    stopRocketVibration,
    rocketShakeX,
    rocketShakeY,
    rocketShakeRotation,
  ]);

  useEffect(() => {
    if (!flameActive) {
      if (flameIntervalRef.current) clearInterval(flameIntervalRef.current);
      flameIntervalRef.current = null;
      return;
    }

    flameIntervalRef.current = setInterval(() => {
      setFlameFrameStep(
        (current) => (current + 1) % FLAME_FRAME_SEQUENCE.length,
      );
    }, NUKE_MY_BACKLOG_TUNING.flameFrameIntervalMs);

    return () => {
      if (flameIntervalRef.current) clearInterval(flameIntervalRef.current);
      flameIntervalRef.current = null;
    };
  }, [flameActive]);

  const rocketWidth = anchor?.rocketWidth ?? 0;
  const rocketHeight = anchor?.rocketHeight ?? 0;
  const rocketLeft = anchor
    ? anchor.x +
      anchor.width * NUKE_MY_BACKLOG_TUNING.rocketHorizontalCenterRatio -
      rocketWidth / 2
    : 0;
  const rocketTop = anchor
    ? anchor.y + NUKE_MY_BACKLOG_TUNING.rocketHiddenStartOffset
    : 0;

  const flightPath = useMemo(() => {
    if (!anchor) {
      return {
        inputRange: [0, 1],
        x: [0, 0],
        y: [0, 0],
        rotation: [0, 0],
        finalApproachProgress: 0.85,
        end: { x: 0, y: 0, rotation: 0 },
      };
    }
    const baseLeft =
      anchor.x +
      anchor.width * NUKE_MY_BACKLOG_TUNING.rocketHorizontalCenterRatio -
      anchor.rocketWidth / 2;
    const baseTop = anchor.y + NUKE_MY_BACKLOG_TUNING.rocketHiddenStartOffset;
    return buildContinuousFlightPath(
      anchor.canvasWidth,
      anchor.canvasHeight,
      anchor.rocketWidth,
      anchor.rocketHeight,
      baseLeft,
      baseTop,
      NUKE_MY_BACKLOG_TUNING.upperReturnFromSide,
    );
  }, [anchor]);

  const flightPathX = flightPathProgress.interpolate({
    inputRange: flightPath.inputRange,
    outputRange: flightPath.x,
    extrapolate: "clamp",
  });
  const flightPathY = flightPathProgress.interpolate({
    inputRange: flightPath.inputRange,
    outputRange: flightPath.y,
    extrapolate: "clamp",
  });
  const flightPathRotation = flightPathProgress.interpolate({
    inputRange: flightPath.inputRange,
    outputRange: flightPath.rotation,
    extrapolate: "clamp",
  });
  const finalApproachProgress = flightPath.finalApproachProgress;

  const flightPathScale = flightPathProgress.interpolate({
    inputRange: [0, finalApproachProgress, 1],
    outputRange: [
      NUKE_MY_BACKLOG_TUNING.distantFlightScale,
      NUKE_MY_BACKLOG_TUNING.distantFlightScale,
      NUKE_MY_BACKLOG_TUNING.bottomEntryEndScale,
    ],
    extrapolate: "clamp",
  });

  const flightPathBlurProgress = flightPathProgress.interpolate({
    inputRange: [0, finalApproachProgress, 1],
    outputRange: [0.42, 0.42, 0],
    extrapolate: "clamp",
  });

  const displayRocketX = flightPathActive ? flightPathX : rocketX;
  const displayRocketY = flightPathActive ? flightPathY : rocketY;
  const displayRocketRotation = flightPathActive
    ? flightPathRotation
    : rocketRotation;
  const displayRocketScale = flightPathActive ? flightPathScale : rocketScale;

  const displayRocketBlurProgress = flightPathActive
    ? flightPathBlurProgress
    : rocketBlurProgress;

  const glowLeft =
    rocketLeft + rocketWidth / 2 - NUKE_MY_BACKLOG_TUNING.ignitionGlowSize / 2;
  const glowTop = anchor
    ? anchor.y - NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.62
    : 0;

  const rotation = displayRocketRotation.interpolate({
    inputRange: [-1080, 1440],
    outputRange: ["-1080deg", "1440deg"],
    extrapolate: "clamp",
  });

  const activeFlameFrame = FLAME_FRAME_SEQUENCE[flameFrameStep] ?? 0;
  const rocketSharpOpacity = displayRocketBlurProgress.interpolate({
    inputRange: [0, 0.22, 0.4, 1],
    outputRange: [1, 1, 0.9, 0.68],
    extrapolate: "clamp",
  });
  const rocketBlur02Opacity = displayRocketBlurProgress.interpolate({
    inputRange: [0, 0.16, 0.28, 0.42],
    outputRange: [0, 0, 0.22, 0],
    extrapolate: "clamp",
  });
  const rocketBlur05Opacity = displayRocketBlurProgress.interpolate({
    inputRange: [0.28, 0.46, 0.62, 0.78],
    outputRange: [0, 0.22, 0.22, 0],
    extrapolate: "clamp",
  });
  const rocketBlur08Opacity = displayRocketBlurProgress.interpolate({
    inputRange: [0.62, 0.82, 1],
    outputRange: [0, 0.3, 0.32],
    extrapolate: "clamp",
  });
  const rocketScaleFactor = rocketWidth / ROCKET_SOURCE_WIDTH;
  const exhaustX =
    NUKE_MY_BACKLOG_TUNING.rocketExhaustAnchorX * rocketScaleFactor;
  const exhaustY =
    NUKE_MY_BACKLOG_TUNING.rocketExhaustAnchorY * rocketScaleFactor;

  const behindLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, styles.overlay]}
    >
      {active && anchor && flightMode && (
        <NukeFlightEnvironment
          active={cloudSceneVisible}
          fadeDurationMs={NUKE_MY_BACKLOG_TUNING.cloudRevealDurationMs}
          width={anchor.canvasWidth}
          height={anchor.canvasHeight}
          shadowLayer={
            act3Active ? null : (
              <Animated.Image
                /*  pointerEvents="none" */
                source={rocketAsset as ImageSourcePropType}
                resizeMode="stretch"
                fadeDuration={0}
                blurRadius={NUKE_MY_BACKLOG_TUNING.projectedShadowBlurRadius}
                style={{
                  position: "absolute",
                  left:
                    rocketLeft + NUKE_MY_BACKLOG_TUNING.projectedShadowOffsetX,
                  top:
                    rocketTop + NUKE_MY_BACKLOG_TUNING.projectedShadowOffsetY,
                  width: rocketWidth,
                  height: rocketHeight,
                  tintColor: "#243A50",
                  opacity: NUKE_MY_BACKLOG_TUNING.projectedShadowOpacity,
                  zIndex: 10,
                  transform: [
                    { translateX: displayRocketX },
                    { translateY: displayRocketY },
                    { rotate: rotation },
                    { scale: displayRocketScale },
                    { translateX: rocketShakeX },
                    { translateY: rocketShakeY },
                    {
                      rotate: rocketShakeRotation.interpolate({
                        inputRange: [-1, 1],
                        outputRange: ["-0.22deg", "0.22deg"],
                      }),
                    },
                  ],
                }}
              />
            )
          }
        />
      )}
      {active && anchor && flightMode && launchStreaksActive && (
        <NukeLaunchSpeedStreaks
          active={launchStreaksActive}
          fadeOut={launchStreaksFadeOut}
          width={anchor.canvasWidth}
          height={anchor.canvasHeight}
        />
      )}
      {active && anchor && (
        <View
          pointerEvents="none"
          style={[
            styles.rocketClip,
            {
              opacity: act3Active ? 0 : 1,
              height: flightMode ? anchor.canvasHeight : Math.max(0, anchor.y),
              // During ignition, allow the glow to extend over the row.
              overflow: ignitionVisible && !flightMode ? "visible" : "hidden",
            },
          ]}
        >
          {/* Act 0.5 — ignition glow remains anchored to the row during the hold. */}
          {ignitionVisible && !flightMode && (
            //  <Animated.View
            //   style={{
            //     position: "absolute",
            //     left: glowLeft,
            //     top: glowTop,
            //     width: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
            //     height: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
            //     borderRadius: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize / 2,
            //     backgroundColor: "#FF8A24",
            //     opacity: ignitionGlowOpacity,
            //     transform: [{ scale: ignitionGlowScale }],
            //     shadowColor: "#FF6A00",
            //     shadowOpacity: 0.9,
            //     shadowRadius: 18,
            //     zIndex: 3,
            //     elevation: 3,
            //   }}
            // />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: glowLeft,
                top: glowTop,
                width: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
                height: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 1.14,
                backgroundColor: "transparent",
                opacity: ignitionGlowOpacity,
                transform: [{ scale: ignitionGlowScale }],
                overflow: "visible",
                zIndex: 0,
              }}
            >
              {/* Main rounded body */}
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
                  height: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
                  borderRadius: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize / 2,
                  backgroundColor: "#FF8A24",
                  shadowColor: "#FF6A00",
                  shadowOpacity: 0.9,
                  shadowRadius: 18,
                  elevation: 5,
                }}
              />

              {/* Small pointed lower tip */}
              <View
                style={{
                  position: "absolute",
                  left: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.35,
                  top: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.76,
                  width: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.3,
                  height: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.3,
                  borderRadius: 2,
                  backgroundColor: "#FF8A24",
                  transform: [{ rotate: "45deg" }],
                }}
              />
            </Animated.View>
          )}

          {/*
            ACT 1 — ROCKET + FLAME RIG
            The rocket and all flame frames share one animated parent transform.
            Every flame is independently positioned using its visible alpha bounds,
            then vertically flipped so its wide base meets the engine exhaust.
          */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: rocketLeft,
              top: rocketTop,
              width: rocketWidth,
              height: rocketHeight,
              overflow: "visible",
              zIndex: 20,
              transform: [
                { translateX: displayRocketX },
                { translateY: displayRocketY },
                { rotate: rotation },
                { scale: displayRocketScale },
                { translateX: rocketShakeX },
                { translateY: rocketShakeY },
                {
                  rotate: rocketShakeRotation.interpolate({
                    inputRange: [-1, 1],
                    outputRange: ["-0.22deg", "0.22deg"],
                  }),
                },
              ],
            }}
          >
            {FLAME_FRAMES.map((frame, index) => {
              const visibleFrameWidth = frame.alphaRight - frame.alphaLeft;
              const targetVisibleWidth =
                rocketWidth * NUKE_MY_BACKLOG_TUNING.flameVisibleWidthRatio;
              const flameScale = targetVisibleWidth / visibleFrameWidth;
              const alphaCenterX = (frame.alphaLeft + frame.alphaRight) / 2;
              const flippedBaseOffsetY = frame.sourceHeight - frame.alphaBottom;
              const flameLeft = exhaustX - alphaCenterX * flameScale;
              const flameTop =
                exhaustY -
                flippedBaseOffsetY * flameScale -
                NUKE_MY_BACKLOG_TUNING.flameBaseOverlapDp;

              return (
                <Animated.Image
                  key={`flame-${index}`}
                  source={frame.source}
                  resizeMode="stretch"
                  fadeDuration={0}
                  style={{
                    position: "absolute",
                    left: flameLeft,
                    top: flameTop,
                    width: frame.sourceWidth * flameScale,
                    height: frame.sourceHeight * flameScale,
                    // Pre-mount every frame from the first pump tap, so the
                    // first visible flame has no PNG decode / image-source delay.
                    opacity: flameActive && activeFlameFrame === index ? 1 : 0,
                    transform: [{ scaleY: -1 }],
                    zIndex: 0,
                  }}
                />
              );
            })}

            {/* Draw the rocket after the flame so the engine base naturally occludes it. */}
            {/* Cross-fade between pre-rendered 0%, 2%, 5% and 8% blur assets.
                This avoids trying to animate Image.blurRadius on the native driver. */}
            <Animated.Image
              source={rocketBlur02Asset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: rocketWidth,
                height: rocketHeight,
                opacity: rocketBlur02Opacity,
                zIndex: 1,
              }}
            />
            <Animated.Image
              source={rocketBlur05Asset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: rocketWidth,
                height: rocketHeight,
                opacity: rocketBlur05Opacity,
                zIndex: 1,
              }}
            />
            <Animated.Image
              source={rocketBlur08Asset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: rocketWidth,
                height: rocketHeight,
                opacity: rocketBlur08Opacity,
                zIndex: 1,
              }}
            />
            <Animated.Image
              source={rocketAsset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: rocketWidth,
                height: rocketHeight,
                opacity: rocketSharpOpacity,
                zIndex: 4,
              }}
            />
          </Animated.View>
        </View>
      )}
      {active && anchor && act3Preparing && (
        <NukeMyBacklogAct3
          preparing={act3Preparing}
          active={act3Active}
          onPrepared={handleAct3Prepared}
          canvasWidth={anchor.canvasWidth}
          canvasHeight={anchor.canvasHeight}
          rocketWidth={rocketWidth}
          initialRocketScale={NUKE_MY_BACKLOG_TUNING.bottomEntryEndScale}
          centreX={anchor.canvasWidth / 2}
          centreY={
            anchor.canvasHeight *
            NUKE_MY_BACKLOG_TUNING.bottomEntryEndCenterYRatio
          }
          onFlightVolumeTo={audio.fadeFlightTo}
          onComplete={() => {
            phaseRef.current = "cameraApproachComplete";
            setFlightStage("cameraApproachComplete");
          }}
        />
      )}
    </View>
  );

  return {
    press,
    cancel,
    isRunning: () => activeRef.current,
    active,
    hintVisible,
    hintText: hintVisible ? "Keep tapping to build up pressure!" : undefined,
    playExplosionSound: audio.playExplosion,
    playCrashSound: audio.playCrash,
    playScreenCrackSound: audio.playScreenCrack,
    fadeFlightAudioTo: audio.fadeFlightTo,
    stage: flightStage,
    behindLayer,
  };
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 22,
    elevation: 22,
    overflow: "visible",
  },
  rocketClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden",
  },
});
