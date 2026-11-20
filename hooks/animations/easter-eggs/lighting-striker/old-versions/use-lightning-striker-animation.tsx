import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { AudioSource } from "expo-audio";

import { LIGHTNING_STRIKER_TUNING } from "./lightning-config-v3";
import { generateLightningStrike } from "../lightning-generator";
import type { LightningGeneratorConfig } from "./lightning-config-v3";
import { LightningCanvas } from "./lightning-canvas";
import type { LightningStrike } from "./lightning-types-v4";
import { useLightningStrikerAudio } from "../use-lightning-striker-audio-v2";
import { useLightningPowerCut } from "../use-lightning-power-cut";
import { useLightningRain } from "./use-lightning-rain-v5-with-splashes";

export type LightningStrikerCanvasRef = RefObject<View | null>;
type Rect = { x: number; y: number; width: number; height: number };

export type LightningStrikerStartOptions = {
  onFinished?: () => void;
  seed?: number;
  coverage?: "full" | "partial" | "random";
  generatorConfig?: Partial<LightningGeneratorConfig>;
  specialEvent?: "random" | "none" | "powerCut" | "rain";
};

export type LightningStrikerAudioOptions = {
  strike?: AudioSource | null;
  thunder?: AudioSource | null;
};

export type LightningStrikerController = {
  start: (
    canvasRef: LightningStrikerCanvasRef,
    options?: LightningStrikerStartOptions,
  ) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  active: boolean;
  /** Render after ordinary search content, inside the shared animation canvas. */
  overlayLayer: React.ReactNode;
};

function measureInWindow(ref: LightningStrikerCanvasRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);

    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return resolve(null);
      resolve({ x, y, width, height });
    });
  });
}

export function useLightningStrikerAnimation(
  audioSources: LightningStrikerAudioOptions = {},
): LightningStrikerController {
  const [active, setActive] = useState(false);
  const [strike, setStrike] = useState<LightningStrike | null>(null);

  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const finishedCallbackRef = useRef<(() => void) | undefined>(undefined);
  const timersRef = useRef<
    Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>
  >(new Map());
  const autoRainStrikeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audio = useLightningStrikerAudio(audioSources);
  const powerCut = useLightningPowerCut(
    {
      shortCircuit: require("@/assets/easter-eggs/lighting-strike/short-circuit.mp3"),
      blackout: require("@/assets/easter-eggs/lighting-strike/blackout.mp3"),
      lightFlicker: require("@/assets/easter-eggs/lighting-strike/light-flicker.mp3"),
    },
    LIGHTNING_STRIKER_TUNING.specialEvents.powerCut,
  );
  const rain = useLightningRain(
    require("@/assets/easter-eggs/lighting-strike/rain-thunder.mp3"),
    LIGHTNING_STRIKER_TUNING.specialEvents.rain,
    require("@/assets/easter-eggs/lighting-strike/wind-gusts.mp3"),
  );
  /* let lightningAudioEndAtMs = 0; */
  const leaderProgress = useSharedValue(0);
  const returnProgress = useSharedValue(0);
  const boltOpacity = useSharedValue(1);
  const flashIntensity = useSharedValue(0);
  const atmosphereOpacity = useSharedValue(0);
  const screenFlashOpacity = useSharedValue(0);

  const { appearance, timing } = LIGHTNING_STRIKER_TUNING;

  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: atmosphereOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: screenFlashOpacity.value,
  }));

  const waitFor = useCallback((durationMs: number, runId: number) => {
    if (runId !== runIdRef.current) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(
        () => {
          timersRef.current.delete(timer);
          resolve(runId === runIdRef.current);
        },
        Math.max(0, durationMs),
      );
      timersRef.current.set(timer, resolve);
    });
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((resolve, timer) => {
      clearTimeout(timer);
      resolve(false);
    });
    timersRef.current.clear();
    if (autoRainStrikeTimerRef.current) {
      +clearTimeout(autoRainStrikeTimerRef.current);
      autoRainStrikeTimerRef.current = null;
    }
  }, []);
  const triggerRainAutoStrike = useCallback(
    async (
      canvas: Rect,
      options: LightningStrikerStartOptions,
      runId: number,
      reduceMotion: boolean,
    ) => {
      if (
        runId !== runIdRef.current ||
        !activeRef.current ||
        !rain.isRunning()
      ) {
        return;
      }

      try {
        const autoStrike = generateLightningStrike(
          canvas.width,
          canvas.height,
          {
            seed: Math.floor(Math.random() * 2_147_483_647),
            coverage: "random",
            config: options.generatorConfig,
          },
        );

        // Re-use the existing lightning canvas and shared progress values. Only
        // the generated bolt changes; rain remains mounted below it.
        setStrike(autoStrike);
        leaderProgress.value = 0;
        returnProgress.value = 0;
        boltOpacity.value = 1;
        flashIntensity.value = 0;
        screenFlashOpacity.value = 0;

        const leaderDuration = reduceMotion
          ? Math.max(90, Math.round(timing.reducedMotionDurationMs * 0.35))
          : Math.max(260, Math.round(timing.leaderDurationMs * 0.72));
        const returnDuration = reduceMotion
          ? 55
          : Math.max(65, timing.returnStrokeDurationMs);
        const boltFadeDuration = reduceMotion
          ? 160
          : Math.max(260, Math.round(timing.fadeOutDurationMs * 0.72));

        leaderProgress.value = withTiming(1, {
          duration: leaderDuration,
          easing: Easing.linear,
        });

        const leaderFinished = await waitFor(leaderDuration, runId);
        if (
          !leaderFinished ||
          runId !== runIdRef.current ||
          !rain.isRunning()
        ) {
          return;
        }

        // Rain droplets brighten on the exact discharge beat.
        rain.triggerLightningFlash();
        screenFlashOpacity.value = withSequence(
          withTiming(reduceMotion ? 0.16 : 0.42, { duration: 32 }),
          withTiming(0.07, { duration: 95 }),
          withTiming(reduceMotion ? 0.06 : 0.18, { duration: 44 }),
          withTiming(0, { duration: 155 }),
        );
        flashIntensity.value = withSequence(
          withTiming(reduceMotion ? 0.38 : 0.92, { duration: 36 }),
          withTiming(0.2, { duration: 110 }),
          withTiming(reduceMotion ? 0.14 : 0.48, { duration: 52 }),
          withTiming(0, { duration: 175 }),
        );

        returnProgress.value = withTiming(1, {
          duration: returnDuration,
          easing: Easing.out(Easing.quad),
        });
        audio.playStrike(timing.strikeSoundDelayMs, 0.66);
        audio.playThunder(timing.thunderSoundDelayMs + 180, 0.48);

        const returnFinished = await waitFor(returnDuration, runId);
        if (!returnFinished || runId !== runIdRef.current) return;

        await waitFor(220, runId);
        if (runId !== runIdRef.current) return;

        boltOpacity.value = withTiming(0, {
          duration: boltFadeDuration,
          easing: Easing.out(Easing.quad),
        });
        await waitFor(boltFadeDuration, runId);
      } catch (error) {
        console.warn(
          "[Lightning Striker] Automatic rain strike failed.",
          error,
        );
      }
    },
    [
      leaderProgress,
      returnProgress,
      boltOpacity,
      flashIntensity,
      screenFlashOpacity,
      timing,
      waitFor,
      rain.isRunning,
      rain.triggerLightningFlash,
      audio.playStrike,
      audio.playThunder,
    ],
  );

  const stopAnimations = useCallback(() => {
    cancelAnimation(leaderProgress);
    cancelAnimation(returnProgress);
    cancelAnimation(boltOpacity);
    cancelAnimation(flashIntensity);
    cancelAnimation(atmosphereOpacity);
    cancelAnimation(screenFlashOpacity);
    //audio.stopAll();
  }, [
    leaderProgress,
    returnProgress,
    boltOpacity,
    flashIntensity,
    atmosphereOpacity,
    screenFlashOpacity,
    audio.stopAll,
  ]);

  const finish = useCallback((runId: number) => {
    if (runId !== runIdRef.current) return;

    activeRef.current = false;
    setActive(false);
    setStrike(null);

    const callback = finishedCallbackRef.current;
    finishedCallbackRef.current = undefined;
    callback?.();
  }, []);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;

    runIdRef.current += 1;
    clearTimers();
    stopAnimations();
    activeRef.current = false;
    setActive(false);
    setStrike(null);
    powerCut.cancel();
    rain.cancel();

    const callback = finishedCallbackRef.current;
    finishedCallbackRef.current = undefined;
    callback?.();
  }, [clearTimers, stopAnimations]);

  const start = useCallback(
    async (
      canvasRef: LightningStrikerCanvasRef,
      options: LightningStrikerStartOptions = {},
    ) => {
      if (activeRef.current) return false;

      activeRef.current = true;
      const runId = ++runIdRef.current;
      finishedCallbackRef.current = options.onFinished;
      const powerCutConfig = LIGHTNING_STRIKER_TUNING.specialEvents.powerCut;
      /*  const shouldRunPowerCut =
        options.specialEvent === "powerCut" ||
        (options.specialEvent !== "none" &&
          powerCutConfig.enabled &&
          Math.random() < powerCutConfig.chance); */

      let powerCutPromise: Promise<boolean> | null = null;

      const rainConfig = LIGHTNING_STRIKER_TUNING.specialEvents.rain;
      /*  const shouldRunrain =
        options.specialEvent === "rain" ||
        (options.specialEvent !== "none" &&
          rainConfig.enabled &&
          Math.random() < rainConfig.chance);
      let rainCutPromise: Promise<boolean> | null = null; */

      // Exactly one special outcome can be selected for an activation.
      // Explicit options are useful for deterministic device testing; "random"
      // uses the configured per-event chances.
      let selectedSpecialEvent: "powerCut" | "rain" | null = null;
      if (options.specialEvent === "powerCut") {
        selectedSpecialEvent = "powerCut";
      } else if (options.specialEvent === "rain") {
        selectedSpecialEvent = "rain";
      } else if (options.specialEvent !== "none") {
        const powerCutChance = powerCutConfig.enabled
          ? Math.max(0, Math.min(1, powerCutConfig.chance))
          : 0;
        const rainChance = rainConfig.enabled
          ? Math.max(0, Math.min(1 - powerCutChance, rainConfig.chance))
          : 0;
        const eventRoll = Math.random();

        if (eventRoll < powerCutChance) {
          selectedSpecialEvent = "powerCut";
        } else if (eventRoll < powerCutChance + rainChance) {
          selectedSpecialEvent = "rain";
        }
      }
      try {
        const [canvas, reduceMotion] = await Promise.all([
          measureInWindow(canvasRef),
          AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        ]);

        if (runId !== runIdRef.current) return false;
        if (!canvas) {
          console.warn(
            "[Lightning Striker] Could not measure the animation canvas.",
          );
          finish(runId);
          return false;
        }

        const generated = generateLightningStrike(canvas.width, canvas.height, {
          seed: options.seed,
          coverage: options.coverage ?? "random",
          config: options.generatorConfig,
        });

        leaderProgress.value = 0;
        returnProgress.value = 0;
        boltOpacity.value = 1;
        flashIntensity.value = 0;
        atmosphereOpacity.value = 0;
        screenFlashOpacity.value = 0;

        setStrike(generated);
        setActive(true);

        atmosphereOpacity.value = withTiming(appearance.atmosphereOpacity, {
          duration: reduceMotion ? 0 : 90,
          easing: Easing.out(Easing.quad),
        });

        const leaderDuration = reduceMotion
          ? timing.reducedMotionDurationMs
          : timing.leaderDurationMs;

        leaderProgress.value = withTiming(1, {
          duration: leaderDuration,
          easing: Easing.linear,
        });

        const leaderFinished = await waitFor(leaderDuration, runId);
        if (!leaderFinished || runId !== runIdRef.current) return false;

        // Connection: a sharp screen flash accompanies the return stroke.
        screenFlashOpacity.value = withSequence(
          withTiming(appearance.screenFlashPeakOpacity, { duration: 32 }),
          withTiming(0.055, { duration: 105 }),
          withTiming(0.25, { duration: 48 }),
          withTiming(0, { duration: 145 }),
        );
        flashIntensity.value = withSequence(
          withTiming(1, { duration: 35 }),
          withTiming(0.22, { duration: 115 }),
          withTiming(0.72, { duration: 55 }),
          withTiming(0, { duration: 165 }),
        );

        returnProgress.value = withTiming(1, {
          duration: reduceMotion ? 65 : timing.returnStrokeDurationMs,
          easing: Easing.out(Easing.quad),
        });
        /* const lightningAudioScheduledAtMs = Date.now(); */
        audio.playStrike(timing.strikeSoundDelayMs);
        audio.playThunder(timing.thunderSoundDelayMs);
        // The short-circuit sound begins at the return-stroke boundary. The blackout
        // sound is scheduled by the power-cut controller near the end of that clip.
        /* lightningAudioEndAtMs =
          lightningAudioScheduledAtMs +
          audio.getEffectsEndDelayMs(
            timing.strikeSoundDelayMs,
            timing.thunderSoundDelayMs,
          ) +
          Math.max(0, rainConfig.startPaddingAfterLightningAudioMs ?? 120); */
        if (selectedSpecialEvent === "powerCut") {
          powerCutPromise = powerCut.run();
        }
        const returnFinished = await waitFor(
          reduceMotion ? 65 : timing.returnStrokeDurationMs,
          runId,
        );
        if (!returnFinished || runId !== runIdRef.current) return false;

        await waitFor(timing.secondaryFlashDelayMs, runId);
        if (runId !== runIdRef.current) return false;

        // A smaller re-discharge runs through the already-established channels.
        flashIntensity.value = withSequence(
          withTiming(0.58, { duration: 35 }),
          withTiming(0.1, { duration: 90 }),
          withTiming(0, { duration: 120 }),
        );
        screenFlashOpacity.value = withSequence(
          withTiming(0.13, { duration: 35 }),
          withTiming(0, { duration: 115 }),
        );

        await waitFor(timing.secondaryFlashDurationMs, runId);
        if (runId !== runIdRef.current) return false;

        await waitFor(timing.afterglowDurationMs, runId);
        if (runId !== runIdRef.current) return false;

        boltOpacity.value = withTiming(0, {
          duration: timing.fadeOutDurationMs,
          easing: Easing.out(Easing.quad),
        });
        atmosphereOpacity.value = withTiming(0, {
          duration: timing.fadeOutDurationMs,
          easing: Easing.out(Easing.quad),
        });

        // Rain starts after the electrical channels have faded, then owns the
        // remaining event lifetime. Its particle emitters taper gradually and
        // existing droplets are allowed to drain before the activation finishes.
        if (selectedSpecialEvent === "rain") {
          const rainPromise = rain.run(canvas.width, canvas.height);
          if (rainConfig.autoStrikeEnabled !== false) {
            const autoStrikeDelayMs = Math.max(
              0,
              Math.floor(rainConfig.autoStrikeDelayMs ?? 3500),
            );
            autoRainStrikeTimerRef.current = setTimeout(() => {
              autoRainStrikeTimerRef.current = null;
              void triggerRainAutoStrike(canvas, options, runId, reduceMotion);
            }, autoStrikeDelayMs);
          }
          const rainCompleted = await rainPromise;
          if (autoRainStrikeTimerRef.current) {
            clearTimeout(autoRainStrikeTimerRef.current);
            autoRainStrikeTimerRef.current = null;
          }
          if (!rainCompleted) {
            if (runId === runIdRef.current) finish(runId);
            return false;
          }
          if (runId !== runIdRef.current) return false;
        }

        const fadeFinished = await waitFor(timing.fadeOutDurationMs, runId);
        if (!fadeFinished || runId !== runIdRef.current) return false;
        if (powerCutPromise) {
          const powerCutCompleted = await powerCutPromise;
          if (!powerCutCompleted || runId !== runIdRef.current) return false;
        }

        if (powerCutPromise) {
          const powerCutCompleted = await powerCutPromise;
          if (!powerCutCompleted) {
            if (runId === runIdRef.current) finish(runId);
            return false;
          }
          if (runId !== runIdRef.current) return false;
        }

        stopAnimations();
        finish(runId);
        return true;
      } catch (error) {
        console.warn("[Lightning Striker] Animation failed.", error);
        if (runId === runIdRef.current) {
          clearTimers();
          powerCut.cancel();
          rain.cancel();
          stopAnimations();
          finish(runId);
        }
        return false;
      }
    },
    [
      leaderProgress,
      returnProgress,
      boltOpacity,
      flashIntensity,
      atmosphereOpacity,
      screenFlashOpacity,
      appearance.atmosphereOpacity,
      appearance.screenFlashPeakOpacity,
      timing,
      waitFor,
      audio.playStrike,
      audio.playThunder,
      stopAnimations,
      clearTimers,
      finish,
      powerCut.run,
      rain.run,
      triggerRainAutoStrike,
    ],
  );

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearTimers();
      stopAnimations();
      activeRef.current = false;
      const callback = finishedCallbackRef.current;
      finishedCallbackRef.current = undefined;
      powerCut.cancel();
      rain.cancel();
      callback?.();
    },
    [clearTimers, stopAnimations],
  );

  const overlayLayer =
    active && strike ? (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            zIndex: 100,
            elevation: 100,
          },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: appearance.atmosphereColor },
            atmosphereStyle,
          ]}
        />

        <LightningCanvas
          strike={strike}
          leaderProgress={leaderProgress}
          returnProgress={returnProgress}
          boltOpacity={boltOpacity}
          flashIntensity={flashIntensity}
        />

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: appearance.screenFlashColor },
            flashStyle,
          ]}
        />
        {powerCut.overlayLayer}
        {rain.overlayLayer}
      </View>
    ) : null;

  return {
    start,
    cancel,
    isRunning: () => activeRef.current,
    active,
    overlayLayer,
  };
}
