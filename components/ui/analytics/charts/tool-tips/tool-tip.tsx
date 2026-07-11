import React from "react";
import {
  vec,
  Circle,
  RoundedRect,
  Group,
  Line as SkiaLine,
  Text as SkiaText,
} from "@shopify/react-native-skia";
import { SharedValue, useDerivedValue } from "react-native-reanimated";

interface ToolTipProps {
  x: SharedValue<number>;
  y: SharedValue<number>;
  value: SharedValue<number>;
  dateLabel: SharedValue<string>;
  chartBounds: { top: number; bottom: number; left: number; right: number };
  theme: any;
  valueFont: any;
  labelFont: any;
}

const CARD_WIDTH = 84;
const CARD_HEIGHT = 44;
const CARD_GAP = 14;

export const ToolTip = ({
  x,
  y,
  value,
  dateLabel,
  chartBounds,
  theme,
  valueFont,
  labelFont,
}: ToolTipProps) => {
  // Keep the floating card inside the chart's horizontal bounds so it
  // never clips off the left/right edge as the finger nears either side.
  const cardX = useDerivedValue(() => {
    const half = CARD_WIDTH / 2;
    const raw = x.value - half;
    const min = chartBounds.left;
    const max = chartBounds.right - CARD_WIDTH;
    return Math.min(Math.max(raw, min), max);
  });

  const cardY = useDerivedValue(() => {
    // Prefer floating above the point; if too close to the top, flip below.
    const above = y.value - CARD_HEIGHT - CARD_GAP;
    return above < chartBounds.top ? y.value + CARD_GAP : above;
  });

  const valueText = useDerivedValue(() => {
    return `${value.value.toFixed(1)}`;
  });

  const dateText = useDerivedValue(() => {
    const d = new Date(dateLabel.value);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  const valueTextX = useDerivedValue(() => cardX.value + 12);
  const dateTextX = useDerivedValue(() => cardX.value + 12);
  const valueTextY = useDerivedValue(() => cardY.value + 18);
  const dateTextY = useDerivedValue(() => cardY.value + 34);

  const guideLineStart = useDerivedValue(() => vec(x.value, chartBounds.top));
  const guideLineEnd = useDerivedValue(() => vec(x.value, chartBounds.bottom));

  const outerCircleCenter = useDerivedValue(() => vec(x.value, y.value));

  return (
    <Group>
      {/* Vertical guide line tracking the active data point */}
      <SkiaLine
        p1={guideLineStart}
        p2={guideLineEnd}
        color={theme.text + "33"}
        strokeWidth={1}
      />

      {/* Halo dot: translucent outer ring + solid inner core */}
      <Circle c={outerCircleCenter} r={9} color={"rgba(33, 150, 243, 0.5)"} />
      <Circle c={outerCircleCenter} r={4.5} color={"rgba(33, 150, 243, 1)"} />
      <Circle
        c={outerCircleCenter}
        r={4.5}
        color={"rgba(33, 150, 243, 0.5)"}
        style="stroke"
        strokeWidth={1.5}
      />

      {/* Floating value card */}
      <RoundedRect
        x={cardX}
        y={cardY}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        r={10}
        color={"rgba(33, 150, 243, 0.5)"}
      ></RoundedRect>
      <RoundedRect
        x={cardX}
        y={cardY}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        r={10}
        style="stroke"
        strokeWidth={1}
        color={theme.text + "22"}
      />

      <SkiaText
        x={valueTextX}
        y={valueTextY}
        text={valueText}
        font={valueFont}
        color={theme.text}
      />
      <SkiaText
        x={dateTextX}
        y={dateTextY}
        text={dateText}
        font={labelFont}
        color={theme.text + "99"}
      />
    </Group>
  );
};
