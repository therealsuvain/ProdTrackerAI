import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type NukeAnchor = Rect & { rocketWidth: number; rocketHeight: number };
type MeasurableRef = React.RefObject<View | null>;
type Phase = "measuring" | "pumping" | "igniting" | null;

type PressCallbacks = {
  /** Called synchronously on the first accepted press of this pumping session. */
  onFirstPress?: () => void;
  /** Called once when the pumping/ignition phase completes or is cancelled. */
  onFinished?: () => void;
};

/**
 * Nuke My Backlog — Act 0: manual rocket pumping.
 *
 * This file deliberately implements ONLY the interactive pump + ignition-ready
 * handoff. The autonomous launch/camera approach, explosion, smoke and crash
 * sequence will be added in later acts without changing this pump controller.
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

  // Accessibility fallback. Reduced motion keeps the same interaction but removes spring overshoot.
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

  const rocketY = useRef(new Animated.Value(0)).current;
  const ignitionGlowOpacity = useRef(new Animated.Value(0)).current;
  const ignitionGlowScale = useRef(new Animated.Value(0.72)).current;

  const clearTimers = useCallback(() => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    if (hintHideTimerRef.current) clearTimeout(hintHideTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (idleSagTimerRef.current) clearTimeout(idleSagTimerRef.current);
    hintTimerRef.current = null;
    hintHideTimerRef.current = null;
    finishTimerRef.current = null;
    idleSagTimerRef.current = null;
  }, []);

  const finishSession = useCallback(
    (id: number) => {
      if (id !== runIdRef.current) return;
      clearTimers();
      rocketY.stopAnimation();
      ignitionGlowOpacity.stopAnimation();
      ignitionGlowScale.stopAnimation();

      activeRef.current = false;
      phaseRef.current = null;
      pendingTapTimesRef.current = [];
      setActive(false);
      setAnchor(null);
      setHintVisible(false);
      setIgnitionVisible(false);

      hintShownRef.current = false;
      sessionStartTimeRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [clearTimers, ignitionGlowOpacity, ignitionGlowScale, rocketY],
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

        // Small glow is intentionally the only ignition artwork in Act 0.
        // The flame sprites and autonomous rocket flight belong to Act 1.
        Animated.loop(
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
        ).start();

        finishTimerRef.current = setTimeout(
          () => finishSession(id),
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
        setAnchor({ ...localRow, rocketWidth, rocketHeight });
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
    ignitionGlowOpacity.stopAnimation();
    ignitionGlowScale.stopAnimation();
    activeRef.current = false;
    phaseRef.current = null;
    pendingTapTimesRef.current = [];
    hintShownRef.current = false;
    sessionStartTimeRef.current = null;
    setActive(false);
    setAnchor(null);
    setHintVisible(false);
    setIgnitionVisible(false);
    const callback = callbacksRef.current.onFinished;
    callbacksRef.current = {};
    callback?.();
  }, [clearTimers, ignitionGlowOpacity, ignitionGlowScale, rocketY]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      strokeIdRef.current += 1;
      clearTimers();
      rocketY.stopAnimation();
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
  }, [clearTimers, ignitionGlowOpacity, ignitionGlowScale, rocketY]);

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
          style={[styles.rocketClip, { height: Math.max(0, anchor.y) }]}
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

          <Animated.Image
            source={rocketAsset as ImageSourcePropType}
            resizeMode="stretch"
            fadeDuration={0}
            style={{
              position: "absolute",
              zIndex: 1,
              left: rocketLeft,
              top: rocketTop,
              width: rocketWidth,
              height: rocketHeight,
              transform: [{ translateY: rocketY }],
            }}
          />
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
