import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";
import {
  useNukeMyBacklogAudio,
  NUKE_AUDIO_TUNING,
} from "./use-nuke-my-backlog-audio";

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
 * Implements Act 0 (manual pumping), Act 1 (vertical launch), and the pre-3D
 * Act 2 flight choreography. Act 3 will continue from the final centred pose.
 *
 * Layering mirrors the working Hello There architecture:
 * - Render `behindLayer` AFTER normal search content.
 * - Its transparent viewport ends at the top edge of the Easter egg row.
 * - The row remains independently pressable while pumping is active.
 *
 * Asset expectation:
 *   @/assets/easter-eggs/rocket.png
 * Use the user's newest cropped rocket image at this path.
 */
const rocketAsset = require("@/assets/easter-eggs/nuke-backlog-assets/rocket.png");

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

  // Act 1.2 — Initial vertical launch. Larger duration = slower, heavier liftoff.
  launchVerticalDurationMs: 1180,
  launchOffscreenMarginDp: 72,

  // Act 2.1 — Off-screen first pass and audio distance cue.
  // The flight loop starts once the rocket has cleared the top. It remains
  // steady for 4.5 seconds, then fades down to sound distant.
  firstOffscreenHoldMs: 4500,

  // Act 2.2 — Return from the upper side of the screen.
  // Change to "left" to reverse the side from which the rocket re-enters.
  upperReturnFromSide: "right" as "left" | "right",
  upperReturnTopRatio: 0.13,
  upperReturnXRatio: 0.76,
  upperReturnDurationMs: 1550,
  upperPassMidXRatio: 0.46,
  upperPassMidYRatio: 0.29,
  upperPassMidDurationMs: 2050,
  upperPassExitYRatio: 0.43,
  upperPassExitDurationMs: 850,
  upperPassBankDegrees: 16,
  upperExitOffscreenMarginDp: 70,

  // Act 2.3 — Short hidden transition before the lower re-entry.
  secondOffscreenPauseMs: 420,

  // Act 2.4 — Final bottom-to-middle pass. This stops at the pre-3D pose;
  // Act 3 will take over from this exact point for the Z-depth/camera approach.
  bottomEntryXRatio: 0.5,
  bottomEntryStartMarginDp: 90,
  bottomEntryEndCenterYRatio: 0.5,
  bottomEntryDurationMs: 2250,
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

export function useNukeMyBacklogAnimation(): AnimationController {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<NukeAnchor | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [ignitionVisible, setIgnitionVisible] = useState(false);
  const [flightMode, setFlightMode] = useState(false);
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
  const audio = useNukeMyBacklogAudio();
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rocketY = useRef(new Animated.Value(0)).current;
  const rocketX = useRef(new Animated.Value(0)).current;
  const rocketRotation = useRef(new Animated.Value(0)).current;
  const rocketScale = useRef(new Animated.Value(1)).current;
  const ignitionGlowOpacity = useRef(new Animated.Value(0)).current;
  const ignitionGlowScale = useRef(new Animated.Value(0.72)).current;

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
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      audio.stopAll();

      activeRef.current = false;
      phaseRef.current = null;
      pendingTapTimesRef.current = [];
      setActive(false);
      setAnchor(null);
      setHintVisible(false);
      setIgnitionVisible(false);
      setFlightMode(false);
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

      // Act 1.1 — Switch to a full-screen flight viewport only after the rocket
      // has completed the manual pump and ignition beat. The pumping phase still
      // uses the row-top clipping boundary.
      phaseRef.current = "launching";
      setFlightStage("launching");
      setFlightMode(true);
      setFlameActive(true);
      setFlameFrameStep(0);
      setIgnitionVisible(false);
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;

      // Act 1.2 — Vertical launch. The rocket starts at its current row-aligned
      // position and accelerates straight upwards until its entire canvas clears
      // the top of the screen.
      const fullyOffscreenTop =
        -rocketHeight - NUKE_MY_BACKLOG_TUNING.launchOffscreenMarginDp;
      const launchOffscreenY = fullyOffscreenTop - baseTop;
      const launchOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketY,
          toValue: launchOffscreenY,
          duration: NUKE_MY_BACKLOG_TUNING.launchVerticalDurationMs,
          easing: Easing.in(Easing.cubic),
        },
        {
          value: rocketX,
          toValue: 0,
          duration: NUKE_MY_BACKLOG_TUNING.launchVerticalDurationMs,
          easing: Easing.in(Easing.cubic),
        },
        {
          value: rocketRotation,
          toValue: 0,
          duration: NUKE_MY_BACKLOG_TUNING.launchVerticalDurationMs,
        },
      ]);
      if (!launchOk || id !== runIdRef.current) return;

      // Act 2.1 — The rocket is now off-screen. Start the continuous flight bed.
      // After 4.5 seconds it will sound farther away, then grow louder on return.
      phaseRef.current = "firstOffscreen";
      setFlightStage("firstOffscreen");
      audio.startFlightLoop();
      if (
        !(await waitForFlightStage(
          id,
          NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs,
        ))
      )
        return;
      audio.fadeFlightTo(
        NUKE_AUDIO_TUNING.flightAwayVolume,
        NUKE_AUDIO_TUNING.flightAwayFadeMs,
      );
      if (!(await waitForFlightStage(id, NUKE_AUDIO_TUNING.flightAwayFadeMs)))
        return;

      // Act 2.2 — Quiet re-entry from the upper-right (or upper-left if changed
      // in TUNING). The rocket banks slightly into its path, then follows one
      // broad, smooth arc across the upper portion of the screen.
      const enteringFromRight = side === "right";
      const outsideStartLeft = enteringFromRight
        ? screenWidth + rocketWidth * 0.45
        : -rocketWidth * 1.45;
      const upperEntryLeft =
        screenWidth *
          (enteringFromRight
            ? NUKE_MY_BACKLOG_TUNING.upperReturnXRatio
            : 1 - NUKE_MY_BACKLOG_TUNING.upperReturnXRatio) -
        rocketWidth / 2;
      const upperEntryTop =
        screenHeight * NUKE_MY_BACKLOG_TUNING.upperReturnTopRatio;
      const bankSign = enteringFromRight ? -1 : 1;

      rocketX.setValue(outsideStartLeft - baseLeft);
      rocketY.setValue(upperEntryTop - baseTop);
      rocketRotation.setValue(bankSign * 22);
      phaseRef.current = "upperReturn";
      setFlightStage("upperReturn");
      audio.fadeFlightTo(
        NUKE_AUDIO_TUNING.flightApproachVolume,
        NUKE_AUDIO_TUNING.flightApproachFadeMs,
      );

      const upperEntryOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketX,
          toValue: upperEntryLeft - baseLeft,
          duration: NUKE_MY_BACKLOG_TUNING.upperReturnDurationMs,
        },
        {
          value: rocketY,
          toValue: upperEntryTop - baseTop,
          duration: NUKE_MY_BACKLOG_TUNING.upperReturnDurationMs,
        },
        {
          value: rocketRotation,
          toValue: bankSign * 10,
          duration: NUKE_MY_BACKLOG_TUNING.upperReturnDurationMs,
        },
      ]);
      if (!upperEntryOk || id !== runIdRef.current) return;

      // Act 2.3 — Cross the upper-middle on a single shallow diagonal.
      const passMidLeft =
        screenWidth * NUKE_MY_BACKLOG_TUNING.upperPassMidXRatio -
        rocketWidth / 2;
      const passMidTop =
        screenHeight * NUKE_MY_BACKLOG_TUNING.upperPassMidYRatio;
      const crossOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketX,
          toValue: passMidLeft - baseLeft,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassMidDurationMs,
        },
        {
          value: rocketY,
          toValue: passMidTop - baseTop,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassMidDurationMs,
        },
        {
          value: rocketRotation,
          toValue: bankSign * NUKE_MY_BACKLOG_TUNING.upperPassBankDegrees,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassMidDurationMs,
        },
      ]);
      if (!crossOk || id !== runIdRef.current) return;

      // Act 2.4 — Complete the pass and leave the screen from the opposite side.
      // This is the second full off-screen exit requested before bottom re-entry.
      phaseRef.current = "secondExit";
      setFlightStage("secondExit");
      audio.fadeFlightTo(
        NUKE_AUDIO_TUNING.flightSecondPassVolume,
        NUKE_AUDIO_TUNING.flightSecondPassFadeMs,
      );
      const exitLeft = enteringFromRight
        ? -rocketWidth - NUKE_MY_BACKLOG_TUNING.upperExitOffscreenMarginDp
        : screenWidth + NUKE_MY_BACKLOG_TUNING.upperExitOffscreenMarginDp;
      const exitTop = screenHeight * NUKE_MY_BACKLOG_TUNING.upperPassExitYRatio;
      const exitOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketX,
          toValue: exitLeft - baseLeft,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassExitDurationMs,
          easing: Easing.in(Easing.cubic),
        },
        {
          value: rocketY,
          toValue: exitTop - baseTop,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassExitDurationMs,
        },
        {
          value: rocketRotation,
          toValue: bankSign * 8,
          duration: NUKE_MY_BACKLOG_TUNING.upperPassExitDurationMs,
        },
      ]);
      if (!exitOk || id !== runIdRef.current) return;

      // Act 2.5 — Hide the rocket briefly, then bring it in from below the screen.
      if (
        !(await waitForFlightStage(
          id,
          NUKE_MY_BACKLOG_TUNING.secondOffscreenPauseMs,
        ))
      )
        return;
      const bottomEntryLeft =
        screenWidth * NUKE_MY_BACKLOG_TUNING.bottomEntryXRatio -
        rocketWidth / 2;
      const bottomEntryTop =
        screenHeight + NUKE_MY_BACKLOG_TUNING.bottomEntryStartMarginDp;
      rocketX.setValue(bottomEntryLeft - baseLeft);
      rocketY.setValue(bottomEntryTop - baseTop);
      rocketRotation.setValue(
        NUKE_MY_BACKLOG_TUNING.bottomEntryRotationDegrees,
      );

      phaseRef.current = "bottomEntry";
      setFlightStage("bottomEntry");
      audio.fadeFlightTo(NUKE_AUDIO_TUNING.flightApproachVolume, 1100);
      const finalTop =
        screenHeight * NUKE_MY_BACKLOG_TUNING.bottomEntryEndCenterYRatio -
        rocketHeight / 2;
      const bottomEntryOk = await runFlightValues(id, runIdRef, [
        {
          value: rocketX,
          toValue: bottomEntryLeft - baseLeft,
          duration: NUKE_MY_BACKLOG_TUNING.bottomEntryDurationMs,
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
      ]);
      if (!bottomEntryOk || id !== runIdRef.current) return;

      // Act 2 ends here. Keep the rocket and flight loop alive at the centre of
      // the screen. Act 3 will continue from this exact pose with the perspective
      // / Z-depth turn toward the viewer. The activation lock intentionally stays held.
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
    [audio, rocketRotation, rocketX, rocketY, waitForFlightStage],
  );

  const triggerIgnition = useCallback(
    (id: number) => {
      if (id !== runIdRef.current || phaseRef.current !== "pumping") return;
      phaseRef.current = "igniting";
      setFlightStage("igniting");
      clearTimers();
      audio.playLaunch();
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
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
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
    ignitionGlowOpacity.stopAnimation();
    ignitionGlowScale.stopAnimation();
    ignitionGlowLoopRef.current?.stop();
    ignitionGlowLoopRef.current = null;
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
    rocketX,
    rocketY,
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
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
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
    rocketX,
    rocketY,
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

  const glowLeft =
    rocketLeft + rocketWidth / 2 - NUKE_MY_BACKLOG_TUNING.ignitionGlowSize / 2;
  const glowTop = anchor
    ? anchor.y - NUKE_MY_BACKLOG_TUNING.ignitionGlowSize * 0.62
    : 0;

  const rotation = rocketRotation.interpolate({
    inputRange: [-45, 45],
    outputRange: ["-45deg", "45deg"],
    extrapolate: "clamp",
  });

  const activeFlameFrame = FLAME_FRAME_SEQUENCE[flameFrameStep] ?? 0;
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
                { translateX: rocketX },
                { translateY: rocketY },
                { rotate: rotation },
                { scale: rocketScale },
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
                zIndex: 1,
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
