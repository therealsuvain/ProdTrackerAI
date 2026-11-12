import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useAudioPlayer, type AudioSource } from "expo-audio";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withSequence,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export type LightningRainRange = readonly [number, number];
export type LightningRainDepth = 0 | 1 | 2;

export type LightningRainConfig = {
  enabled: boolean;
  chance: number;
  heavyDurationRangeMs: LightningRainRange;
  fadeDurationRangeMs: LightningRainRange;
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
  /** Number of independently retiring cohorts per depth layer. Defaults to 6. */
  fadeCohortsPerDepth?: number;
  /** Overlap/fade time for a retiring cohort. Defaults to 1100 ms. */
  cohortFadeDurationMs?: number;
  /** Raindrop streak angle, independent of sideways wind drift. Defaults to [-1.4, 1.4] degrees. */
  dropAngleRangeDegrees?: LightningRainRange;
  /** Small silence after the last lightning audio track ends before rain begins. Defaults to 120 ms. */
  startPaddingAfterLightningAudioMs?: number;
};

export type LightningRainController = {
  run: (width: number, height: number) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  overlayLayer: React.ReactNode;
};

type Timer = ReturnType<typeof setTimeout>;
type SkPath = ReturnType<typeof Skia.Path.Make>;

type RainCohort = {
  id: string;
  depth: LightningRainDepth;
  path: SkPath;
  retireAtMs: number;
  fadeMs: number;
  speedDpPerSecond: number;
  windSlope: number;
  strokeWidth: number;
  opacity: number;
};

type RainScene = {
  width: number;
  height: number;
  cohorts: RainCohort[];
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

/**
 * Build immutable, tiled paths ONCE on the JS thread.
 * Each drop is copied into three vertical tiles so the layer can wrap by one
 * canvas-height without a visible gap. No Skia path is mutated from a worklet.
 */
function createTiledCohortPath(
  drops: Array<{ x: number; y: number; length: number; slant: number }>,
  height: number,
  cohortIndex: number,
  groupWindSlope: number,
): SkPath {
  const path = Skia.Path.Make();
  for (let index = 0; index < drops.length; index += 1) {
    const drop = drops[index];
    const cohortDrift = (cohortIndex % 2 === 0 ? 1 : -1) * 0.35;
    // Two adjacent vertical tiles are sufficient for one-height wrapping.
    // The canvas clip hides the offscreen copy; no third copy is needed.
    for (let tile = -1; tile <= 0; tile += 1) {
      // The tile offset follows the cohort's base wind slope. Individual drops
      // have a tiny angle variation, but the repeating tile remains seamless.
      const x = drop.x + tile * groupWindSlope * height + cohortDrift;
      const y = drop.y + tile * height;
      path.moveTo(x, y);
      path.lineTo(x + drop.slant * drop.length, y + drop.length);
    }
  }
  return path;
}

function buildRainScene(
  width: number,
  height: number,
  heavyDurationMs: number,
  fadeDurationMs: number,
  drainDurationMs: number,
  config: LightningRainConfig,
): RainScene {
  const cohortCount = Math.max(
    3,
    Math.floor(config.fadeCohortsPerDepth ?? 6),
  );
  const cohortDrops: Array<Array<{ x: number; y: number; length: number; slant: number }>>[] = [
    Array.from({ length: cohortCount }, () => []),
    Array.from({ length: cohortCount }, () => []),
    Array.from({ length: cohortCount }, () => []),
  ];

  const depthDistribution: LightningRainDepth[] = [
    0, 0, 0, 1, 1, 1, 1, 2, 2, 2,
  ];
  const depthSpeedRanges: Record<LightningRainDepth, LightningRainRange> = {
    0: [
      config.speedRangeDpPerSecond[0],
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) * 0.42,
    ],
    1: [
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) * 0.25,
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) * 0.78,
    ],
    2: [
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) * 0.58,
      config.speedRangeDpPerSecond[1],
    ],
  };
  const depthLengthRanges: Record<LightningRainDepth, LightningRainRange> = {
    0: config.farDropLengthRange,
    1: config.midDropLengthRange,
    2: config.nearDropLengthRange,
  };
  const depthStrokeWidths: Record<LightningRainDepth, number> = {
    0: config.farStrokeWidth,
    1: config.midStrokeWidth,
    2: config.nearStrokeWidth,
  };
  const depthOpacities: Record<LightningRainDepth, number> = {
    0: config.farOpacity,
    1: config.midOpacity,
    2: config.nearOpacity,
  };

  for (let index = 0; index < Math.max(1, Math.floor(config.maxParticles)); index += 1) {
    const depth = depthDistribution[
      Math.floor(Math.random() * depthDistribution.length)
    ];
    const cohortIndex = Math.floor(Math.random() * cohortCount);
    const lengthRange = depthLengthRanges[depth];
    const length = randomBetween(lengthRange[0], lengthRange[1]);
    const dropAngleRange = config.dropAngleRangeDegrees ?? [-1.4, 1.4];
    const angle = randomBetween(dropAngleRange[0], dropAngleRange[1]);

    cohortDrops[depth][cohortIndex].push({
      x: randomBetween(-width * 0.08, width * 1.08),
      y: randomBetween(0, height),
      length,
      slant: Math.tan((angle * Math.PI) / 180),
    });
  }

  const totalTaperMs = fadeDurationMs + Math.max(0, drainDurationMs);
  const defaultCohortFadeMs = Math.max(
    500,
    config.cohortFadeDurationMs ?? 1100,
  );
  const cohorts: RainCohort[] = [];

  ([0, 1, 2] as const).forEach((depth) => {
    for (let cohortIndex = 0; cohortIndex < cohortCount; cohortIndex += 1) {
      const fadeMs = Math.min(
        defaultCohortFadeMs,
        Math.max(400, (totalTaperMs / Math.max(1, cohortCount - 1)) * 1.25),
      );
      const retirementSpan = Math.max(0, totalTaperMs - fadeMs);
      // Offset the three depth layers within each retirement slot so they
      // don't all thin out at exactly the same instant.
      const staggeredIndex = (cohortIndex + depth * 0.34) % cohortCount;
      const normalizedRetirement =
        cohortCount <= 1 ? 1 : staggeredIndex / (cohortCount - 1);
      const retireAtMs = heavyDurationMs + normalizedRetirement * retirementSpan;
      const groupWindAngle = randomBetween(
        config.windAngleRangeDegrees[0],
        config.windAngleRangeDegrees[1],
      );
      const windSlope = Math.tan((groupWindAngle * Math.PI) / 180);
      // Small angle variation is retained per drop, while each cohort shares
      // a base speed and wind drift so it can move as one static path group.
      const drops = cohortDrops[depth][cohortIndex];
      for (let dropIndex = 0; dropIndex < drops.length; dropIndex += 1) {
        const variation = Math.tan(
          randomBetween(-0.3, 0.3) * Math.PI / 180,
        );
        drops[dropIndex].slant += variation;
      }

      cohorts.push({
        id: `rain-${depth}-${cohortIndex}`,
        depth,
        path: createTiledCohortPath(
          drops,
          height,
          cohortIndex,
          windSlope,
        ),
        retireAtMs,
        fadeMs,
        speedDpPerSecond: randomBetween(
          depthSpeedRanges[depth][0],
          depthSpeedRanges[depth][1],
        ),
        windSlope,
        strokeWidth: depthStrokeWidths[depth],
        opacity: depthOpacities[depth],
      });
    }
  });

  return { width, height, cohorts };
}

const RainCohortPath = memo(function RainCohortPath({
  cohort,
  elapsedMs,
  baseOpacity,
  strokeWidth,
}: {
  cohort: RainCohort;
  elapsedMs: SharedValue<number>;
  baseOpacity: number;
  strokeWidth: number;
}) {
  const opacity = useDerivedValue(() => {
    const fadeProgress = clamp01(
      (elapsedMs.value - cohort.retireAtMs) / cohort.fadeMs,
    );
    return baseOpacity * (1 - fadeProgress);
  });

  return (
    <Path
      path={cohort.path}
      style="stroke"
      color="#D9EDFC"
      strokeWidth={strokeWidth}
      strokeCap="round"
      opacity={opacity}
    />
  );
});

const RainCohortGroup = memo(function RainCohortGroup({
  cohort,
  elapsedMs,
  height,
}: {
  cohort: RainCohort;
  elapsedMs: SharedValue<number>;
  height: number;
}) {
  // Each cohort has its own fixed speed and drift. This preserves natural
  // velocity variation without computing individual drop positions per frame.
  const transform = useDerivedValue(() => {
    const travelled = (elapsedMs.value * cohort.speedDpPerSecond) / 1000;
    const wrappedDistance = travelled % Math.max(1, height);
    return [
      { translateX: wrappedDistance * cohort.windSlope },
      { translateY: wrappedDistance },
    ];
  });

  return (
    <Group transform={transform}>
      <RainCohortPath
        cohort={cohort}
        elapsedMs={elapsedMs}
        baseOpacity={cohort.opacity}
        strokeWidth={cohort.strokeWidth}
      />
    </Group>
  );
});

const LightningRainCanvas = memo(function LightningRainCanvas({
  scene,
  elapsedMs,
}: {
  scene: RainScene;
  elapsedMs: SharedValue<number>;
}) {
  return (
    <Canvas style={StyleSheet.absoluteFillObject}>
      {scene.cohorts.map((cohort) => (
        <RainCohortGroup
          key={cohort.id}
          cohort={cohort}
          elapsedMs={elapsedMs}
          height={scene.height}
        />
      ))}
    </Canvas>
  );
});

/**
 * Optimized procedural rain.
 *
 * Rain path geometry is built once on JS when an event starts. The UI thread
 * only updates a small set of cohort transforms and opacities.
 * There is no per-frame loop over droplets, no mutation of Skia paths, and no
 * per-frame moveTo/lineTo calls.
 */
export function useLightningRain(
  source: AudioSource | null,
  config: LightningRainConfig,
): LightningRainController {
  const rainPlayer = useAudioPlayer(source);
  const [visible, setVisible] = useState(false);
  const [scene, setScene] = useState<RainScene | null>(null);

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
      // Audio cleanup must not prevent visual cancellation or completion.
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
          try {
            rainPlayer.volume = initialVolume * (1 - step / steps);
          } catch {
            // Audio interruption should not stop the rain visuals.
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
    // Leave the completed elapsed value alone; resetting it would briefly
    // restore all cohort opacities just as the Skia scene is being removed.
    activeRef.current = false;
    setVisible(false);
    setScene(null);
    stopRainAudio();
  }, [clearTimers, elapsedMs, atmosphereOpacity, stopRainAudio]);

  const run = useCallback(
    async (width: number, height: number): Promise<boolean> => {
      if (activeRef.current || width <= 0 || height <= 0) return false;
      activeRef.current = true;
      const runId = ++runIdRef.current;

      try {
        const heavyDurationMs = Math.round(randomBetween(
          config.heavyDurationRangeMs[0],
          config.heavyDurationRangeMs[1],
        ));
        const fadeDurationMs = Math.round(randomBetween(
          config.fadeDurationRangeMs[0],
          config.fadeDurationRangeMs[1],
        ));
        const drainDurationMs = Math.max(0, config.drainDurationMs);
        const totalTaperMs = fadeDurationMs + drainDurationMs;
        const totalDurationMs = heavyDurationMs + totalTaperMs;

        // Build immutable path geometry on JS once per activation.
        const nextScene = buildRainScene(
          width,
          height,
          heavyDurationMs,
          fadeDurationMs,
          drainDurationMs,
          config,
        );

        elapsedMs.value = 0;
        atmosphereOpacity.value = 0;
        setScene(nextScene);
        setVisible(true);

        elapsedMs.value = withTiming(totalDurationMs, {
          duration: totalDurationMs,
          easing: Easing.linear,
        });

        // Fade the storm tint in at the start, then fade it out during the
        // final rain taper instead of keeping an empty overlay alive afterward.
        const atmosphereFadeInMs = Math.min(
          Math.max(0, config.atmosphereFadeInMs),
          totalDurationMs,
        );
        const atmosphereFadeOutMs = Math.min(
          Math.max(0, config.atmosphereFadeOutMs),
          Math.max(0, totalDurationMs - atmosphereFadeInMs),
        );
        const atmosphereHoldMs = Math.max(
          0,
          totalDurationMs - atmosphereFadeInMs - atmosphereFadeOutMs,
        );
        atmosphereOpacity.value = withSequence(
          withTiming(config.atmosphereOpacity, {
            duration: atmosphereFadeInMs,
            easing: Easing.out(Easing.quad),
          }),
          withDelay(
            atmosphereHoldMs,
            withTiming(0, {
              duration: atmosphereFadeOutMs,
              easing: Easing.out(Easing.quad),
            }),
          ),
        );

        // The rain recording starts at its beginning and fades during the
        // configured emitter-retirement window, as in the previous version.
        try {
          rainPlayer.volume = Math.max(0, Math.min(1, config.audioVolume));
          await rainPlayer.seekTo(0);
          if (runId !== runIdRef.current) return false;
          rainPlayer.play();
        } catch (error) {
          console.warn(
            "[Lightning Rain] Rain audio playback failed; continuing silently.",
            error,
          );
        }

        scheduleAudioFade(heavyDurationMs, totalTaperMs, runId);
        const completed = await waitFor(totalDurationMs, runId);
        if (!completed || runId !== runIdRef.current) return false;

        // The atmosphere fade has already completed alongside the particle
        // taper. Remove the scene immediately; do not add a second fade wait.
        activeRef.current = false;
        setVisible(false);
        setScene(null);
        stopRainAudio();
        return true;
      } catch (error) {
        console.warn("[Lightning Rain] Event failed.", error);
        if (runId === runIdRef.current) {
          clearTimers();
          cancelAnimation(elapsedMs);
          cancelAnimation(atmosphereOpacity);
          activeRef.current = false;
          setVisible(false);
          setScene(null);
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

  const overlayLayer = visible && scene ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.overlay]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: config.atmosphereColor },
          atmosphereStyle,
        ]}
      />
      <LightningRainCanvas scene={scene} elapsedMs={elapsedMs} />
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
    overflow: "hidden",
  },
});
