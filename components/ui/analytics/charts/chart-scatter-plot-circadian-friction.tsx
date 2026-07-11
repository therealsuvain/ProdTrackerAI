import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Scatter, useChartPressState } from "victory-native";
import { matchFont, Text as SkiaText } from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";
import { ScatterTooltipContent } from "./tool-tips/tooltip-content-scatter";
import { TooltipShell } from "./tool-tips/tooltip-shell";

export const CircadianFrictionChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale, widthScale } = getDetailScale("circadian_friction");
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const { theme } = useTheme();
  const data = MetricsTransformer.getCircadianFriction(metrics.daily);
  const tooltipFont = matchFont({
    fontFamily: "sans-serif",
    fontSize: 13,
    fontWeight: "600",
  });
  const tooltipLabelFont = matchFont({
    fontFamily: "sans-serif",
    fontSize: 10,
  });
  const { state, isActive } = useChartPressState({
    x: 0,
    y: { morningFailures: 0 },
  });
  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && {
          height: BASE_CHART_HEIGHT * heightScale,
        },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Circadian Friction
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="lateNightHours"
        yKeys={["morningFailures"]}
        xAxis={{
          font,
          title: { text: "Late Night", font, color: theme.text },
          lineWidth: 1,
          lineColor: theme.text,
          labelColor: theme.text,
        }}
        yAxis={[
          {
            font,
            title: { text: "Morning Failures", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Scatter
              points={points.morningFailures}
              shape={"circle"}
              color={theme.blueLightPrimary}
              animate={{ type: "timing", duration: 250 }}
            />
            {/* {isActive && (
              <TooltipShell
                x={state.x.position}
                y={state.y.morningFailures.position}
                chartBounds={chartBounds}
                theme={theme}
                renderContent={(cardX, cardY) => (
                  <ScatterTooltipContent
                    cardX={cardX}
                    cardY={cardY}
                    hour={state.x.value}
                    frictionScore={state.y.morningFailures.value}
                    theme={theme}
                    valueFont={tooltipFont}
                    labelFont={tooltipLabelFont}
                  />
                )}
              ></TooltipShell>
            )} */}
            {points.morningFailures.map((p, i) => (
              <SkiaText
                key={i}
                x={p.x - 10}
                y={p.y ? p.y - 12 : 0}
                text={String(data[i].morningFailures.toFixed(1))}
                font={tooltipLabelFont}
                color={theme.text}
              />
            ))}
          </>
        )}
      </CartesianChart>
    </View>
  );
};

const styles = StyleSheet.create({
  chartTitle: {
    fontSize: 16,
    marginBottom: 2,
    fontWeight: "bold",
    textAlign: "center",
  },
  chartContainer: {
    flex: 1,
    height: "99%",
    width: "90%",
  },
});
