import React from "react";
import {
  vec,
  Circle,
  RoundedRect,
  Group,
  Line as SkiaLine,
} from "@shopify/react-native-skia";
import {
  clamp,
  DerivedValue,
  SharedValue,
  useDerivedValue,
} from "react-native-reanimated";
import { ChartBounds } from "victory-native";

interface TooltipShellProps {
  x: SharedValue<number>;
  y: SharedValue<number>;
  chartBounds: ChartBounds;
  theme: any;
  cardWidth?: number;
  cardHeight?: number;
  showGuideLine?: boolean;
  showHaloDot?: boolean;
  renderContent: (
    cardX: SharedValue<number>,
    cardY: SharedValue<number>,
  ) => React.ReactNode;
}

export function TooltipShell({
  x,
  y,
  chartBounds,
  theme,
  cardWidth = 84,
  cardHeight = 44,
  showGuideLine = true,
  showHaloDot = true,
  renderContent,
}: TooltipShellProps) {
  const cardX = useDerivedValue(() =>
    clamp(
      x.value - cardWidth / 2,
      chartBounds.left,
      chartBounds.right - cardWidth,
    ),
  );
  const cardY = useDerivedValue(() => {
    const above = y.value - cardHeight - 14;
    return above < chartBounds.top ? y.value + 14 : above;
  });
  const guideLineStart = useDerivedValue(() => vec(x.value, chartBounds.top));
  const guideLineEnd = useDerivedValue(() => vec(x.value, chartBounds.bottom));

  const outerCircleCenter = useDerivedValue(() => vec(x.value, y.value));
  return (
    <Group>
      {showGuideLine && (
        <SkiaLine
          p1={guideLineStart}
          p2={guideLineEnd}
          color={theme.text + "33"}
          strokeWidth={1}
        />
      )}
      {/* Halo dot: translucent outer ring + solid inner core */}
      {showHaloDot && (
        <>
          <Circle
            c={outerCircleCenter}
            r={9}
            color={"rgba(33, 150, 243, 0.5)"}
          />
          <Circle
            c={outerCircleCenter}
            r={4.5}
            color={"rgba(33, 150, 243, 1)"}
          />
          <Circle
            c={outerCircleCenter}
            r={4.5}
            color={"rgba(33, 150, 243, 0.5)"}
            style="stroke"
            strokeWidth={1.5}
          />
        </>
      )}
      <RoundedRect
        x={cardX}
        y={cardY}
        width={cardWidth}
        height={cardHeight}
        r={10}
        color={"rgba(33, 150, 243, 0.5)"}
      />
      <RoundedRect
        x={cardX}
        y={cardY}
        width={cardWidth}
        height={cardHeight}
        r={10}
        style="stroke"
        strokeWidth={1}
        color={"rgba(0, 140, 255, 0.5)"}
      />
      {renderContent(cardX, cardY)}
    </Group>
  );
}
