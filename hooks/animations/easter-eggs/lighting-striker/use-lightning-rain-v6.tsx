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
import {
  buildRainSplashSpecs,
  RainSplashLayer,
  type RainSplashSpec,
} from "./rain-splash-layer-v4";
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
  runOnJS,
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
  /** @deprecated Retained for config compatibility only; rain has no start-delay behavior. */
  startPaddingAfterLightningAudioMs?: number;
  /** Raindrop streak angle, independent of sideways wind drift. Defaults to [-1.4, 1.4] degrees. */
  dropAngleRangeDegrees?: LightningRainRange;

  // Wind layer. The gust envelope below is sampled from the supplied 25.32s audio.
  windEnabled?: boolean;
  windAudioVolume?: number;
  windAudioFadeOutMs?: number;
  windAudioFadeSteps?: number;
  /** Maximum additional rain slant at full gust strength, before depth scaling. */
  windGustMaxAngleDegrees?: number;
  windGustDepthMultipliers?: readonly [number, number, number];

  // Rain response to the controller's secondary lightning strike.
  lightningReactiveRainEnabled?: boolean;
  lightningReactiveRainOpacityBoost?: number;
  lightningReactiveRainFadeMs?: number;

  // Controller-owned: schedule one automatic follow-up bolt during the rain.
  autoStrikeEnabled?: boolean;
  autoStrikeDelayMs?: number;

  // Optional bottom-edge splash details. Defaults provide a restrained first pass.
  splashEnabled?: boolean;
  splashRatePerSecond?: number;
  splashMaxCount?: number;
  splashSizeRangeDp?: LightningRainRange;
  splashDurationRangeMs?: LightningRainRange;
  splashOpacity?: number;
  splashStrokeWidth?: number;
  splashBottomInsetDp?: number;
};

export type LightningRainController = {
  run: (width: number, height: number) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  /** Briefly brightens existing drops to connect the rain with a lightning flash. */
  triggerLightningFlash: () => void;
  /** Delay until all rain cohorts have completed their extra-height entry. */
  getEntryDelayMs: () => number;
  overlayLayer: React.ReactNode;
};

type SkPath = ReturnType<typeof Skia.Path.Make>;

type RainCohort = {
  id: string;
  depth: LightningRainDepth;
  path: SkPath;
  retireAtMs: number;
  fadeMs: number;
  speedDpPerSecond: number;
  windSlope: number;
  gustMultiplier: number;
  strokeWidth: number;
  opacity: number;
};

type RainScene = {
  width: number;
  height: number;
  cohorts: RainCohort[];
  splashes: RainSplashSpec[];
  totalDurationMs: number;
  heavyDurationMs: number;
  /** Time until the slowest cohort has completed its extra screen-height entry. */
  entryDelayMs: number;
  windEnabled: boolean;
  windGustMaxAngleRadians: number;
  windGustDepthMultipliers: readonly [number, number, number];
  windAudioFadeOutMs: number;
  lightningReactiveRainEnabled: boolean;
  lightningReactiveRainOpacityBoost: number;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

// 500ms samples from the supplied 25.32s wind recording. The source was
// measured in 250ms RMS windows, normalized against its 5th/95th percentiles,
// then smoothed across 1.25s to avoid twitchy visual response.
const WIND_ENVELOPE_SAMPLE_MS = 500;
const WIND_AUDIO_DURATION_MS = 25_320;
const WIND_AUDIO_ENVELOPE = [
  0.11, 0.39, 0.77, 0.95, 0.98, 0.94, 0.88, 0.76, 0.7, 0.85, 0.97, 0.91, 0.74,
  0.49, 0.27, 0.18, 0.26, 0.4, 0.49, 0.5, 0.48, 0.42, 0.33, 0.21, 0.16, 0.1,
  0.07, 0.04, 0.04, 0.13, 0.31, 0.4, 0.41, 0.56, 0.78, 0.86, 0.82, 0.77, 0.68,
  0.68, 0.73, 0.8, 0.86, 0.87, 0.84, 0.75, 0.55, 0.28, 0.08, 0.01, 0.0,
] as const;

function sampleWindEnvelope(timeMs: number): number {
  "worklet";
  if (timeMs >= WIND_AUDIO_DURATION_MS) return 0;
  const position = Math.max(0, timeMs) / WIND_ENVELOPE_SAMPLE_MS;
  const lower = Math.min(WIND_AUDIO_ENVELOPE.length - 1, Math.floor(position));
  const upper = Math.min(WIND_AUDIO_ENVELOPE.length - 1, lower + 1);
  const fraction = position - lower;
  return (
    WIND_AUDIO_ENVELOPE[lower] +
    (WIND_AUDIO_ENVELOPE[upper] - WIND_AUDIO_ENVELOPE[lower]) * fraction
  );
}

function smoothStep01(value: number): number {
  "worklet";
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

// Direction is intentionally independent from volume: the recording supplies
// gust strength, while this slow profile makes the first and second gust banks
// lean in opposite directions. Every transition is smooth and returns to zero.
function sampleWindDirection(timeMs: number): number {
  "worklet";
  const seconds = timeMs / 1000;
  if (seconds < 6.2) return 1;
  if (seconds < 7.8) {
    return 1 - 1.72 * smoothStep01((seconds - 6.2) / 1.6);
  }
  if (seconds < 11.3) return -0.72;
  if (seconds < 14.5) {
    return -0.72 * (1 - smoothStep01((seconds - 11.3) / 3.2));
  }
  if (seconds < 15.8) return 0;
  if (seconds < 17.1) {
    return -smoothStep01((seconds - 15.8) / 1.3);
  }
  if (seconds < 22.8) return -1;
  if (seconds < 25.32) {
    return -(1 - smoothStep01((seconds - 22.8) / 2.52));
  }
  return 0;
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
  windEnabled: boolean,
): RainScene {
  const cohortCount = Math.max(3, Math.floor(config.fadeCohortsPerDepth ?? 6));
  const cohortDrops: Array<
    Array<{ x: number; y: number; length: number; slant: number }>
  >[] = [
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
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) *
          0.42,
    ],
    1: [
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) *
          0.25,
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) *
          0.78,
    ],
    2: [
      config.speedRangeDpPerSecond[0] +
        (config.speedRangeDpPerSecond[1] - config.speedRangeDpPerSecond[0]) *
          0.58,
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

  for (
    let index = 0;
    index < Math.max(1, Math.floor(config.maxParticles));
    index += 1
  ) {
    const depth =
      depthDistribution[Math.floor(Math.random() * depthDistribution.length)];
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
      // Clamp the depth offset to the final cohort slot. The old modulo
      // expression could produce an index between cohortCount - 1 and
      // cohortCount, placing the final cohort's fade beyond totalDurationMs.
      const staggeredIndex = cohortIndex + depth * 0.34;
      const normalizedRetirement =
        cohortCount <= 1 ? 1 : clamp01(staggeredIndex / (cohortCount - 1));
      const retireAtMs =
        heavyDurationMs + normalizedRetirement * retirementSpan;
      const groupWindAngle = randomBetween(
        config.windAngleRangeDegrees[0],
        config.windAngleRangeDegrees[1],
      );
      const windSlope = Math.tan((groupWindAngle * Math.PI) / 180);
      // Small angle variation is retained per drop, while each cohort shares
      // a base speed and wind drift so it can move as one static path group.
      const drops = cohortDrops[depth][cohortIndex];
      for (let dropIndex = 0; dropIndex < drops.length; dropIndex += 1) {
        const variation = Math.tan((randomBetween(-0.3, 0.3) * Math.PI) / 180);
        drops[dropIndex].slant += variation;
      }

      cohorts.push({
        id: `rain-${depth}-${cohortIndex}`,
        depth,
        path: createTiledCohortPath(drops, height, cohortIndex, windSlope),
        retireAtMs,
        fadeMs,
        speedDpPerSecond: randomBetween(
          depthSpeedRanges[depth][0],
          depthSpeedRanges[depth][1],
        ),
        windSlope,
        gustMultiplier: randomBetween(0.9, 1.1),
        strokeWidth: depthStrokeWidths[depth],
        opacity: depthOpacities[depth],
      });
    }
  });

  // The new initial offset adds one complete canvas-height of invisible
  // travel before each cohort enters its repeating rain position. Use the
  // slowest cohort so the full active/fade/drain timeline remains available
  // after every cohort has completed that entry.
  const safeHeight = Math.max(1, height);
  const entryDelayMs = Math.ceil(
    Math.max(
      ...cohorts.map(
        (cohort) => (safeHeight / Math.max(1, cohort.speedDpPerSecond)) * 1000,
      ),
    ),
  );

  for (const cohort of cohorts) {
    cohort.retireAtMs += entryDelayMs;
  }

  const baseTotalDurationMs = heavyDurationMs + totalTaperMs;
  const totalDurationMs = entryDelayMs + baseTotalDurationMs;

  // Splash timing is relative to the visible rain phase, not the hidden
  // entry window. Geometry is still prepared once before the Canvas mounts.
  const baseSplashes =
    config.splashEnabled === false
      ? []
      : buildRainSplashSpecs({
          width,
          height,
          heavyDurationMs,
          totalDurationMs: baseTotalDurationMs,
          ratePerSecond: config.splashRatePerSecond ?? 1.15,
          maxCount: config.splashMaxCount ?? 18,
          sizeRangeDp: config.splashSizeRangeDp ?? [7, 10],
          durationRangeMs: config.splashDurationRangeMs ?? [320, 470],
          opacity: config.splashOpacity ?? 0.82,
          bottomInsetDp: config.splashBottomInsetDp ?? 2,
        });
  const splashes = baseSplashes.map((splash) => ({
    ...splash,
    startMs: splash.startMs + entryDelayMs,
  }));

  return {
    width,
    height,
    cohorts,
    splashes,
    totalDurationMs,
    heavyDurationMs,
    entryDelayMs,
    windEnabled,
    windGustMaxAngleRadians:
      (Math.max(0, config.windGustMaxAngleDegrees ?? 6.5) * Math.PI) / 180,
    windGustDepthMultipliers: config.windGustDepthMultipliers ?? [
      0.42, 0.76, 1.08,
    ],
    windAudioFadeOutMs: Math.max(0, config.windAudioFadeOutMs ?? 1100),
    lightningReactiveRainEnabled: config.lightningReactiveRainEnabled !== false,
    lightningReactiveRainOpacityBoost: Math.max(
      0,
      config.lightningReactiveRainOpacityBoost ?? 2.4,
    ),
  };
}

const RainCohortPath = memo(function RainCohortPath({
  cohort,
  elapsedMs,
  baseOpacity,
  strokeWidth,
  lightningFlash,
  opacityBoost,
}: {
  cohort: RainCohort;
  elapsedMs: SharedValue<number>;
  baseOpacity: number;
  strokeWidth: number;
  lightningFlash: SharedValue<number>;
  opacityBoost: number;
}) {
  const opacity = useDerivedValue(() => {
    const fadeProgress = clamp01(
      (elapsedMs.value - cohort.retireAtMs) / cohort.fadeMs,
    );
    const liveOpacity = baseOpacity * (1 - fadeProgress);
    const flashBoost = lightningFlash.value * opacityBoost;
    return Math.min(1, liveOpacity * (1 + flashBoost));
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
  windElapsedMs,
  scene,
  lightningFlash,
}: {
  cohort: RainCohort;
  elapsedMs: SharedValue<number>;
  windElapsedMs: SharedValue<number>;
  scene: RainScene;
  lightningFlash: SharedValue<number>;
}) {
  // 18 cohort transforms remain the only per-frame movement work. Wind audio
  // RMS drives a smooth horizontal gust offset; no individual raindrop updates.
  const transform = useDerivedValue(() => {
    /* const travelled = (elapsedMs.value * cohort.speedDpPerSecond) / 1000;
    const wrappedDistance = travelled % Math.max(1, scene.height); */
    const travelled = (elapsedMs.value * cohort.speedDpPerSecond) / 1000;
    const canvasHeight = Math.max(1, scene.height);

    // Keep the cohort an extra screen-height above the viewport during the
    // startup window. Once it has travelled one canvas-height, switch into the
    // repeating two-tile path; the duplicated tiles make this wrap seamless.
    const verticalOffset =
      travelled < canvasHeight
        ? travelled - 2 * canvasHeight
        : travelled % canvasHeight;

    const horizontalOffset = verticalOffset * cohort.windSlope;
    const windFadeStartMs = Math.max(
      0,
      scene.totalDurationMs - scene.windAudioFadeOutMs,
    );
    const windFade =
      scene.windAudioFadeOutMs > 0
        ? 1 -
          clamp01(
            (elapsedMs.value - windFadeStartMs) / scene.windAudioFadeOutMs,
          )
        : 1;
    const windEnvelope = scene.windEnabled
      ? sampleWindEnvelope(windElapsedMs.value)
      : 0;
    const windDirection = scene.windEnabled
      ? sampleWindDirection(windElapsedMs.value)
      : 0;
    const gustAngle =
      windEnvelope *
      windDirection *
      scene.windGustMaxAngleRadians *
      scene.windGustDepthMultipliers[cohort.depth] *
      cohort.gustMultiplier *
      windFade;
    /* return [
      // Skewing the entire tiled layer makes the raindrops themselves lean
      // into gusts; the matching transform on both vertical tiles preserves wrap.
      { skewX: gustAngle },
      { translateX: wrappedDistance * cohort.windSlope },
      { translateY: wrappedDistance },
    ]; */
    return [
      { skewX: gustAngle },
      { translateX: horizontalOffset },
      { translateY: verticalOffset },
    ];
  });

  return (
    <Group transform={transform}>
      <RainCohortPath
        cohort={cohort}
        elapsedMs={elapsedMs}
        baseOpacity={cohort.opacity}
        strokeWidth={cohort.strokeWidth}
        lightningFlash={lightningFlash}
        opacityBoost={
          scene.lightningReactiveRainEnabled
            ? scene.lightningReactiveRainOpacityBoost
            : 0
        }
      />
    </Group>
  );
});

const LightningRainCanvas = memo(function LightningRainCanvas({
  scene,
  elapsedMs,
  windElapsedMs,
  lightningFlash,
  config,
}: {
  scene: RainScene;
  elapsedMs: SharedValue<number>;
  windElapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  config: LightningRainConfig;
}) {
  return (
    <Canvas style={StyleSheet.absoluteFillObject}>
      {scene.cohorts.map((cohort) => (
        <RainCohortGroup
          key={cohort.id}
          cohort={cohort}
          elapsedMs={elapsedMs}
          windElapsedMs={windElapsedMs}
          scene={scene}
          lightningFlash={lightningFlash}
        />
      ))}
      <RainSplashLayer
        splashes={scene.splashes}
        elapsedMs={elapsedMs}
        lightningFlash={lightningFlash}
        strokeWidth={config.splashStrokeWidth ?? 1.15}
      />
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
  windSource: AudioSource | null = null,
): LightningRainController {
  const rainPlayer = useAudioPlayer(source);
  const windPlayer = useAudioPlayer(windSource);
  const [visible, setVisible] = useState(false);
  const [scene, setScene] = useState<RainScene | null>(null);

  const activeRef = useRef(false);
  const entryDelayMsRef = useRef(0);
  const runIdRef = useRef(0);
  const completionResolverRef = useRef<((completed: boolean) => void) | null>(
    null,
  );
  const volumeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const elapsedMs = useSharedValue(0);
  const windElapsedMs = useSharedValue(0);
  const lightningFlash = useSharedValue(0);
  const atmosphereOpacity = useSharedValue(0);

  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: atmosphereOpacity.value,
  }));

  const clearTimers = useCallback(() => {
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

  const stopWindAudio = useCallback(() => {
    try {
      windPlayer.pause();
      windPlayer.volume = 0;
      void windPlayer.seekTo(0).catch(() => undefined);
    } catch {
      // Wind audio is optional and must never interrupt visual cleanup.
    }
  }, [windPlayer]);

  // This is called from Reanimated only after the UI-thread rain clock reaches
  // its final frame. Keeping cleanup tied to that callback prevents a JS timer
  // (or audio seek latency) from removing the scene early or leaving it frozen.
  const completeRunOnJS = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;

      clearTimers();
      cancelAnimation(windElapsedMs);
      cancelAnimation(lightningFlash);
      activeRef.current = false;
      setVisible(false);
      setScene(null);
      stopRainAudio();
      stopWindAudio();

      const resolve = completionResolverRef.current;
      completionResolverRef.current = null;
      resolve?.(true);
    },
    [clearTimers, stopRainAudio, stopWindAudio, windElapsedMs, lightningFlash],
  );

  const scheduleAudioFade = useCallback(
    (delayMs: number, fadeDurationMs: number, runId: number) => {
      const steps = Math.max(1, Math.floor(config.audioFadeSteps));
      const initialVolume = Math.max(0, Math.min(1, config.audioVolume));
      for (let step = 1; step <= steps; step += 1) {
        const timer = setTimeout(
          () => {
            volumeTimersRef.current.delete(timer);
            if (runId !== runIdRef.current) return;
            try {
              rainPlayer.volume = initialVolume * (1 - step / steps);
            } catch {
              // Audio interruption should not stop the rain visuals.
            }
          },
          delayMs + Math.round((fadeDurationMs * step) / steps),
        );
        volumeTimersRef.current.add(timer);
      }
    },
    [config.audioFadeSteps, config.audioVolume, rainPlayer],
  );

  const scheduleWindAudioFade = useCallback(
    (delayMs: number, fadeDurationMs: number, runId: number) => {
      const steps = Math.max(
        1,
        Math.floor(config.windAudioFadeSteps ?? config.audioFadeSteps),
      );
      const initialVolume = Math.max(
        0,
        Math.min(1, config.windAudioVolume ?? 0.32),
      );
      for (let step = 1; step <= steps; step += 1) {
        const timer = setTimeout(
          () => {
            volumeTimersRef.current.delete(timer);
            if (runId !== runIdRef.current) return;
            try {
              windPlayer.volume = initialVolume * (1 - step / steps);
            } catch {
              // Audio interruption should not stop the rain visuals.
            }
          },
          delayMs + Math.round((fadeDurationMs * step) / steps),
        );
        volumeTimersRef.current.add(timer);
      }
    },
    [
      config.windAudioFadeSteps,
      config.audioFadeSteps,
      config.windAudioVolume,
      windPlayer,
    ],
  );

  const triggerLightningFlash = useCallback(() => {
    if (!activeRef.current || config.lightningReactiveRainEnabled === false)
      return;
    cancelAnimation(lightningFlash);
    lightningFlash.value = withSequence(
      withTiming(1, { duration: 42, easing: Easing.out(Easing.quad) }),
      withTiming(0.34, { duration: 92, easing: Easing.out(Easing.quad) }),
      withTiming(0, {
        duration: config.lightningReactiveRainFadeMs ?? 430,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [
    config.lightningReactiveRainEnabled,
    config.lightningReactiveRainFadeMs,
    lightningFlash,
  ]);

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    clearTimers();
    cancelAnimation(elapsedMs);
    cancelAnimation(windElapsedMs);
    cancelAnimation(lightningFlash);
    cancelAnimation(atmosphereOpacity);
    // Leave elapsedMs untouched: resetting it would restore every cohort to
    // full opacity for a frame during cancellation.
    activeRef.current = false;
    setVisible(false);
    setScene(null);
    stopRainAudio();
    stopWindAudio();

    const resolve = completionResolverRef.current;
    completionResolverRef.current = null;
    resolve?.(false);
  }, [
    clearTimers,
    elapsedMs,
    windElapsedMs,
    lightningFlash,
    atmosphereOpacity,
    stopRainAudio,
    stopWindAudio,
  ]);

  const run = useCallback(
    (width: number, height: number): Promise<boolean> => {
      if (activeRef.current || width <= 0 || height <= 0) {
        return Promise.resolve(false);
      }

      activeRef.current = true;
      const runId = ++runIdRef.current;
      entryDelayMsRef.current = 0;
      let visualClockStartedAtMs = Date.now();

      try {
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
        const drainDurationMs = Math.max(0, config.drainDurationMs);
        const totalTaperMs = fadeDurationMs + drainDurationMs;

        // Build immutable path geometry on JS once per activation. The scene
        // duration includes the extra-height entry period.
        const nextScene = buildRainScene(
          width,
          height,
          heavyDurationMs,
          fadeDurationMs,
          drainDurationMs,
          config,
          Boolean(windSource) && config.windEnabled !== false,
        );
        const entryDelayMs = nextScene.entryDelayMs;
        const totalDurationMs = nextScene.totalDurationMs;
        entryDelayMsRef.current = entryDelayMs;

        elapsedMs.value = 0;
        windElapsedMs.value = 0;
        lightningFlash.value = 0;
        atmosphereOpacity.value = 0;
        setScene(nextScene);
        setVisible(true);

        // Fade the storm tint in at the start and out alongside the final
        // particle taper. The UI animation itself owns the completion signal.
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

        const completionPromise = new Promise<boolean>((resolve) => {
          completionResolverRef.current = resolve;
        });

        // No separate setTimeout is used for visual completion. This callback
        // fires when the UI-thread animation reaches its final frame.
        visualClockStartedAtMs = Date.now();
        elapsedMs.value = withTiming(
          totalDurationMs,
          {
            duration: totalDurationMs,
            easing: Easing.linear,
          },
          (finished) => {
            if (finished) {
              runOnJS(completeRunOnJS)(runId);
            }
          },
        );

        // Rain ambience and wind audio start independently of the visual clock.
        // A slow seek cannot postpone the UI animation or its completion callback.
        void (async () => {
          try {
            rainPlayer.volume = Math.max(0, Math.min(1, config.audioVolume));
            await rainPlayer.seekTo(0);
            if (runId !== runIdRef.current || !activeRef.current) return;
            rainPlayer.play();

            const elapsedBeforePlaybackMs = Date.now() - visualClockStartedAtMs;
            const remainingHeavyMs = Math.max(
              0,
              entryDelayMs + heavyDurationMs - elapsedBeforePlaybackMs,
            );
            scheduleAudioFade(remainingHeavyMs, totalTaperMs, runId);
          } catch (error) {
            console.warn(
              "[Lightning Rain] Rain audio playback failed; continuing silently.",
              error,
            );
          }
        })();

        if (windSource && config.windEnabled !== false) {
          void (async () => {
            try {
              const windVolume = Math.max(
                0,
                Math.min(1, config.windAudioVolume ?? 0.32),
              );
              windPlayer.volume = windVolume;
              await windPlayer.seekTo(0);
              if (runId !== runIdRef.current || !activeRef.current) return;

              // Start the visual envelope clock immediately beside player.play().
              windElapsedMs.value = withTiming(WIND_AUDIO_DURATION_MS, {
                duration: WIND_AUDIO_DURATION_MS,
                easing: Easing.linear,
              });
              windPlayer.play();

              const elapsedBeforeWindStartMs =
                Date.now() - visualClockStartedAtMs;
              const remainingUntilEventEndMs = Math.max(
                0,
                totalDurationMs - elapsedBeforeWindStartMs,
              );
              const fadeDuration = Math.min(
                Math.max(0, config.windAudioFadeOutMs ?? 1100),
                remainingUntilEventEndMs,
              );
              scheduleWindAudioFade(
                Math.max(0, remainingUntilEventEndMs - fadeDuration),
                fadeDuration,
                runId,
              );
            } catch (error) {
              console.warn(
                "[Lightning Rain] Wind audio playback failed; continuing without wind audio.",
                error,
              );
            }
          })();
        }

        return completionPromise;
      } catch (error) {
        console.warn("[Lightning Rain] Event failed.", error);
        if (runId === runIdRef.current) {
          clearTimers();
          cancelAnimation(elapsedMs);
          cancelAnimation(windElapsedMs);
          cancelAnimation(lightningFlash);
          cancelAnimation(atmosphereOpacity);
          activeRef.current = false;
          setVisible(false);
          setScene(null);
          stopRainAudio();
          stopWindAudio();
          const resolve = completionResolverRef.current;
          completionResolverRef.current = null;
          resolve?.(false);
        }
        return Promise.resolve(false);
      }
    },
    [
      config,
      elapsedMs,
      windElapsedMs,
      lightningFlash,
      atmosphereOpacity,
      rainPlayer,
      windPlayer,
      windSource,
      scheduleAudioFade,
      scheduleWindAudioFade,
      clearTimers,
      stopRainAudio,
      stopWindAudio,
      completeRunOnJS,
    ],
  );

  useEffect(
    () => () => {
      runIdRef.current += 1;
      clearTimers();
      cancelAnimation(elapsedMs);
      cancelAnimation(windElapsedMs);
      cancelAnimation(lightningFlash);
      cancelAnimation(atmosphereOpacity);
      stopRainAudio();
      stopWindAudio();
      activeRef.current = false;
      const resolve = completionResolverRef.current;
      completionResolverRef.current = null;
      resolve?.(false);
    },
    [
      clearTimers,
      elapsedMs,
      windElapsedMs,
      lightningFlash,
      atmosphereOpacity,
      stopRainAudio,
      stopWindAudio,
    ],
  );

  const getEntryDelayMs = useCallback(() => entryDelayMsRef.current, []);

  const overlayLayer =
    visible && scene ? (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.overlay]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: config.atmosphereColor },
            atmosphereStyle,
          ]}
        />
        <LightningRainCanvas
          scene={scene}
          elapsedMs={elapsedMs}
          windElapsedMs={windElapsedMs}
          lightningFlash={lightningFlash}
          config={config}
        />
      </View>
    ) : null;

  return useMemo(
    () => ({
      run,
      cancel,
      isRunning: () => activeRef.current,
      triggerLightningFlash,
      getEntryDelayMs,
      overlayLayer,
    }),
    [run, cancel, triggerLightningFlash, getEntryDelayMs, overlayLayer],
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1001,
    elevation: 1001,
    overflow: "hidden",
  },
});
