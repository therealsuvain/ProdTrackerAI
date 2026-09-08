import React, { useMemo } from "react";
import {
  Canvas,
  Group,
  RoundedRect,
  Path,
  BlurMask,
  Skia,
  rect,
  rrect,
} from "@shopify/react-native-skia";
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  SharedValue,
} from "react-native-reanimated";

interface FrozenCardEffectProps {
  width: number;
  height: number;
  borderRadius: number;

  /**
   * 0 = completely normal
   * 1 = completely frozen
   */
  progress: SharedValue<number>;
}

function createPerimeterPath(width: number, height: number, radius: number) {
  //const path = Skia.PathBuilder.Make();
  const path = Skia.Path.Make();

  // Intentionally irregular so the ice doesn't
  // look like a perfect rounded rectangle.
  const inset = 5;

  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;

  const topY = y0;
  const bottomY = y1;
  const leftX = x0;
  const rightX = x1;

  // Start near the top-left corner.
  path.moveTo(leftX + radius, topY);

  // TOP
  path.lineTo(width * 0.22, topY - 2);
  path.lineTo(width * 0.38, topY + 3);
  path.lineTo(width * 0.54, topY - 1);
  path.lineTo(width * 0.7, topY + 4);
  path.lineTo(width - radius, topY);

  // RIGHT
  path.lineTo(rightX, height * 0.2);
  path.lineTo(rightX - 4, height * 0.35);
  path.lineTo(rightX + 2, height * 0.52);
  path.lineTo(rightX - 3, height * 0.7);
  path.lineTo(rightX, height - radius);

  // BOTTOM
  path.lineTo(width * 0.78, bottomY + 3);
  path.lineTo(width * 0.63, bottomY - 2);
  path.lineTo(width * 0.47, bottomY + 3);
  path.lineTo(width * 0.3, bottomY - 2);
  path.lineTo(width * 0.16, bottomY + 2);
  path.lineTo(leftX + radius, bottomY);

  // LEFT
  path.lineTo(leftX, height * 0.76);
  path.lineTo(leftX + 3, height * 0.59);
  path.lineTo(leftX - 2, height * 0.4);
  path.lineTo(leftX + 3, height * 0.23);
  path.lineTo(leftX, topY + radius);

  return path.close();

  // return path.build();
}

function createCrackPaths(width: number, height: number) {
  const makePath = (points: Array<[number, number]>) => {
    //const path = Skia.PathBuilder.Make();
    const path = Skia.Path.Make();

    points.forEach(([x, y], index) => {
      if (index === 0) {
        path.moveTo(x * width, y * height);
      } else {
        path.lineTo(x * width, y * height);
      }
    });
    return path;
    //return path.build();
  };

  return [
    makePath([
      [0.18, 0.16],
      [0.27, 0.25],
      [0.24, 0.36],
      [0.34, 0.46],
      [0.3, 0.6],
    ]),

    makePath([
      [0.65, 0.1],
      [0.59, 0.2],
      [0.67, 0.29],
      [0.61, 0.41],
      [0.7, 0.53],
    ]),

    makePath([
      [0.47, 0.25],
      [0.41, 0.35],
      [0.47, 0.43],
      [0.42, 0.56],
      [0.5, 0.69],
    ]),

    makePath([
      [0.8, 0.42],
      [0.69, 0.49],
      [0.75, 0.61],
      [0.64, 0.72],
      [0.69, 0.86],
    ]),

    makePath([
      [0.1, 0.7],
      [0.22, 0.63],
      [0.29, 0.72],
      [0.38, 0.67],
    ]),
  ];
}

export function FrozenCardEffect({
  width,
  height,
  borderRadius,
  progress,
}: FrozenCardEffectProps) {
  const clip = useMemo(
    () => rrect(rect(0, 0, width, height), borderRadius, borderRadius),
    [width, height, borderRadius],
  );

  const perimeterPath = useMemo(
    () => createPerimeterPath(width, height, borderRadius),
    [width, height, borderRadius],
  );

  const crackPaths = useMemo(
    () => createCrackPaths(width, height),
    [width, height],
  );

  // ─────────────────────────────────────
  // 1. Cold tint
  // ─────────────────────────────────────

  const tintOpacity = useDerivedValue(() =>
    interpolate(
      progress.value,
      [0, 0.25, 1],
      [0, 0.08, 0.24],
      Extrapolation.CLAMP,
    ),
  );

  // ─────────────────────────────────────
  // 2. Perimeter growth
  // ─────────────────────────────────────

  const iceEnd = useDerivedValue(() =>
    interpolate(progress.value, [0.05, 0.75], [0, 1], Extrapolation.CLAMP),
  );

  // ─────────────────────────────────────
  // 3. Highlight
  // ─────────────────────────────────────

  const highlightOpacity = useDerivedValue(() =>
    interpolate(
      progress.value,
      [0.25, 0.75, 1],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    ),
  );

  // ─────────────────────────────────────
  // 4. Cracks
  // ─────────────────────────────────────

  const crack1Progress = useDerivedValue(() =>
    interpolate(progress.value, [0.35, 0.6], [0, 1], Extrapolation.CLAMP),
  );

  const crack2Progress = useDerivedValue(() =>
    interpolate(progress.value, [0.43, 0.68], [0, 1], Extrapolation.CLAMP),
  );

  const crack3Progress = useDerivedValue(() =>
    interpolate(progress.value, [0.51, 0.76], [0, 1], Extrapolation.CLAMP),
  );

  const crack4Progress = useDerivedValue(() =>
    interpolate(progress.value, [0.59, 0.84], [0, 1], Extrapolation.CLAMP),
  );

  const crack5Progress = useDerivedValue(() =>
    interpolate(progress.value, [0.67, 0.92], [0, 1], Extrapolation.CLAMP),
  );

  return (
    <Canvas
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
      }}
      pointerEvents="none"
    >
      <Group clip={clip}>
        {/* Cold translucent overlay */}
        <RoundedRect
          x={0}
          y={0}
          width={width}
          height={height}
          r={borderRadius}
          color="#DFF8FF"
          opacity={tintOpacity}
        />

        {/* Soft glow */}
        <Group opacity={iceEnd}>
          <Path
            path={perimeterPath}
            style="stroke"
            strokeWidth={18}
            color="#BCEEFF"
          >
            <BlurMask blur={10} style="normal" />
          </Path>
        </Group>

        {/* Main ice */}
        <Path
          path={perimeterPath}
          start={0}
          end={iceEnd}
          style="stroke"
          strokeWidth={9}
          color="#BFEFFF"
          strokeJoin="round"
          strokeCap="round"
        />

        {/* Bright icy edge */}
        <Path
          path={perimeterPath}
          start={0}
          end={iceEnd}
          style="stroke"
          strokeWidth={3}
          color="#F3FDFF"
          strokeJoin="round"
          strokeCap="round"
          opacity={highlightOpacity}
        />

        {/* Crack 1 */}
        <Path
          path={crackPaths[0]}
          start={0}
          end={crack1Progress}
          style="stroke"
          strokeWidth={2.2}
          color="#8DDCF5"
          strokeJoin="round"
          strokeCap="round"
          opacity={0.9}
        />

        {/* Crack 2 */}
        <Path
          path={crackPaths[1]}
          start={0}
          end={crack2Progress}
          style="stroke"
          strokeWidth={2.2}
          color="#8DDCF5"
          strokeJoin="round"
          strokeCap="round"
          opacity={0.9}
        />

        {/* Crack 3 */}
        <Path
          path={crackPaths[2]}
          start={0}
          end={crack3Progress}
          style="stroke"
          strokeWidth={2.2}
          color="#8DDCF5"
          strokeJoin="round"
          strokeCap="round"
          opacity={0.9}
        />

        {/* Crack 4 */}
        <Path
          path={crackPaths[3]}
          start={0}
          end={crack4Progress}
          style="stroke"
          strokeWidth={2.2}
          color="#8DDCF5"
          strokeJoin="round"
          strokeCap="round"
          opacity={0.9}
        />

        {/* Crack 5 */}
        <Path
          path={crackPaths[4]}
          start={0}
          end={crack5Progress}
          style="stroke"
          strokeWidth={2.2}
          color="#8DDCF5"
          strokeJoin="round"
          strokeCap="round"
          opacity={0.9}
        />
      </Group>
    </Canvas>
  );
}
