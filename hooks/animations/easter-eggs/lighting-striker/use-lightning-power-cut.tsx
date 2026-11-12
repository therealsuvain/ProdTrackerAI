import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAudioPlayer, type AudioSource } from "expo-audio";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export type LightningPowerCutFlickerStep = {
  /** Visible brightness of the underlying interface: 0 = black, 1 = fully visible. */
  brightness: number;
  /** Portion of the complete recovery sound duration. All ratios should sum to 1. */
  durationRatio: number;
};

export type LightningPowerCutConfig = {
  enabled: boolean;
  /** Probability per lightning activation. Use 1 while testing. */
  chance: number;

  shortCircuitStartDelayMs: number;
  shortCircuitStartOffsetMs: number;
  shortCircuitClipDurationMs: number;
  /** Starts blackout.mp3 this long before the short-circuit clip's playable end. */
  shortCircuitToBlackoutOverlapMs: number;

  blackoutStartOffsetMs: number;
  blackoutClipDurationMs: number;
  /** Fully black should be reached this long before blackout.mp3's playable end. */
  darkBeforeBlackoutAudioEndsMs: number;
  darkTransitionMs: number;

  /** Random full-black hold, after the fade to black has completed. */
  blackHoldRangeMs: readonly [number, number];

  recoveryDurationMs: number;
  flickerSteps: readonly LightningPowerCutFlickerStep[];

  shortCircuitVolume: number;
  blackoutVolume: number;
  lightFlickerVolume: number;
};

export type LightningPowerCutAudioSources = {
  shortCircuit: AudioSource | null;
  blackout: AudioSource | null;
  lightFlicker: AudioSource | null;
};

export type LightningPowerCutController = {
  /** Runs the complete short-circuit → blackout → dark hold → relight sequence. */
  run: () => Promise<boolean>;
  /** Explicit cancellation only; normal visual completion does not call this. */
  cancel: () => void;
  isRunning: () => boolean;
  overlayLayer: React.ReactNode;
};

type Timer = ReturnType<typeof setTimeout>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Power-cut Easter egg event.
 *
 * Audio order:
 * 1. short-circuit starts immediately (after optional configured delay).
 * 2. blackout audio starts near the short-circuit clip's end.
 * 3. the screen reaches full black near the end of blackout.mp3.
 * 4. after a random dark hold, light-flicker.mp3 and the relight animation start together.
 *
 * The black overlay is a separate topmost layer. It never intercepts touches and
 * does not alter, remove, or mutate the search UI underneath it.
 */
export function useLightningPowerCut(
  sources: LightningPowerCutAudioSources,
  config: LightningPowerCutConfig,
): LightningPowerCutController {
  const shortCircuitPlayer = useAudioPlayer(sources.shortCircuit);
  const blackoutPlayer = useAudioPlayer(sources.blackout);
  const lightFlickerPlayer = useAudioPlayer(sources.lightFlicker);

  const [overlayVisible, setOverlayVisible] = useState(false);
  const blackOpacity = useSharedValue(0);

  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const timersRef = useRef<Map<Timer, (completed: boolean) => void>>(new Map());

  const blackoutStyle = useAnimatedStyle(() => ({
    opacity: blackOpacity.value,
  }));

  const waitFor = useCallback((durationMs: number, runId: number) => {
    if (runId !== runIdRef.current) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        resolve(runId === runIdRef.current);
      }, Math.max(0, durationMs));
      timersRef.current.set(timer, resolve);
    });
  }, []);

  const clearWaiters = useCallback(() => {
    timersRef.current.forEach((resolve, timer) => {
      clearTimeout(timer);
      resolve(false);
    });
    timersRef.current.clear();
  }, []);

  const playFromOffset = useCallback(
    async (
      player: typeof shortCircuitPlayer,
      offsetMs: number,
      volume: number,
    ) => {
      try {
        player.pause();
        player.volume = clamp01(volume);
        await player.seekTo(Math.max(0, offsetMs) / 1000);
        player.play();
      } catch (error) {
        // Audio is decorative. A player/seek failure must not block the visuals.
        try {
          player.volume = clamp01(volume);
          player.play();
        } catch {
          console.warn("[Lightning Power Cut] Audio playback failed.", error);
        }
      }
    },
    [],
  );

  const stopPowerCutAudio = useCallback(() => {
    for (const player of [shortCircuitPlayer, blackoutPlayer, lightFlickerPlayer]) {
      try {
        player.pause();
        void player.seekTo(0).catch(() => undefined);
      } catch {
        // Ignore player cleanup errors; cancellation must still complete.
      }
    }
  }, [shortCircuitPlayer, blackoutPlayer, lightFlickerPlayer]);

  const cancel = useCallback(() => {
    if (!activeRef.current && !overlayVisible) {
      stopPowerCutAudio();
      return;
    }

    runIdRef.current += 1;
    clearWaiters();
    cancelAnimation(blackOpacity);
    blackOpacity.value = 0;
    activeRef.current = false;
    setOverlayVisible(false);
    stopPowerCutAudio();
  }, [
    activeRef,
    overlayVisible,
    clearWaiters,
    blackOpacity,
    stopPowerCutAudio,
  ]);

  const run = useCallback(async (): Promise<boolean> => {
    if (activeRef.current) return false;

    activeRef.current = true;
    const runId = ++runIdRef.current;
    blackOpacity.value = 0;

    try {
      // Phase 1: electrical short-circuit. The uploaded recording contains
      // approximately 480 ms of leading silence, so seek past it by default.
      const started = await waitFor(config.shortCircuitStartDelayMs, runId);
      if (!started || runId !== runIdRef.current) return false;

      await playFromOffset(
        shortCircuitPlayer,
        config.shortCircuitStartOffsetMs,
        config.shortCircuitVolume,
      );
      if (runId !== runIdRef.current) return false;

      // Phase 2: overlap the blackout recording with the final part of the
      // short-circuit recording. Both clip offsets and durations are tunable.
      const shortCircuitPlayableMs = Math.max(
        0,
        config.shortCircuitClipDurationMs - config.shortCircuitStartOffsetMs,
      );
      const blackoutStartDelay = Math.max(
        0,
        shortCircuitPlayableMs - config.shortCircuitToBlackoutOverlapMs,
      );

      const blackoutStarted = await waitFor(blackoutStartDelay, runId);
      if (!blackoutStarted || runId !== runIdRef.current) return false;

      await playFromOffset(
        blackoutPlayer,
        config.blackoutStartOffsetMs,
        config.blackoutVolume,
      );
      if (runId !== runIdRef.current) return false;

      // Phase 3: darken just before the blackout sound reaches its end.
      const blackoutPlayableMs = Math.max(
        0,
        config.blackoutClipDurationMs - config.blackoutStartOffsetMs,
      );
      const darkenStartDelay = Math.max(
        0,
        blackoutPlayableMs -
          config.darkBeforeBlackoutAudioEndsMs -
          config.darkTransitionMs,
      );

      const darkenStarted = await waitFor(darkenStartDelay, runId);
      if (!darkenStarted || runId !== runIdRef.current) return false;

      setOverlayVisible(true);
      blackOpacity.value = withTiming(1, {
        duration: config.darkTransitionMs,
        easing: Easing.in(Easing.quad),
      });

      const fullyDark = await waitFor(config.darkTransitionMs, runId);
      if (!fullyDark || runId !== runIdRef.current) return false;

      // Phase 4: the screen remains genuinely black for a random 5–10 seconds.
      const holdDuration = Math.round(
        randomBetween(config.blackHoldRangeMs[0], config.blackHoldRangeMs[1]),
      );
      const holdFinished = await waitFor(holdDuration, runId);
      if (!holdFinished || runId !== runIdRef.current) return false;

      // Phase 5: start the relight audio and visual flicker on the same boundary.
      await playFromOffset(
        lightFlickerPlayer,
        0,
        config.lightFlickerVolume,
      );
      if (runId !== runIdRef.current) return false;

      const flickerAnimations = config.flickerSteps.map((step) =>
        withTiming(1 - clamp01(step.brightness), {
          duration: Math.max(1, Math.round(config.recoveryDurationMs * step.durationRatio)),
          easing: Easing.inOut(Easing.quad),
        }),
      );

      blackOpacity.value = withSequence(...flickerAnimations);

      const recoveryFinished = await waitFor(config.recoveryDurationMs, runId);
      if (!recoveryFinished || runId !== runIdRef.current) return false;

      blackOpacity.value = 0;
      setOverlayVisible(false);
      activeRef.current = false;
      return true;
    } catch (error) {
      console.warn("[Lightning Power Cut] Event failed.", error);
      if (runId === runIdRef.current) {
        clearWaiters();
        cancelAnimation(blackOpacity);
        blackOpacity.value = 0;
        activeRef.current = false;
        setOverlayVisible(false);
        stopPowerCutAudio();
      }
      return false;
    }
  }, [
    activeRef,
    blackOpacity,
    config,
    waitFor,
    playFromOffset,
    shortCircuitPlayer,
    blackoutPlayer,
    lightFlickerPlayer,
    clearWaiters,
    stopPowerCutAudio,
  ]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearWaiters();
      cancelAnimation(blackOpacity);
      stopPowerCutAudio();
      activeRef.current = false;
    }, [clearWaiters, blackOpacity, stopPowerCutAudio],
  );

  const overlayLayer = overlayVisible ? (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.blackoutOverlay,
        blackoutStyle,
      ]}
    />
  ) : null;

  return useMemo(
    () => ({
      run,
      cancel,
      isRunning: () => activeRef.current,
      overlayLayer,
    }),
    [run, cancel, overlayLayer],
  );
}

const styles = StyleSheet.create({
  blackoutOverlay: {
    backgroundColor: "#000000",
    zIndex: 1000,
    elevation: 1000,
  },
});
