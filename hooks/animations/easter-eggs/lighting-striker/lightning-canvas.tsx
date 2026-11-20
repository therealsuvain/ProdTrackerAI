import React, { memo, useMemo } from "react";
import { StyleSheet } from "react-native";
import { BlurMask, Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { LIGHTNING_STRIKER_TUNING } from "./lightning-config";
import type {
  LightningDepth,
  LightningSegment,
  LightningStrike,
} from "./lightning-types";

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

type BranchStrokePart = {
  id: string;
  depth: LightningDepth;
  points: { x: number; y: number }[];
  width: number;
  revealStart: number;
  revealDuration: number;
};

/**
 * Turns many two-point segment records into a small number of connected
 * branch paths. Main and primary branches are split into a few width sections
 * to retain the visual taper; small twigs stay as one path each.
 */
function buildBranchStrokeParts(
  segments: LightningSegment[],
): BranchStrokePart[] {
  const byBranch = new Map<string, LightningSegment[]>();
  for (const segment of segments) {
    const current = byBranch.get(segment.branchId);
    if (current) current.push(segment);
    else byBranch.set(segment.branchId, [segment]);
  }

  const parts: BranchStrokePart[] = [];
  for (const [branchId, branchSegments] of byBranch) {
    branchSegments.sort((a, b) => a.revealStart - b.revealStart);
    const depth = branchSegments[0].depth;
    const profile = LIGHTNING_STRIKER_TUNING.appearance.strokeWidths[depth];
    const requestedSections = Math.max(1, profile.widthSections);
    const sectionCount = Math.min(requestedSections, branchSegments.length);

    for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
      const startIndex = Math.floor(
        (sectionIndex * branchSegments.length) / sectionCount,
      );
      const endIndex = Math.max(
        startIndex + 1,
        Math.floor(((sectionIndex + 1) * branchSegments.length) / sectionCount),
      );
      const section = branchSegments.slice(startIndex, endIndex);
      if (section.length === 0) continue;

      const first = section[0];
      const last = section[section.length - 1];
      const points = [first.start, ...section.map((segment) => segment.end)];
      const totalLength = section.reduce(
        (sum, segment) => sum + segment.length,
        0,
      );
      const width =
        totalLength > 0
          ? section.reduce(
              (sum, segment) => sum + segment.width * segment.length,
              0,
            ) / totalLength
          : first.width;
      const revealEnd = last.revealStart + last.revealDuration;

      parts.push({
        id: `${branchId}-section-${sectionIndex}`,
        depth,
        points,
        width,
        revealStart: first.revealStart,
        revealDuration: Math.max(0.0001, revealEnd - first.revealStart),
      });
    }
  }

  // Draw the main trunk first, then primary, secondary and tertiary branches.
  // Their independent reveal values still control when each path becomes visible.
  parts.sort((a, b) => a.depth - b.depth || a.revealStart - b.revealStart);
  return parts;
}

type BranchStrokeProps = {
  part: BranchStrokePart;
  leaderProgress: SharedValue<number>;
  boltOpacity: SharedValue<number>;
  flashIntensity: SharedValue<number>;
};

const BranchStroke = memo(function BranchStroke({
  part,
  leaderProgress,
  boltOpacity,
  flashIntensity,
}: BranchStrokeProps) {
  const path = useMemo(() => {
    const result = Skia.Path.Make();
    const first = part.points[0];
    if (!first) return result;

    result.moveTo(first.x, first.y);
    for (let index = 1; index < part.points.length; index += 1) {
      result.lineTo(part.points[index].x, part.points[index].y);
    }
    return result;
  }, [part.points]);

  const revealedEnd = useDerivedValue(() =>
    clamp01((leaderProgress.value - part.revealStart) / part.revealDuration),
  );
  const electricOpacity = useDerivedValue(
    () =>
      boltOpacity.value *
      LIGHTNING_STRIKER_TUNING.appearance.electricGlowOpacity,
  );
  const coreOpacity = useDerivedValue(
    () =>
      boltOpacity.value *
      Math.min(
        1,
        LIGHTNING_STRIKER_TUNING.appearance.coreOpacity +
          flashIntensity.value * 0.04,
      ),
  );

  const { appearance } = LIGHTNING_STRIKER_TUNING;
  const profile = appearance.strokeWidths[part.depth];
  const drawOuterGlow = profile.outerGlowEnabled;
  const outerOpacity = useDerivedValue(
    () => boltOpacity.value * appearance.outerGlowOpacity,
  );

  const outerWidth = Math.max(
    profile.outerGlowMinWidth,
    part.width * appearance.outerGlowWidthMultiplier,
  );
  const electricWidth = Math.max(
    profile.electricGlowMinWidth,
    part.width * appearance.electricGlowWidthMultiplier,
  );
  const coreWidth = Math.max(
    profile.coreMinWidth,
    part.width * appearance.coreWidthMultiplier,
  );

  return (
    <>
      {/* Broad aura is deliberately reserved for the trunk and primary forks. */}
      {drawOuterGlow && (
        <Path
          path={path}
          start={0}
          end={revealedEnd}
          style="stroke"
          color={appearance.outerGlowColor}
          strokeWidth={outerWidth}
          strokeCap="round"
          strokeJoin="round"
          opacity={outerOpacity}
        >
          <BlurMask blur={appearance.outerGlowBlur} style="normal" />
        </Path>
      )}

      {/* Every branch keeps the tighter electric-blue glow. */}
      <Path
        path={path}
        start={0}
        end={revealedEnd}
        style="stroke"
        color={appearance.electricGlowColor}
        strokeWidth={electricWidth}
        strokeCap="round"
        strokeJoin="round"
        opacity={electricOpacity}
      >
        <BlurMask blur={appearance.electricGlowBlur} style="normal" />
      </Path>

      {/* Crisp white core remains unblurred. */}
      <Path
        path={path}
        start={0}
        end={revealedEnd}
        style="stroke"
        color={appearance.coreColor}
        strokeWidth={coreWidth}
        strokeCap="round"
        strokeJoin="round"
        opacity={coreOpacity}
      />
    </>
  );
});

type LightningCanvasProps = {
  strike: LightningStrike;
  leaderProgress: SharedValue<number>;
  returnProgress: SharedValue<number>;
  boltOpacity: SharedValue<number>;
  flashIntensity: SharedValue<number>;
};

function buildPolyline(points: LightningStrike["mainPath"]) {
  const path = Skia.Path.Make();
  if (points.length === 0) return path;

  // Reverse order: the return stroke travels from the impact back to the cloud.
  const reversed = [...points].reverse();
  path.moveTo(reversed[0].x, reversed[0].y);
  for (let index = 1; index < reversed.length; index += 1) {
    path.lineTo(reversed[index].x, reversed[index].y);
  }
  return path;
}

export const LightningCanvas = memo(function LightningCanvas({
  strike,
  leaderProgress,
  returnProgress,
  boltOpacity,
  flashIntensity,
}: LightningCanvasProps) {
  const branchParts = useMemo(
    () => buildBranchStrokeParts(strike.segments),
    [strike.segments],
  );
  const returnPath = useMemo(
    () => buildPolyline(strike.mainPath),
    [strike.mainPath],
  );
  const returnGlowOpacity = useDerivedValue(
    () => boltOpacity.value * returnProgress.value * 0.95,
  );
  const returnCoreOpacity = useDerivedValue(
    () => boltOpacity.value * returnProgress.value,
  );

  const mainWidth = LIGHTNING_STRIKER_TUNING.generator.mainWidth;

  return (
    <Canvas style={StyleSheet.absoluteFillObject}>
      {branchParts.map((part) => (
        <BranchStroke
          key={part.id}
          part={part}
          leaderProgress={leaderProgress}
          boltOpacity={boltOpacity}
          flashIntensity={flashIntensity}
        />
      ))}

      {/* The return stroke races back up the main channel after connection. */}
      <Path
        path={returnPath}
        start={0}
        end={returnProgress}
        style="stroke"
        color="#58B8FF"
        strokeWidth={Math.max(1.4, mainWidth * 5.2)}
        strokeCap="round"
        strokeJoin="round"
        opacity={returnGlowOpacity}
      >
        <BlurMask blur={13} style="normal" />
      </Path>
      <Path
        path={returnPath}
        start={0}
        end={returnProgress}
        style="stroke"
        color="#FFFFFF"
        strokeWidth={Math.max(0.55, mainWidth * 1.25)}
        strokeCap="round"
        strokeJoin="round"
        opacity={returnCoreOpacity}
      />
    </Canvas>
  );
});
