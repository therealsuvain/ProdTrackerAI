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
import { useNukeMyBacklogAudio } from "./use-nuke-my-backlog-audio";
import NukeFlightEnvironment from "./nuke-flight-environment";
import NukeLaunchSpeedStreaks from "./nuke-launch-speed-streaks";

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
  | null;

type PressCallbacks = {
  /** Called synchronously on the first accepted press of this pumping session. */
  onFirstPress?: () => void;
  /** Called when the rocket reaches the pre-3D approach position. The run stays active. */
  onApproachReady?: () => void;
  /** Called once when the entire Easter egg is eventually completed or cancelled. */
  onFinished?: () => void;
};

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
  launchExitDurationMs: 950,
  launchOffscreenMarginDp: 96,

  // Act 2.1 — Off-screen interval before the high-speed return passes.
  firstOffscreenHoldMs: 4500,
  distantFlightScale: 0.46,

  // Act 2.2 — Reuse the v5 inward spiral twice, without resetting between passes.
  // Pass one enters from the right and ends off-screen left. Pass two begins at
  // that exact left-side endpoint, expands from a different angle, and exits right.
  upperFlightPathDurationMs: 4200,
  flightSpiralTurns: 1.5,
  flightSpiralCenterXRatio: 0.42,
  flightSpiralCenterYRatio: 0.28,
  flightSpiralStartRadiusXRatio: 0.78,
  flightSpiralEndRadiusXRatio: 0.62,
  flightSpiralStartRadiusYRatio: 0.21,
  flightSpiralEndRadiusYRatio: 0.16,
  flightSpiralSecondEndRadiusXRatio: 0.8,
  flightSpiralSecondEndRadiusYRatio: 0.22,
  projectedShadowOffsetX: -20,
  projectedShadowOffsetY: 26,
  projectedShadowOpacity: 0.22,
  projectedShadowBlurRadius: 5,

  // Change to "left" to mirror both continuous spiral passes.
  upperReturnFromSide: "right" as "left" | "right",

  // Act 2.3 — Short hidden transition before the lower re-entry.
  secondOffscreenPauseMs: 300,

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

type FlightPathSample = { x: number; y: number; rotation: number };
type ContinuousFlightPath = {
  inputRange: number[];
  x: number[];
  y: number[];
  rotation: number[];
  end: FlightPathSample;
};

/**
 * Reuses the v5 expanding/inward spiral geometry twice in one uninterrupted
 * path. The second spiral begins at the first spiral's exact endpoint, but
 * expands outward from the opposite side so the rocket performs two distinct
 * high-speed passes and exits beyond the far edge without a teleport.
 */
function buildContinuousFlightPath(
  screenWidth: number,
  screenHeight: number,
  rocketWidth: number,
  rocketHeight: number,
  baseLeft: number,
  baseTop: number,
  fromSide: "left" | "right",
): ContinuousFlightPath {
  const centerX = screenWidth * NUKE_MY_BACKLOG_TUNING.flightSpiralCenterXRatio;
  const centerY =
    screenHeight * NUKE_MY_BACKLOG_TUNING.flightSpiralCenterYRatio;
  const turns = NUKE_MY_BACKLOG_TUNING.flightSpiralTurns;
  const totalAngle = Math.PI * 2 * turns;
  const startRadiusX =
    screenWidth * NUKE_MY_BACKLOG_TUNING.flightSpiralStartRadiusXRatio;
  const firstEndRadiusX =
    screenWidth * NUKE_MY_BACKLOG_TUNING.flightSpiralEndRadiusXRatio;
  const startRadiusY =
    screenHeight * NUKE_MY_BACKLOG_TUNING.flightSpiralStartRadiusYRatio;
  const firstEndRadiusY =
    screenHeight * NUKE_MY_BACKLOG_TUNING.flightSpiralEndRadiusYRatio;
  const secondEndRadiusX =
    screenWidth * NUKE_MY_BACKLOG_TUNING.flightSpiralSecondEndRadiusXRatio;
  const secondEndRadiusY =
    screenHeight * NUKE_MY_BACKLOG_TUNING.flightSpiralSecondEndRadiusYRatio;

  const raw: Point[] = [];
  const samplesPerPass = 560;
  const appendSpiral = (
    startAngle: number,
    radiusXFrom: number,
    radiusXTo: number,
    radiusYFrom: number,
    radiusYTo: number,
    skipFirst: boolean,
  ) => {
    for (let index = skipFirst ? 1 : 0; index < samplesPerPass; index += 1) {
      const t = index / (samplesPerPass - 1);
      // Smoothstep has zero radial velocity at both ends, so the inward first
      // pass blends into the outward second pass without a direction snap.
      const radiusT = t * t * (3 - 2 * t);
      const angle = startAngle + totalAngle * t;
      const radiusX = radiusXFrom + (radiusXTo - radiusXFrom) * radiusT;
      const radiusY = radiusYFrom + (radiusYTo - radiusYFrom) * radiusT;
      raw.push({
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
      });
    }
  };

  // First pass: broad inward spiral, right edge to left edge.
  appendSpiral(
    0,
    startRadiusX,
    firstEndRadiusX,
    startRadiusY,
    firstEndRadiusY,
    false,
  );
  // At 1.5 turns the first pass ends at angle 3π (the left side). Continue from
  // that exact point and expand the second pass to exit on the right.
  appendSpiral(
    totalAngle,
    firstEndRadiusX,
    secondEndRadiusX,
    firstEndRadiusY,
    secondEndRadiusY,
    true,
  );

  const directed = raw.map((point) => ({
    x: fromSide === "right" ? point.x : screenWidth - point.x,
    y: point.y,
  }));

  // Arc-length resampling keeps travel speed stable even as the spiral radius
  // changes between its inward and outward passes.
  const cumulative: number[] = [0];
  for (let index = 1; index < directed.length; index += 1) {
    const dx = directed[index].x - directed[index - 1].x;
    const dy = directed[index].y - directed[index - 1].y;
    cumulative.push(cumulative[index - 1] + Math.hypot(dx, dy));
  }

  const totalLength = cumulative[cumulative.length - 1] || 1;
  const sampleCount = 440;
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

      rocketX.setValue(boostX);
      rocketY.setValue(bottomStartY);
      rocketRotation.setValue(0);
      rocketScale.setValue(1);
      rocketBlurProgress.setValue(0);
      startRocketVibration(
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationX,
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationY,
        NUKE_MY_BACKLOG_TUNING.boostLaunchVibrationRotation,
      );

      // playLaunch is called at the start of the 4.5s ascent, not after the
      // acceleration spectacle. The file's ~4.4s duration aligns to this travel.
      void audio.playLaunch();
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
      await audio.startFlightLoop();
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
      setFlightStage("firstOffscreen");
      if (
        !(await waitForFlightStage(
          id,
          NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs,
        ))
      ) {
        return;
      }

      // ACT 2 — Two consecutive v5-style spiral passes. The second starts exactly
      // where the first ends, from the opposite edge and a new spiral angle.
      // Smaller scale + a 4.2s total duration makes both passes substantially faster.
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
      if (!pathOk || id !== runIdRef.current) return;

      // Commit the path's terminal pose before switching back to ordinary values.
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

      // Bottom re-entry is kept as the Act 2 -> camera-approach handoff.
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
      }
    },
    [
      audio,
      flightPathProgress,
      rocketBlurProgress,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
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
      audio.stopAll();
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
  const displayRocketX = flightPathActive ? flightPathX : rocketX;
  const displayRocketY = flightPathActive ? flightPathY : rocketY;
  const displayRocketRotation = flightPathActive
    ? flightPathRotation
    : rocketRotation;

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
  const rocketSharpOpacity = rocketBlurProgress.interpolate({
    inputRange: [0, 0.22, 0.4, 1],
    outputRange: [1, 1, 0.9, 0.68],
    extrapolate: "clamp",
  });
  const rocketBlur02Opacity = rocketBlurProgress.interpolate({
    inputRange: [0, 0.16, 0.28, 0.42],
    outputRange: [0, 0, 0.22, 0],
    extrapolate: "clamp",
  });
  const rocketBlur05Opacity = rocketBlurProgress.interpolate({
    inputRange: [0.28, 0.46, 0.62, 0.78],
    outputRange: [0, 0.22, 0.22, 0],
    extrapolate: "clamp",
  });
  const rocketBlur08Opacity = rocketBlurProgress.interpolate({
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
            <Animated.Image
              /* pointerEvents="none" */
              source={rocketAsset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              blurRadius={NUKE_MY_BACKLOG_TUNING.projectedShadowBlurRadius}
              style={{
                position: "absolute",
                left:
                  rocketLeft + NUKE_MY_BACKLOG_TUNING.projectedShadowOffsetX,
                top: rocketTop + NUKE_MY_BACKLOG_TUNING.projectedShadowOffsetY,
                width: rocketWidth,
                height: rocketHeight,
                tintColor: "#243A50",
                opacity: NUKE_MY_BACKLOG_TUNING.projectedShadowOpacity,
                zIndex: 1,
                transform: [
                  { translateX: displayRocketX },
                  { translateY: displayRocketY },
                  { rotate: rotation },
                  { scale: rocketScale },
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
              height: flightMode ? anchor.canvasHeight : Math.max(0, anchor.y),
            },
          ]}
        >
          {/* Act 0.5 — ignition glow remains anchored to the row during the hold. */}
          {ignitionVisible && !flightMode && (
            <Animated.View
              style={{
                position: "absolute",
                left: glowLeft,
                top: glowTop,
                width: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
                height: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize,
                borderRadius: NUKE_MY_BACKLOG_TUNING.ignitionGlowSize / 2,
                backgroundColor: "#FF8A24",
                opacity: ignitionGlowOpacity,
                transform: [{ scale: ignitionGlowScale }],
                shadowColor: "#FF6A00",
                shadowOpacity: 0.9,
                shadowRadius: 18,
                zIndex: 0,
              }}
            />
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
              transform: [
                { translateX: displayRocketX },
                { translateY: displayRocketY },
                { rotate: rotation },
                { scale: rocketScale },
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
                zIndex: 2,
              }}
            />
          </Animated.View>
        </View>
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
