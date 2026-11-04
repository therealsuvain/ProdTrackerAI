import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

import { useNukeMyBacklogAudio } from "./nuke-my-backlog-audio";

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
  | "flying"
  | null;

type PressCallbacks = {
  /** Called synchronously on the first accepted press of this pumping session. */
  onFirstPress?: () => void;
  /** Called once when the pumping/ignition phase completes or is cancelled. */
  onFinished?: () => void;
};

/**
 * Nuke My Backlog — Act 0 + Act 1.
 *
 * Act 0 owns manual pumping and the ignition-ready beat. Act 1 takes over the
 * same measured rocket layer for liftoff, the off-screen return, upper-screen
 * flyby and bottom re-entry. The camera approach / impact sequence is the next
 * handoff and will continue using these same transform values.
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
const flame1 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_1.png");
const flame2 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_2.png");
const flame3 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_3.png");
const flame4 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_4.png");
const flame5 = require("@/assets/easter-eggs/nuke-backlog-assets/flame_5.png");

// Add the remaining four flame requires here when those frames are ready.
const FLAME_FRAMES: ImageSourcePropType[] = [
  flame1,
  flame2,
  flame3,
  flame4,
  flame5,
];
const FLAME_FRAME_DURATION_MS = 110;
const FLAME_SOURCE_WIDTH = 479;
const FLAME_SOURCE_HEIGHT = 623;

const ROCKET_SOURCE_WIDTH = 654;
const ROCKET_SOURCE_HEIGHT = 1912;
const ROCKET_ASPECT_RATIO = ROCKET_SOURCE_HEIGHT / ROCKET_SOURCE_WIDTH;

/**
 * Central tuning surface. Values are dp / ms unless their name says Ratio.
 * Pumping progression is intentionally tuned to reward a quick rhythm while
 * still allowing slower taps to make some progress.
 */
export const NUKE_MY_BACKLOG_TUNING = {
  // Act 0.1 — Rocket composition.
  // Increase width ratio to make the rocket larger. Height follows the source ratio.
  rocketWidthRatio: 0.15,
  rocketMaxWidth: 112,
  rocketMinWidth: 58,
  rocketHiddenStartOffset: 3,
  rocketHorizontalCenterRatio: 0.5,

  // Act 0.2 — Pump pressure.
  // Base progress each tap. This still gives slow tapping some forward movement.
  pumpBaseProgressDp: 6, //11,
  // Additional progress at full pressure. Higher = faster emergence during rapid tapping.
  pumpPressureProgressDp: 3, //19,
  // Pressure added by every accepted tap.
  pressureGainPerTap: 0.2, //0.25,
  // Extra pressure reward when the next tap arrives inside the fast-tap window.
  rapidTapPressureBonus: 0.16,
  rapidTapWindowMs: 150, //430,
  // Pressure naturally decays between taps. Lower values make rhythm more important.
  pressureDecayMs: 400, //1050,
  maxPressure: 1,

  // Act 0.3 — Gravity / recoil.
  // A pause longer than this starts losing some accumulated upward progress.
  progressGraceMs: 50, //420,
  progressGravityDpPerMs: 0.018,
  maxProgressLossPerTapDp: 10000, //28,
  // The stroke briefly rises beyond its new resting point, then recoils down.
  pumpUpstrokeOvershootDp: 1, //9,
  pumpRecoilDp: 0, //5,
  // After the main recoil, the rocket slowly sinks a little while the user pauses.
  idleRecoilDelayMs: 100, //360,
  idleSagDp: 1, //12,
  pumpRiseSpringSpeed: 18,
  pumpRiseSpringBounciness: 7,
  pumpRecoilMs: 50, //190,
  idleSagMs: 25, //420,

  // Act 0.4 — Hint. It only appears if the user has not already reached launch.
  hintDelayMs: 0, //2500,
  hintVisibleMs: 12000,
  // Require a few attempts before revealing the instruction; one accidental tap
  // followed by a pause should not immediately expose the hidden mechanic.
  hintMinTapCount: 3,
  hintOnlyBeforeProgressRatio: 0.72,

  // Act 0.5 — Automatic ignition-ready beat.
  ignitionSpringSpeed: 16,
  ignitionSpringBounciness: 4,
  ignitionHoldMs: 700,
  ignitionGlowSize: 38,
  ignitionGlowOpacity: 0.72,
  ignitionGlowPulseMs: 190,

  // Act 1.1 — Liftoff.
  launchAscentMs: 3500, //1450,
  launchOffscreenMargin: 200, //36,
  launchScale: 1.04,

  // Act 1.2 — First off-screen interval and audio perspective.
  firstOffscreenHoldMs: 4500,
  flightFadeDownMs: 1800,
  flightFadeUpMs: 2400,
  flightDistantVolume: 0.12,
  flightNearVolume: 0.86,

  // Act 1.3 — Upper-screen flyby.
  upperEntryMs: 2300,
  upperExitMs: 1900,
  upperEntryXRatio: 0.58,
  upperEntryYRatio: 0.17,
  upperExitYRatio: 0.39,
  upperEntryRotationDeg: -58,
  upperExitRotationDeg: 52,
  secondOffscreenPauseMs: 380,

  // Act 1.4 — Bottom re-entry and handoff to the camera approach.
  bottomEntryMs: 1900,
  bottomEntryXRatio: 0.5,
  bottomEntryYRatio: 0.46,
  bottomEntryScale: 1.06,

  // Flame sprite placement. Ratios are relative to the rocket's rendered width.
  flameWidthRatio: 0.76,
  flameEngineOverlapDp: 2, //5,

  // Accessibility fallback.
  reducedMotionFlightScale: 1,
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

export function useNukeMyBacklogAnimation(): AnimationController {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<NukeAnchor | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [ignitionVisible, setIgnitionVisible] = useState(false);
  const [flameVisible, setFlameVisible] = useState(false);
  const [flameFrameIndex, setFlameFrameIndex] = useState(0);
  const [flightActive, setFlightActive] = useState(false);
  const audio = useNukeMyBacklogAudio();

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
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleSagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightFadeDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const flightFadeUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const flameFrameTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const flightReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const rocketLeftRef = useRef(0);
  const anchorRef = useRef<NukeAnchor | null>(null);
  const flightDelayResolveRef = useRef<((finished: boolean) => void) | null>(
    null,
  );

  const rocketY = useRef(new Animated.Value(0)).current;
  const rocketX = useRef(new Animated.Value(0)).current;
  const rocketRotation = useRef(new Animated.Value(0)).current;
  const rocketScale = useRef(new Animated.Value(1)).current;
  const ignitionGlowOpacity = useRef(new Animated.Value(0)).current;
  const ignitionGlowScale = useRef(new Animated.Value(0.72)).current;
  const ignitionGlowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const clearTimers = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (idleSagTimerRef.current) clearTimeout(idleSagTimerRef.current);
    if (flightFadeDownTimerRef.current)
      clearTimeout(flightFadeDownTimerRef.current);
    if (flightFadeUpTimerRef.current)
      clearTimeout(flightFadeUpTimerRef.current);
    if (flightReturnTimerRef.current)
      clearTimeout(flightReturnTimerRef.current);
    flightDelayResolveRef.current?.(false);
    flightDelayResolveRef.current = null;
    if (flameFrameTimerRef.current) clearInterval(flameFrameTimerRef.current);
    hintTimerRef.current = null;
    hintHideTimerRef.current = null;
    finishTimerRef.current = null;
    idleSagTimerRef.current = null;
    flightFadeDownTimerRef.current = null;
    flightFadeUpTimerRef.current = null;
    flightReturnTimerRef.current = null;
    flameFrameTimerRef.current = null;
  }, []);

  const finishSession = useCallback(
    (id: number) => {
      if (id !== runIdRef.current) return;
      clearTimers();
      rocketY.stopAnimation();
      rocketX.stopAnimation();
      rocketRotation.stopAnimation();
      rocketScale.stopAnimation();
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();

      activeRef.current = false;
      phaseRef.current = null;
      pendingTapTimesRef.current = [];
      setActive(false);
      setAnchor(null);
      anchorRef.current = null;
      setHintVisible(false);
      setIgnitionVisible(false);
      setFlameVisible(false);
      setFlightActive(false);
      setFlameFrameIndex(0);
      audio.stopAll();

      hintShownRef.current = false;
      sessionStartTimeRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [
      clearTimers,
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketY,
      rocketX,
      rocketRotation,
      rocketScale,
      audio.stopAll,
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

  const waitForFlightDelay = useCallback((durationMs: number, id: number) => {
    return new Promise<boolean>((resolve) => {
      flightDelayResolveRef.current = resolve;
      flightReturnTimerRef.current = setTimeout(() => {
        flightReturnTimerRef.current = null;
        flightDelayResolveRef.current = null;
        resolve(id === runIdRef.current);
      }, durationMs);
    });
  }, []);

  const startFlameLoop = useCallback(() => {
    if (flameFrameTimerRef.current) clearInterval(flameFrameTimerRef.current);
    setFlameVisible(true);
    setFlameFrameIndex(0);
    if (FLAME_FRAMES.length <= 1) return;
    flameFrameTimerRef.current = setInterval(() => {
      setFlameFrameIndex((current) => (current + 1) % FLAME_FRAMES.length);
    }, FLAME_FRAME_DURATION_MS);
  }, []);

  const startFlight = useCallback(
    async (id: number) => {
      const flightAnchor = anchorRef.current;
      if (id !== runIdRef.current || !flightAnchor) return;
      phaseRef.current = "launching";
      setFlightActive(true);
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      setIgnitionVisible(false);
      startFlameLoop();
      audio.playLaunch();
      void audio.startFlightLoop();

      const { canvasWidth, canvasHeight, rocketWidth, rocketHeight } =
        flightAnchor;
      const rocketTop =
        flightAnchor.y + NUKE_MY_BACKLOG_TUNING.rocketHiddenStartOffset;
      const offscreenY =
        -rocketTop -
        rocketHeight -
        NUKE_MY_BACKLOG_TUNING.launchOffscreenMargin;
      const distantY =
        canvasHeight * NUKE_MY_BACKLOG_TUNING.upperEntryYRatio - rocketTop;
      const entryX =
        canvasWidth * NUKE_MY_BACKLOG_TUNING.upperEntryXRatio -
        rocketWidth / 2 -
        rocketLeftRef.current;
      const exitX = -rocketWidth - rocketLeftRef.current - 24;
      const bottomY = canvasHeight + rocketHeight - rocketTop + 24;
      const middleY =
        canvasHeight * NUKE_MY_BACKLOG_TUNING.bottomEntryYRatio - rocketTop;
      const reduced = reduceMotionRef.current;
      const ascentDuration = reduced
        ? NUKE_MY_BACKLOG_TUNING.reducedMotionPumpMs
        : NUKE_MY_BACKLOG_TUNING.launchAscentMs;

      // Act 1.1: climb vertically and disappear completely above the viewport.
      const liftedOff = await animate(
        Animated.parallel([
          Animated.timing(rocketY, {
            toValue: offscreenY,
            duration: ascentDuration,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketScale, {
            toValue: reduced
              ? NUKE_MY_BACKLOG_TUNING.reducedMotionFlightScale
              : NUKE_MY_BACKLOG_TUNING.launchScale,
            duration: ascentDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        id,
      );
      if (!liftedOff || id !== runIdRef.current) return;

      phaseRef.current = "flying";
      // The rocket stays out of sight for 4.5s. The flight bed first recedes,
      // then grows louder while the side re-entry is underway.
      flightFadeDownTimerRef.current = setTimeout(
        () =>
          audio.fadeFlightTo(
            NUKE_MY_BACKLOG_TUNING.flightDistantVolume,
            NUKE_MY_BACKLOG_TUNING.flightFadeDownMs,
          ),
        NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs,
      );
      flightFadeUpTimerRef.current = setTimeout(
        () =>
          audio.fadeFlightTo(
            NUKE_MY_BACKLOG_TUNING.flightNearVolume,
            NUKE_MY_BACKLOG_TUNING.flightFadeUpMs,
          ),
        NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs +
          NUKE_MY_BACKLOG_TUNING.flightFadeDownMs,
      );

      const upperEntry = Animated.parallel([
        Animated.timing(rocketX, {
          toValue: entryX,
          duration: NUKE_MY_BACKLOG_TUNING.upperEntryMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rocketY, {
          toValue: distantY,
          duration: NUKE_MY_BACKLOG_TUNING.upperEntryMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rocketRotation, {
          toValue: -58,
          duration: NUKE_MY_BACKLOG_TUNING.upperEntryMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rocketScale, {
          toValue: 0.92,
          duration: NUKE_MY_BACKLOG_TUNING.upperEntryMs,
          useNativeDriver: true,
        }),
      ]);

      // Begin the return after the same 4.5s away-time + fade-down interval.
      const returnReady = await waitForFlightDelay(
        NUKE_MY_BACKLOG_TUNING.firstOffscreenHoldMs +
          NUKE_MY_BACKLOG_TUNING.flightFadeDownMs,
        id,
      );
      if (!returnReady || id !== runIdRef.current) return;
      // Reposition while still off-screen so the rocket genuinely enters from
      // beyond the right edge instead of sliding out of its original center lane.
      rocketX.setValue(canvasWidth + 24 - rocketLeftRef.current);
      rocketY.setValue(distantY);
      rocketRotation.setValue(NUKE_MY_BACKLOG_TUNING.upperEntryRotationDeg);
      rocketScale.setValue(0.92);
      const entered = await animate(upperEntry, id);
      if (!entered || id !== runIdRef.current) return;

      // One restrained sweeping pass across the upper half, then off the opposite edge.
      const exited = await animate(
        Animated.parallel([
          Animated.timing(rocketX, {
            toValue: exitX,
            duration: NUKE_MY_BACKLOG_TUNING.upperExitMs,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketY, {
            toValue:
              canvasHeight * NUKE_MY_BACKLOG_TUNING.upperExitYRatio - rocketTop,
            duration: NUKE_MY_BACKLOG_TUNING.upperExitMs,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketRotation, {
            toValue: NUKE_MY_BACKLOG_TUNING.upperExitRotationDeg,
            duration: NUKE_MY_BACKLOG_TUNING.upperExitMs,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        id,
      );
      if (!exited || id !== runIdRef.current) return;

      const bottomReady = await waitForFlightDelay(
        NUKE_MY_BACKLOG_TUNING.secondOffscreenPauseMs,
        id,
      );
      if (!bottomReady || id !== runIdRef.current) return;

      // Reset orientation off-screen, then rise from the bottom to the middle.
      rocketX.setValue(
        canvasWidth * NUKE_MY_BACKLOG_TUNING.bottomEntryXRatio -
          rocketWidth / 2 -
          rocketLeftRef.current,
      );
      rocketY.setValue(bottomY);
      rocketRotation.setValue(0);
      rocketScale.setValue(NUKE_MY_BACKLOG_TUNING.bottomEntryScale);

      await animate(
        Animated.parallel([
          Animated.timing(rocketY, {
            toValue: middleY,
            duration: NUKE_MY_BACKLOG_TUNING.bottomEntryMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rocketScale, {
            toValue: 1,
            duration: NUKE_MY_BACKLOG_TUNING.bottomEntryMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        id,
      );
      if (id !== runIdRef.current) return;

      // Act 1 ends here. Act 2 will take over these same transform values for
      // the Z-axis pitch and camera approach, without remounting the rocket.
      finishSession(id);
    },
    [
      animate,
      audio,
      finishSession,
      rocketRotation,
      rocketScale,
      rocketX,
      rocketY,
      startFlameLoop,
      waitForFlightDelay,
    ],
  );

  const triggerIgnition = useCallback(
    (id: number) => {
      if (id !== runIdRef.current || phaseRef.current !== "pumping") return;
      phaseRef.current = "igniting";
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

        // The ignition glow bridges Act 0 into the autonomous launch.
        // Act 1 replaces it with the engine flame sprite.
        ignitionGlowLoopRef.current = Animated.loop(
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
        ignitionGlowLoopRef.current.start();

        finishTimerRef.current = setTimeout(
          () => startFlight(id),
          NUKE_MY_BACKLOG_TUNING.ignitionHoldMs,
        );
      });
    },
    [
      clearTimers,
      finishSession,
      ignitionGlowOpacity,
      ignitionGlowScale,
      rocketY,
      startFlight,
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
              toValue: 0 /* -Math.max(
                0,
                progressRef.current - NUKE_MY_BACKLOG_TUNING.idleSagDp,
              ), */,
              duration: progressRef.current * NUKE_MY_BACKLOG_TUNING.idleSagMs,
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

        requiredTravelRef.current = requiredTravel;
        pressureRef.current = 0;
        progressRef.current = 0;
        tapCountRef.current = 0;
        lastTapTimeRef.current = null;
        rocketY.setValue(0);
        ignitionGlowOpacity.setValue(0);
        ignitionGlowScale.setValue(0.72);
        const rocketLeft =
          localRow.x +
          localRow.width * NUKE_MY_BACKLOG_TUNING.rocketHorizontalCenterRatio -
          rocketWidth / 2;
        rocketLeftRef.current = rocketLeft;
        rocketX.setValue(0);
        rocketRotation.setValue(0);
        rocketScale.setValue(1);
        const measuredAnchor: NukeAnchor = {
          ...localRow,
          rocketWidth,
          rocketHeight,
          canvasWidth: canvasWindowRect.width,
          canvasHeight: canvasWindowRect.height,
        };
        anchorRef.current = measuredAnchor;
        setAnchor(measuredAnchor);
        phaseRef.current = "pumping";

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
      rocketY,
      rocketX,
      rocketRotation,
      rocketScale,
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
        setFlameVisible(false);
        setFlightActive(false);
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
    audio.stopAll();
    ignitionGlowLoopRef.current?.stop();
    ignitionGlowLoopRef.current = null;
    ignitionGlowOpacity.stopAnimation();
    ignitionGlowScale.stopAnimation();
    activeRef.current = false;
    phaseRef.current = null;
    pendingTapTimesRef.current = [];
    hintShownRef.current = false;
    sessionStartTimeRef.current = null;
    setActive(false);
    setAnchor(null);
    anchorRef.current = null;
    setHintVisible(false);
    setIgnitionVisible(false);
    setFlameVisible(false);
    setFlightActive(false);
    const callback = callbacksRef.current.onFinished;
    callbacksRef.current = {};
    callback?.();
  }, [
    clearTimers,
    ignitionGlowOpacity,
    ignitionGlowScale,
    rocketY,
    rocketX,
    rocketRotation,
    rocketScale,
    audio.stopAll,
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
      audio.stopAll();
      ignitionGlowLoopRef.current?.stop();
      ignitionGlowLoopRef.current = null;
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();
      activeRef.current = false;
      phaseRef.current = null;
      hintShownRef.current = false;
      sessionStartTimeRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    };
  }, [
    clearTimers,
    ignitionGlowOpacity,
    ignitionGlowScale,
    rocketY,
    rocketX,
    rocketRotation,
    rocketScale,
    audio.stopAll,
  ]);

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
              height: flightActive
                ? anchor.canvasHeight
                : Math.max(0, anchor.y),
              overflow: flightActive ? "visible" : "hidden",
            },
          ]}
        >
          {ignitionVisible && (
            // Glow is rendered BEHIND the rocket, around the engine edge.
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

          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: rocketLeft,
              top: rocketTop,
              width: rocketWidth,
              height: rocketHeight,
              zIndex: 1,
              transform: [
                { translateX: rocketX },
                { translateY: rocketY },
                {
                  rotate: rocketRotation.interpolate({
                    inputRange: [-180, 180],
                    outputRange: ["-180deg", "180deg"],
                  }),
                },
                { scale: rocketScale },
              ],
            }}
          >
            {flameVisible && (
              <Animated.Image
                source={FLAME_FRAMES[flameFrameIndex]}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  zIndex: 0,
                  width: rocketWidth * NUKE_MY_BACKLOG_TUNING.flameWidthRatio,
                  height:
                    (rocketWidth *
                      NUKE_MY_BACKLOG_TUNING.flameWidthRatio *
                      FLAME_SOURCE_HEIGHT) /
                    FLAME_SOURCE_WIDTH,
                  left:
                    (rocketWidth -
                      rocketWidth * NUKE_MY_BACKLOG_TUNING.flameWidthRatio) /
                    2,
                  top:
                    rocketHeight - NUKE_MY_BACKLOG_TUNING.flameEngineOverlapDp,
                }}
              />
            )}
            <Animated.Image
              source={rocketAsset as ImageSourcePropType}
              resizeMode="stretch"
              fadeDuration={0}
              style={{
                position: "absolute",
                zIndex: 1,
                left: 0,
                top: 0,
                width: rocketWidth,
                height: rocketHeight,
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
    hintText: hintVisible ? "Keep tapping to build up pressure!!!" : undefined,
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
