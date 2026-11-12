import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useAudioPlayer, type AudioSource } from "expo-audio";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export type LightningRainRange = readonly [number, number];
export type LightningRainDepth = 0 | 1 | 2;

export type LightningRainConfig = {
  enabled: boolean;
  /** Per-lightning-activation probability when specialEvent is "random". */
  chance: number;
  heavyDurationRangeMs: LightningRainRange;
  /** Time over which active droplet emitters are retired progressively. */
  fadeDurationRangeMs: LightningRainRange;
  /** Allows the final already-falling droplets to leave the screen. */
  drainDurationMs: number;
  maxParticles: number;
  speedRangeDpPerSecond: LightningRainRange;
  windAngleRangeDegrees: LightningRainRange;
  farDropLengthRange: LightningRainRange;
  midDropLengthRange: LightningRainRange;
  nearDropLengthRange: LightningRainRange;
  farStrokeWidth: number;
  midStrokeWidth: number;
  nearStrokeWidth: number;
  farOpacity: number;
  midOpacity: number;
  nearOpacity: number;
  atmosphereColor: string;
  atmosphereOpacity: number;
  atmosphereFadeInMs: number;
  atmosphereFadeOutMs: number;
  audioVolume: number;
  audioFadeSteps: number;
};

export type LightningRainParticle = {
  x: number;
  phaseMs: number;
  fallDurationMs: number;
  length: number;
  angleRadians: number;
  depth: LightningRainDepth;
  retireAtMs: number;
};

export type LightningRainController = {
  run: (width: number, height: number) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  overlayLayer: React.ReactNode;
};

type Timer = ReturnType<typeof setTimeout>;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildRainParticles(
  width: number,
  height: number,
  heavyDurationMs: number,
  fadeDurationMs: number,
  config: LightningRainConfig,
): LightningRainParticle[] {
  const particles: LightningRainParticle[] = [];
  const depthDistribution: LightningRainDepth[] = [
    0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
  ];

  for (let index = 0; index < config.maxParticles; index += 1) {
    const depth = depthDistribution[
      Math.floor(Math.random() * depthDistribution.length)
    ];
    const lengthRange =
      depth === 0
        ? config.farDropLengthRange
        : depth === 1
          ? config.midDropLengthRange
          : config.nearDropLengthRange;
    const length = randomBetween(lengthRange[0], lengthRange[1]);
    const speed = randomBetween(
      config.speedRangeDpPerSecond[0],
      config.speedRangeDpPerSecond[1],
    );
    const fallDistance = height + length * 2;
    const fallDurationMs = (fallDistance / Math.max(1, speed)) * 1000;
    const windAngle = randomBetween(
      config.windAngleRangeDegrees[0],
      config.windAngleRangeDegrees[1],
    );

    particles.push({
      x: randomBetween(-width * 0.08, width * 1.08),
      phaseMs: randomBetween(0, fallDurationMs),
      fallDurationMs,
      length,
      angleRadians: (windAngle * Math.PI) / 180,
      depth,
      // Every particle keeps recycling during the heavy phase. During the
      // taper, its emitter is retired at a randomized point; its last drop is
      // allowed to finish falling instead of disappearing abruptly.
      retireAtMs: randomBetween(heavyDurationMs, heavyDurationMs + fadeDurationMs),
    });
  }

  return particles;
}

function appendRainPaths(
  particles: LightningRainParticle[],
  elapsedMs: number,
  width: number,
  height: number,
  farPath: ReturnType<typeof Skia.Path.Make>,
  midPath: ReturnType<typeof Skia.Path.Make>,
  nearPath: ReturnType<typeof Skia.Path.Make>,
): void {
  "worklet";
  // Reuse three persistent Skia paths rather than allocating new path objects
  // every frame. Each path contains all drops at one depth.
  farPath.reset();
  midPath.reset();
  nearPath.reset();

  for (let index = 0; index < particles.length; index += 1) {
    const particle = particles[index];
    let phase: number;

    if (elapsedMs < particle.retireAtMs) {
      phase = (elapsedMs + particle.phaseMs) % particle.fallDurationMs;
    } else {
      const phaseAtRetirement =
        (particle.retireAtMs + particle.phaseMs) % particle.fallDurationMs;
      phase = phaseAtRetirement + (elapsedMs - particle.retireAtMs);
      if (phase >= particle.fallDurationMs) continue;
    }

    const progress = phase / particle.fallDurationMs;
    const travelDistance = progress * (height + particle.length * 2);
    const startY = travelDistance - particle.length;
    const startX = particle.x + travelDistance * Math.tan(particle.angleRadians);
    const endX = startX + Math.sin(particle.angleRadians) * particle.length;
    const endY = startY + Math.cos(particle.angleRadians) * particle.length;

    // Keep a little bleed beyond the canvas edges so drops enter/leave naturally.
    if (
      endY < -particle.length ||
      startY > height + particle.length ||
      endX < -particle.length ||
      startX > width + particle.length
    ) {
      continue;
    }

    const target =
      particle.depth === 0
        ? farPath
        : particle.depth === 1
          ? midPath
          : nearPath;
    target.moveTo(startX, startY);
    target.lineTo(endX, endY);
  }
}

const LightningRainCanvas = React.memo(function LightningRainCanvas({
  particles,
  elapsedMs,
  width,
  height,
  config,
}: {
  particles: LightningRainParticle[];
  elapsedMs: SharedValue<number>;
  width: number;
  height: number;
  config: LightningRainConfig;
}) {
  // Persistent shared paths are mutated on the UI thread. This avoids creating
  // three new Skia path objects on every frame of the rainfall animation.
  const farPath = useSharedValue(Skia.Path.Make());
  const midPath = useSharedValue(Skia.Path.Make());
  const nearPath = useSharedValue(Skia.Path.Make());

  useDerivedValue(() => {
    appendRainPaths(
      particles,
      elapsedMs.value,
      width,
      height,
      farPath.value,
      midPath.value,
      nearPath.value,
    );
  });

  return (
    <Canvas style={StyleSheet.absoluteFillObject}>
      <Path
        path={farPath}
        style="stroke"
        color="#82B7DE"
        strokeWidth={config.farStrokeWidth}
        strokeCap="round"
        opacity={config.farOpacity}
      />
      <Path
        path={midPath}
        style="stroke"
        color="#B4D9F3"
        strokeWidth={config.midStrokeWidth}
        strokeCap="round"
        opacity={config.midOpacity}
      />
      <Path
        path={nearPath}
        style="stroke"
        color="#E4F3FF"
        strokeWidth={config.nearStrokeWidth}
        strokeCap="round"
        opacity={config.nearOpacity}
      />
    </Canvas>
  );
});

/**
 * Procedural rain event.
 *
 * The particle pool is generated once on the JS thread. A single linear shared
 * value drives all particle positions on the UI thread. During the fade phase,
 * particle emitters retire progressively; each existing drop is allowed to
 * finish its current fall, producing a natural thinning-out rather than an
 * opacity-only fade.
 */
export function useLightningRain(
  source: AudioSource | null,
  config: LightningRainConfig,
): LightningRainController {
  const rainPlayer = useAudioPlayer(source);
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<LightningRainParticle[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const activeRef = useRef(false);
  const runIdRef = useRef(0);
  const waitersRef = useRef<Map<Timer, (completed: boolean) => void>>(new Map());
  const volumeTimersRef = useRef<Set<Timer>>(new Set());

  const elapsedMs = useSharedValue(0);
  const atmosphereOpacity = useSharedValue(0);

  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: atmosphereOpacity.value,
  }));

  const waitFor = useCallback((durationMs: number, runId: number) => {
    if (runId !== runIdRef.current) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        waitersRef.current.delete(timer);
        resolve(runId === runIdRef.current);
      }, Math.max(0, durationMs));
      waitersRef.current.set(timer, resolve);
    });
  }, []);

  const clearTimers = useCallback(() => {
    waitersRef.current.forEach((resolve, timer) => {
      clearTimeout(timer);
      resolve(false);
    });
    waitersRef.current.clear();

    volumeTimersRef.current.forEach(clearTimeout);
    volumeTimersRef.current.clear();
  }, []);

  const stopRainAudio = useCallback(() => {
    try {
      rainPlayer.pause();
      rainPlayer.volume = 0;
      void rainPlayer.seekTo(0).catch(() => undefined);
    } catch {
      // Audio is decorative; cleanup must never block the visual lifecycle.
    }
  }, [rainPlayer]);

  const scheduleAudioFade = useCallback(
    (delayMs: number, fadeDurationMs: number, runId: number) => {
      const steps = Math.max(1, Math.floor(config.audioFadeSteps));
      const initialVolume = Math.max(0, Math.min(1, config.audioVolume));

      for (let step = 1; step <= steps; step += 1) {
        const timer = setTimeout(() => {
          volumeTimersRef.current.delete(timer);
          if (runId !== runIdRef.current) return;
          const progress = step / steps;
          try {
            rainPlayer.volume = initialVolume * (1 - progress);
          } catch {
            // A device audio interruption should not stop the rain visuals.
          }
        }, delayMs + Math.round((fadeDurationMs * step) / steps));
        volumeTimersRef.current.add(timer);
      }
    },
    [config.audioFadeSteps, config.audioVolume, rainPlayer],
  );

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    clearTimers();
    cancelAnimation(elapsedMs);
    cancelAnimation(atmosphereOpacity);
    elapsedMs.value = 0;
    atmosphereOpacity.value = 0;
    activeRef.current = false;
    setVisible(false);
    setParticles([]);
    setCanvasSize({ width: 0, height: 0 });
    stopRainAudio();
  }, [clearTimers, elapsedMs, atmosphereOpacity, stopRainAudio]);

  const run = useCallback(
    async (width: number, height: number): Promise<boolean> => {
      if (activeRef.current) return false;
      if (width <= 0 || height <= 0) return false;

      activeRef.current = true;
      const runId = ++runIdRef.current;

      const heavyDurationMs = Math.round(
        randomBetween(
          config.heavyDurationRangeMs[0],
          config.heavyDurationRangeMs[1],
        ),
      );
      const fadeDurationMs = Math.round(
        randomBetween(
          config.fadeDurationRangeMs[0],
          config.fadeDurationRangeMs[1],
        ),
      );
      const generatedParticles = buildRainParticles(
        width,
        height,
        heavyDurationMs,
        fadeDurationMs,
        config,
      );
      // Respect the configured drain minimum, but automatically extend it on
      // unusually tall layouts or slower speeds so no final drop is cut off.
      const longestDropLifetimeMs = generatedParticles.reduce(
        (maximum, particle) => Math.max(maximum, particle.fallDurationMs),
        0,
      );
      const drainDurationMs = Math.max(
        0,
        config.drainDurationMs,
        longestDropLifetimeMs + 50,
      );
      const totalDurationMs = heavyDurationMs + fadeDurationMs + drainDurationMs;

      elapsedMs.value = 0;
      atmosphereOpacity.value = 0;
      setParticles(generatedParticles);
      setCanvasSize({ width, height });
      setVisible(true);

      atmosphereOpacity.value = withTiming(config.atmosphereOpacity, {
        duration: config.atmosphereFadeInMs,
        easing: Easing.out(Easing.quad),
      });
      elapsedMs.value = withTiming(totalDurationMs, {
        duration: totalDurationMs,
        easing: Easing.linear,
      });

      try {
        // The supplied rain recording has audible content from its beginning.
        try {
          rainPlayer.volume = Math.max(0, Math.min(1, config.audioVolume));
          await rainPlayer.seekTo(0);
          if (runId !== runIdRef.current) return false;
          rainPlayer.play();
        } catch (error) {
          console.warn("[Lightning Rain] Rain audio playback failed; continuing silently.", error);
        }

        scheduleAudioFade(heavyDurationMs, fadeDurationMs, runId);

        const completed = await waitFor(totalDurationMs, runId);
        if (!completed || runId !== runIdRef.current) return false;

        atmosphereOpacity.value = withTiming(0, {
          duration: config.atmosphereFadeOutMs,
          easing: Easing.out(Easing.quad),
        });
        await waitFor(config.atmosphereFadeOutMs, runId);
        if (runId !== runIdRef.current) return false;

        atmosphereOpacity.value = 0;
        elapsedMs.value = 0;
        activeRef.current = false;
        setVisible(false);
        setParticles([]);
        setCanvasSize({ width: 0, height: 0 });
        stopRainAudio();
        return true;
      } catch (error) {
        console.warn("[Lightning Rain] Event failed.", error);
        if (runId === runIdRef.current) {
          clearTimers();
          cancelAnimation(elapsedMs);
          cancelAnimation(atmosphereOpacity);
          elapsedMs.value = 0;
          atmosphereOpacity.value = 0;
          activeRef.current = false;
          setVisible(false);
          setParticles([]);
          setCanvasSize({ width: 0, height: 0 });
          stopRainAudio();
        }
        return false;
      }
    },
    [
      config,
      elapsedMs,
      atmosphereOpacity,
      rainPlayer,
      scheduleAudioFade,
      waitFor,
      clearTimers,
      stopRainAudio,
    ],
  );

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearTimers();
      cancelAnimation(elapsedMs);
      cancelAnimation(atmosphereOpacity);
      stopRainAudio();
      activeRef.current = false;
    }, [clearTimers, elapsedMs, atmosphereOpacity, stopRainAudio],
  );

  const overlayLayer = visible ? (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        styles.overlay,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: config.atmosphereColor },
          atmosphereStyle,
        ]}
      />
      {canvasSize.width > 0 && canvasSize.height > 0 && (
        <LightningRainCanvas
          particles={particles}
          elapsedMs={elapsedMs}
          width={canvasSize.width}
          height={canvasSize.height}
          config={config}
        />
      )}
    </View>
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
  overlay: {
    zIndex: 1001,
    elevation: 1001,
  },
});
