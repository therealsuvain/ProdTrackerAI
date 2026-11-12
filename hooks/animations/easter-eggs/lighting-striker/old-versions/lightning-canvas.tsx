import React, { memo, useMemo } from "react";
import { StyleSheet } from "react-native";
import { BlurMask, Canvas, Path, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

import { LIGHTNING_STRIKER_TUNING } from "./lightning-config";
import type { LightningSegment, LightningStrike } from "./lightning-types";

function clamp01(value: number): number {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

type SegmentStrokeProps = {
  segment: LightningSegment;
  leaderProgress: SharedValue<number>;
  boltOpacity: SharedValue<number>;
  flashIntensity: SharedValue<number>;
};

const SegmentStroke = memo(function SegmentStroke({
  segment,
  leaderProgress,
  boltOpacity,
  flashIntensity,
}: SegmentStrokeProps) {
  const path = useMemo(() => {
    const result = Skia.Path.Make();
    result.moveTo(segment.start.x, segment.start.y);
    result.lineTo(segment.end.x, segment.end.y);
    return result;
  }, [segment.start.x, segment.start.y, segment.end.x, segment.end.y]);

  const revealedEnd = useDerivedValue(() =>
    clamp01(
      (leaderProgress.value - segment.revealStart) / segment.revealDuration,
    ),
  );
  const outerOpacity = useDerivedValue(
    () =>
      boltOpacity.value * LIGHTNING_STRIKER_TUNING.appearance.outerGlowOpacity,
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

  const showOuterAura = segment.depth <= 1;

  return (
    <>
      {/* Broad blue aura. */}
      {/*   <Path
        path={path}
        start={0}
        end={revealedEnd}
        style="stroke"
        color={appearance.outerGlowColor}
        strokeWidth={Math.max(2.2, segment.width * appearance.outerGlowWidthMultiplier)}
        strokeCap="round"
        strokeJoin="round"
        opacity={outerOpacity}
      >
        <BlurMask blur={appearance.outerGlowBlur} style="normal" />
      </Path> */}
      {/* Broad blue aura — only needed on Trunk & Primary Branches (depth 0 & 1) */}
      {showOuterAura && (
        <Path
          path={path}
          start={0}
          end={revealedEnd}
          style="stroke"
          color={appearance.outerGlowColor}
          strokeWidth={Math.max(
            2.0,
            segment.width * appearance.outerGlowWidthMultiplier,
          )}
          strokeCap="round"
          strokeJoin="round"
          opacity={outerOpacity}
        >
          <BlurMask blur={appearance.outerGlowBlur} style="normal" />
        </Path>
      )}

      {/* Saturated electric-blue channel. */}
      <Path
        path={path}
        start={0}
        end={revealedEnd}
        style="stroke"
        color={appearance.electricGlowColor}
        strokeWidth={Math.max(
          1.25,
          segment.width * appearance.electricGlowWidthMultiplier,
        )}
        strokeCap="round"
        strokeJoin="round"
        opacity={electricOpacity}
      >
        <BlurMask blur={appearance.electricGlowBlur} style="normal" />
      </Path>

      {/* White-hot electrical core. */}
      <Path
        path={path}
        start={0}
        end={revealedEnd}
        style="stroke"
        color={appearance.coreColor}
        strokeWidth={Math.max(
          0.65,
          segment.width * appearance.coreWidthMultiplier,
        )}
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
      {strike.segments.map((segment) => (
        <SegmentStroke
          key={segment.id}
          segment={segment}
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
        strokeWidth={mainWidth * 5.2}
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
        strokeWidth={mainWidth * 1.25}
        strokeCap="round"
        strokeJoin="round"
        opacity={returnCoreOpacity}
      />
    </Canvas>
  );
});
