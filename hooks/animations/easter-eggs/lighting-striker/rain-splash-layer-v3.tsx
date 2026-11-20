import React, { memo, useMemo } from "react";
import { Path, usePathValue } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

type Range = readonly [number, number];

/**
 * Numeric-only splash data. The render layer turns all active splashes into a
 * small number of animated Skia paths instead of mounting one component and
 * one Group/Path pair for every impact.
 */
export type RainSplashSpec = {
  id: number;
  startMs: number;
  durationMs: number;
  opacity: number;
  centerX: number;
  impactY: number;
  size: number;
  spreadX: number;
  spreadY: number;
};

export type RainSplashBuildOptions = {
  width: number;
  height: number;
  heavyDurationMs: number;
  totalDurationMs: number;
  ratePerSecond: number;
  maxCount: number;
  sizeRangeDp: Range;
  durationRangeMs: Range;
  opacity: number;
  bottomInsetDp: number;
};

export type RainSplashLayerProps = {
  splashes: readonly RainSplashSpec[];
  elapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  strokeWidth: number;
};

type SplashRenderSpec = {
  startMs: number;
  durationMs: number;
  opacity: number;
  centerX: number;
  impactY: number;
  size: number;
  spreadX: number;
  spreadY: number;
};

/** Ten alpha bands keep opacity changes smooth while limiting native paths. */
const SPLASH_ALPHA_BANDS = 10;

/**
 * Five detached straight flicks, ordered from left to right. Each tuple is
 * [startX, startY, endX, endY] in multiples of the splash size.
 *
 * The outer flicks travel sideways; the inner flicks travel higher. Together
 * they form the short, outward water burst shown in the supplied reference.
 */
const SPLASH_RAYS = [
  [-0.58, -0.18, -1.08, -0.42],
  [-0.29, -0.29, -0.57, -0.76],
  [-0.04, -0.39, 0.04, -0.98],
  [0.29, -0.29, 0.58, -0.75],
  [0.59, -0.18, 1.1, -0.41],
] as const;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

function smoothStep01(value: number): number {
  "worklet";
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Prepare spawn times and numeric geometry before the Canvas mounts.
 * No Skia paths are created here; all visible geometry is built in the
 * batched UI-thread path renderer below.
 */
export function buildRainSplashSpecs({
  width,
  height,
  heavyDurationMs,
  totalDurationMs,
  ratePerSecond,
  maxCount,
  sizeRangeDp,
  durationRangeMs,
  opacity,
  bottomInsetDp,
}: RainSplashBuildOptions): RainSplashSpec[] {
  const safeMaxCount = Math.max(0, Math.min(24, Math.floor(maxCount)));
  const safeRate = Math.max(0, Math.min(2.5, ratePerSecond));

  if (safeMaxCount === 0 || safeRate <= 0 || width <= 0 || height <= 0) {
    return [];
  }

  const minLifeMs = Math.max(
    1,
    Math.min(durationRangeMs[0], durationRangeMs[1]),
  );
  const maxLifeMs = Math.max(
    minLifeMs,
    Math.max(durationRangeMs[0], durationRangeMs[1]),
  );
  const lastSpawnMs = Math.max(0, totalDurationMs - maxLifeMs - 24);
  const taperMs = Math.max(1, totalDurationMs - heavyDurationMs);
  const impactY = Math.max(0, height - Math.max(0, bottomInsetDp));
  const minSize = Math.max(0, Math.min(sizeRangeDp[0], sizeRangeDp[1]));
  const maxSize = Math.max(minSize, Math.max(sizeRangeDp[0], sizeRangeDp[1]));
  const maxHorizontalReach = maxSize * 1.1;
  const sideMargin = Math.max(8, maxHorizontalReach + 2);
  const usableWidth = Math.max(0, width - sideMargin * 2);
  const specs: RainSplashSpec[] = [];

  // A jittered interval keeps impacts irregular. The configured rain taper
  // gradually lowers the chance of a splash occurring near the end.
  let timeMs = randomBetween(220, 520);

  while (timeMs < lastSpawnMs && specs.length < safeMaxCount) {
    const intensity =
      timeMs <= heavyDurationMs
        ? 1
        : 1 - clamp01((timeMs - heavyDurationMs) / taperMs);

    if (Math.random() <= intensity) {
      const size = randomBetween(minSize, maxSize);
      const durationMs = randomBetween(minLifeMs, maxLifeMs);
      const centerX = sideMargin + Math.random() * usableWidth;

      specs.push({
        id: specs.length,
        startMs: timeMs,
        durationMs,
        opacity: Math.max(0, Math.min(1, opacity * randomBetween(0.78, 1))),
        centerX,
        impactY,
        size,
        spreadX: randomBetween(0.94, 1.06),
        spreadY: randomBetween(0.94, 1.06),
      });
    }

    const intervalMs = 1000 / safeRate;
    timeMs += randomBetween(intervalMs * 0.72, intervalMs * 1.34);
  }

  return specs;
}

/**
 * One batch owns one Skia Path. The path is rebuilt on the UI thread as the
 * shared elapsed clock advances, and contains the five line flicks for every
 * splash currently assigned to this alpha band.
 */
const SplashPathBatch = memo(function SplashPathBatch({
  specs,
  bucketIndex,
  elapsedMs,
  lightningFlash,
  strokeWidth,
}: {
  specs: readonly SplashRenderSpec[];
  bucketIndex: number;
  elapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  strokeWidth: number;
}) {
  const animatedPath = usePathValue((path) => {
    "worklet";

    // This path changes every frame, so tell Skia not to cache it as static.
    path.setIsVolatile(true);

    const now = elapsedMs.value;
    const flashBoost = 1 + lightningFlash.value * 0.5;

    for (let i = 0; i < specs.length; i += 1) {
      const splash = specs[i];
      const rawProgress = (now - splash.startMs) / splash.durationMs;

      if (rawProgress < 0 || rawProgress >= 1) {
        continue;
      }

      const progress = clamp01(rawProgress);
      const entrance = smoothStep01(progress / 0.13);
      const fade = 1 - smoothStep01((progress - 0.23) / 0.77);
      const alpha = clamp01(splash.opacity * entrance * fade * flashBoost);

      if (alpha < 0.025) {
        continue;
      }

      const alphaBucket = Math.min(
        SPLASH_ALPHA_BANDS - 1,
        Math.floor(alpha * SPLASH_ALPHA_BANDS),
      );

      if (alphaBucket !== bucketIndex) {
        continue;
      }

      // The five flicks expand rapidly out of the impact point, then drift up
      // by a fraction of their size while their shared alpha band fades them.
      const expansion = 0.16 + 0.84 * smoothStep01(progress / 0.4);
      const rise = splash.size * 0.045 * smoothStep01(progress / 0.55);
      const scaleX = splash.size * splash.spreadX * expansion;
      const scaleY = splash.size * splash.spreadY * expansion;

      for (let rayIndex = 0; rayIndex < SPLASH_RAYS.length; rayIndex += 1) {
        const ray = SPLASH_RAYS[rayIndex];
        const startX = splash.centerX + ray[0] * scaleX;
        const startY = splash.impactY + ray[1] * scaleY - rise;
        const endX = splash.centerX + ray[2] * scaleX;
        const endY = splash.impactY + ray[3] * scaleY - rise;

        path.moveTo(startX, startY);
        path.lineTo(endX, endY);
      }
    }
  });

  // Use the center of each opacity interval. With ten bands, quantization is
  // at most 0.05 alpha while the Canvas contains at most ten Path nodes.
  const bandOpacity = (bucketIndex + 0.5) / SPLASH_ALPHA_BANDS;

  return (
    <Path
      path={animatedPath}
      style="stroke"
      color="#D9EDFC"
      strokeWidth={strokeWidth}
      strokeCap="round"
      strokeJoin="round"
      opacity={bandOpacity}
    />
  );
});

/** Batched five-flick splash renderer. */
export const RainSplashLayer = memo(function RainSplashLayer({
  splashes,
  elapsedMs,
  lightningFlash,
  strokeWidth,
}: RainSplashLayerProps) {
  const renderSpecs = useMemo<SplashRenderSpec[]>(
    () =>
      splashes.map((splash) => ({
        startMs: splash.startMs,
        durationMs: splash.durationMs,
        opacity: splash.opacity,
        centerX: splash.centerX,
        impactY: splash.impactY,
        size: splash.size,
        spreadX: splash.spreadX,
        spreadY: splash.spreadY,
      })),
    [splashes],
  );

  if (renderSpecs.length === 0) {
    return null;
  }

  return (
    <>
      {Array.from({ length: SPLASH_ALPHA_BANDS }, (_, bucketIndex) => (
        <SplashPathBatch
          key={bucketIndex}
          specs={renderSpecs}
          bucketIndex={bucketIndex}
          elapsedMs={elapsedMs}
          lightningFlash={lightningFlash}
          strokeWidth={strokeWidth}
        />
      ))}
    </>
  );
});
