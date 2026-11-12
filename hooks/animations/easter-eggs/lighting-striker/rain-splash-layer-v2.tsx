import React, { memo } from "react";
import { Group, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

type Range = readonly [number, number];
type SkPath = ReturnType<typeof Skia.Path.Make>;

export type RainSplashSpec = {
  id: number;
  startMs: number;
  durationMs: number;
  opacity: number;
  centerX: number;
  impactY: number;
  size: number;
  path: SkPath;
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
 * Three separated, open flicks. Deliberately no crown, dots or ground ripple:
 * at normal UI scale those extra marks visually merged into a dense blob.
 * Paths are built before the Canvas mounts, never during React render.
 */
function createSplashPath(
  size: number,
  centerX: number,
  impactY: number,
  variant: number,
): SkPath {
  const path = Skia.Path.Make();
  const leftHeight = size * (variant === 0 ? 0.64 : 0.53);
  const centerHeight = size * (variant === 2 ? 0.92 : 1.04);
  const rightHeight = size * (variant === 1 ? 0.78 : 0.68);

  // Left flick: short and swept inward.
  path.moveTo(centerX - size * 0.92, impactY - size * 0.04);
  path.quadTo(
    centerX - size * 0.78,
    impactY - leftHeight,
    centerX - size * 0.34,
    impactY - leftHeight * 0.78,
  );

  // Center flick: slightly taller, but kept clearly separate from the sides.
  path.moveTo(centerX - size * 0.10, impactY - size * 0.02);
  path.quadTo(
    centerX + size * 0.10,
    impactY - centerHeight,
    centerX + size * 0.13,
    impactY - centerHeight * 0.52,
  );

  // Right flick: angled outward, mirroring the left without forming a crown.
  path.moveTo(centerX + size * 0.92, impactY - size * 0.04);
  path.quadTo(
    centerX + size * 0.76,
    impactY - rightHeight,
    centerX + size * 0.34,
    impactY - rightHeight * 0.80,
  );

  return path;
}

/**
 * Build a small, bounded set of splash paths while the rain scene is prepared.
 * Keeping this work out of RainSplashLayer's render path avoids mounting dozens
 * of components that each build their own Skia geometry and animation nodes.
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
  if (safeMaxCount === 0 || safeRate <= 0 || width <= 0 || height <= 0) return [];

  const minLifeMs = Math.max(1, Math.min(durationRangeMs[0], durationRangeMs[1]));
  const maxLifeMs = Math.max(minLifeMs, Math.max(durationRangeMs[0], durationRangeMs[1]));
  const lastSpawnMs = Math.max(0, totalDurationMs - maxLifeMs - 24);
  const taperMs = Math.max(1, totalDurationMs - heavyDurationMs);
  const impactY = Math.max(0, height - Math.max(0, bottomInsetDp));
  const usableWidth = Math.max(0, width - 28);
  const specs: RainSplashSpec[] = [];

  // A jittered interval keeps impacts irregular. The configured rain taper
  // gradually lowers the chance of a splash occurring near the end.
  let timeMs = randomBetween(220, 520);
  while (timeMs < lastSpawnMs && specs.length < safeMaxCount) {
    const intensity = timeMs <= heavyDurationMs
      ? 1
      : 1 - clamp01((timeMs - heavyDurationMs) / taperMs);

    if (Math.random() <= intensity) {
      const size = randomBetween(
        Math.min(sizeRangeDp[0], sizeRangeDp[1]),
        Math.max(sizeRangeDp[0], sizeRangeDp[1]),
      );
      const durationMs = randomBetween(minLifeMs, maxLifeMs);
      const centerX = 14 + Math.random() * usableWidth;
      const variant = Math.floor(Math.random() * 3);
      specs.push({
        id: specs.length,
        startMs: timeMs,
        durationMs,
        opacity: Math.max(0, Math.min(1, opacity * randomBetween(0.78, 1))),
        centerX,
        impactY,
        size,
        path: createSplashPath(size, centerX, impactY, variant),
      });
    }

    const intervalMs = 1000 / safeRate;
    timeMs += randomBetween(intervalMs * 0.72, intervalMs * 1.34);
  }

  return specs;
}

const RainSplash = memo(function RainSplash({
  splash,
  elapsedMs,
  lightningFlash,
  strokeWidth,
}: {
  splash: RainSplashSpec;
  elapsedMs: SharedValue<number>;
  lightningFlash: SharedValue<number>;
  strokeWidth: number;
}) {
  // Two derived values per splash: opacity and a subtle transform.
  const opacity = useDerivedValue(() => {
    const p = clamp01(
      (elapsedMs.value - splash.startMs) / splash.durationMs,
    );
    const entrance = clamp01(p / 0.10);
    const fade = 1 - smoothStep01((p - 0.16) / 0.84);
    const flashBoost = 1 + lightningFlash.value * 0.55;
    return Math.min(1, splash.opacity * entrance * fade * flashBoost);
  });

  const transform = useDerivedValue(() => {
    const p = clamp01(
      (elapsedMs.value - splash.startMs) / splash.durationMs,
    );
    const expansion = 0.88 + 0.18 * smoothStep01(p);
    const rise = -splash.size * 0.12 * smoothStep01(p);
    return [
      { scaleX: expansion },
      { scaleY: 0.92 + (expansion - 0.88) * 0.45 },
      { translateY: rise },
    ];
  });

  return (
    <Group
      origin={{ x: splash.centerX, y: splash.impactY }}
      transform={transform}
    >
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

/** Render-only layer: geometry and spawn timing are already prepared. */
export const RainSplashLayer = memo(function RainSplashLayer({
  splashes,
  elapsedMs,
  lightningFlash,
  strokeWidth,
}: RainSplashLayerProps) {
  if (splashes.length === 0) return null;

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
