import React, { memo, useMemo } from "react";
import { Group, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

type Range = readonly [number, number];
type SplashPath = ReturnType<typeof Skia.Path.Make>;

type SplashSpec = {
  id: number;
  x: number;
  y: number;
  startMs: number;
  durationMs: number;
  size: number;
  opacity: number;
  path: SplashPath;
};

export type RainSplashLayerProps = {
  width: number;
  height: number;
  heavyDurationMs: number;
  totalDurationMs: number;
  elapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  enabled?: boolean;
  ratePerSecond?: number;
  maxCount?: number;
  sizeRangeDp?: Range;
  durationRangeMs?: Range;
  opacity?: number;
  strokeWidth?: number;
  bottomInsetDp?: number;
};

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
 * A small, static splash mark: a shallow crown, two side flicks and a few
 * upward droplets. Geometry is built once on JS; only its transform/opacity
 * are animated on the UI thread.
 */
function createSplashPath(
  size: number,
  variant: number,
  centerX: number,
  impactY: number,
): SplashPath {
  const path = Skia.Path.Make();
  const width = size * randomBetween(0.9, 1.22);
  const height = size * randomBetween(0.46, 0.76);
  const left = -width;
  const right = width;

  // Two short, curved splash arms rising from the impact point.
  path.moveTo(centerX + left, impactY);
  path.cubicTo(
    centerX + left * 0.82,
    impactY - height * 0.72,
    centerX - width * 0.28,
    impactY - height * 0.95,
    centerX - width * 0.08,
    impactY - height * 0.18,
  );
  path.moveTo(centerX + width * 0.08, impactY - height * 0.18);
  path.cubicTo(
    centerX + width * 0.28,
    impactY - height * 0.95,
    centerX + right * 0.82,
    impactY - height * 0.72,
    centerX + right,
    impactY,
  );

  // Scattered short droplets. Each variant changes the spacing slightly.
  const leftDropX = -width * (0.58 + variant * 0.035);
  const rightDropX = width * (0.48 + (2 - variant) * 0.045);
  path.moveTo(centerX + leftDropX, impactY - height * 0.16);
  path.lineTo(centerX + leftDropX - size * 0.07, impactY - height * (0.72 + variant * 0.08));
  path.moveTo(centerX + rightDropX, impactY - height * 0.15);
  path.lineTo(centerX + rightDropX + size * 0.08, impactY - height * (0.68 + (2 - variant) * 0.07));

  if (variant !== 1) {
    const centerOffsetX = (variant === 0 ? -1 : 1) * width * 0.12;
    path.moveTo(centerX + centerOffsetX, impactY - height * 0.12);
    path.lineTo(centerX + centerOffsetX * 1.15, impactY - height * 1.04);
  }

  // A low, subtle impact ripple.
  path.moveTo(centerX - width * 0.72, impactY + size * 0.045);
  path.quadTo(
    centerX,
    impactY - size * 0.075,
    centerX + width * 0.72,
    impactY + size * 0.045,
  );
  return path;
}

function buildSplashSpecs({
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
}: {
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
}): SplashSpec[] {
  const safeMaxCount = Math.max(0, Math.min(64, Math.floor(maxCount)));
  const safeRate = Math.max(0, Math.min(5, ratePerSecond));
  if (safeMaxCount === 0 || safeRate <= 0 || width <= 0 || height <= 0) return [];

  const maxLifeMs = Math.max(1, durationRangeMs[1]);
  const lastSpawnMs = Math.max(0, totalDurationMs - maxLifeMs - 16);
  const taperMs = Math.max(1, totalDurationMs - heavyDurationMs);
  const safeInset = Math.max(0, bottomInsetDp);
  const impactY = Math.max(0, height - safeInset);
  const halfWidth = Math.max(0, width - 24);
  const specs: SplashSpec[] = [];

  // A jittered interval avoids a mechanical beat. Spawn probability follows
  // the rain's heavy-to-taper intensity so splashes naturally thin with rain.
  let timeMs = randomBetween(180, 420);
  while (timeMs < lastSpawnMs && specs.length < safeMaxCount) {
    const rainIntensity = timeMs <= heavyDurationMs
      ? 1
      : 1 - clamp01((timeMs - heavyDurationMs) / taperMs);

    if (Math.random() <= rainIntensity) {
      const size = randomBetween(sizeRangeDp[0], sizeRangeDp[1]);
      const durationMs = randomBetween(durationRangeMs[0], durationRangeMs[1]);
      const x = 12 + Math.random() * halfWidth;
      const variant = Math.floor(Math.random() * 3);
      specs.push({
        id: specs.length,
        x,
        y: impactY,
        startMs: timeMs,
        durationMs,
        size,
        opacity: Math.max(0, Math.min(1, opacity * randomBetween(0.68, 1))),
        path: createSplashPath(size, variant, x, impactY),
      });
    }

    const averageIntervalMs = 1000 / safeRate;
    timeMs += randomBetween(averageIntervalMs * 0.58, averageIntervalMs * 1.42);
  }

  return specs;
}

const RainSplash = memo(function RainSplash({
  splash,
  elapsedMs,
  lightningFlash,
  strokeWidth,
}: {
  splash: SplashSpec;
  elapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  strokeWidth: number;
}) {
  const progress = useDerivedValue(() =>
    clamp01((elapsedMs.value - splash.startMs) / splash.durationMs),
  );

  const opacity = useDerivedValue(() => {
    const p = progress.value;
    const entrance = clamp01(p / 0.12);
    const fade = 1 - smoothStep01((p - 0.12) / 0.88);
    // Splashes catch the same short light pulse as the rain streaks.
    const flashBoost = 1 + lightningFlash.value * 0.65;
    return splash.opacity * entrance * fade * flashBoost;
  });

  const transform = useDerivedValue(() => {
    const p = progress.value;
    const expansion = 0.62 + 0.68 * smoothStep01(p);
    const rise = -splash.size * 0.18 * smoothStep01(p);
    return [
      { scaleX: expansion },
      { scaleY: 0.86 + expansion * 0.14 },
      { translateY: rise },
    ];
  });

  return (
    <Group origin={{ x: splash.x, y: splash.y }} transform={transform}>
      <Path
        path={splash.path}
        style="stroke"
        color="#D9EDFC"
        strokeWidth={strokeWidth}
        strokeCap="round"
        strokeJoin="round"
        opacity={opacity}
      />
    </Group>
  );
});

/**
 * Lightweight bottom-edge splash layer. Each splash is a prebuilt Skia path;
 * no per-frame particle simulation or path mutation is performed.
 */
export const RainSplashLayer = memo(function RainSplashLayer({
  width,
  height,
  heavyDurationMs,
  totalDurationMs,
  elapsedMs,
  lightningFlash,
  enabled = true,
  ratePerSecond = 1.8,
  maxCount = 34,
  sizeRangeDp = [2.6, 4.6],
  durationRangeMs = [280, 440],
  opacity = 0.72,
  strokeWidth = 1.15,
  bottomInsetDp = 2,
}: RainSplashLayerProps) {
  const splashes = useMemo(() => {
    if (!enabled) return [];
    return buildSplashSpecs({
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
    });
  }, [
    enabled,
    width,
    height,
    heavyDurationMs,
    totalDurationMs,
    ratePerSecond,
    maxCount,
    sizeRangeDp[0],
    sizeRangeDp[1],
    durationRangeMs[0],
    durationRangeMs[1],
    opacity,
    bottomInsetDp,
  ]);

  return (
    <>
      {splashes.map((splash) => (
        <RainSplash
          key={splash.id}
          splash={splash}
          elapsedMs={elapsedMs}
          lightningFlash={lightningFlash}
          strokeWidth={strokeWidth}
        />
      ))}
    </>
  );
});
