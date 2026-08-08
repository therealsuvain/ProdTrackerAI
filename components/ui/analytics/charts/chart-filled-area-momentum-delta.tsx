import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Area, Line, useChartPressState } from "victory-native";
import { LinearGradient, vec, matchFont } from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { getTickCount } from "@/components/ui/analytics/charts-layout/chart-common-config";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";
import { TooltipShell } from "./tool-tips/tooltip-shell";
import { SingleSeriesTooltipContent } from "./tool-tips/tooltip-content-single";

export const MomentumDeltaChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("momentum_delta");
  const data = MetricsTransformer.getMomentumDelta(metrics.daily);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
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
    x: "",
    y: { rollingAverage: 0 },
  });
  const tickCount = getTickCount(variant, data.length);
  return (
    <View
      style={[
        styles.chartContainer,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Momentum Delta
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="date"
        yKeys={["rollingAverage"]}
        xAxis={{
          font,
          lineWidth: 1,
          lineColor: theme.text,
          labelColor: theme.text,
          formatXLabel: (label) => {
            const date = new Date(label);
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          },
          enableRescaling: true,
          tickCount,
        }}
        yAxis={[
          {
            font,
            title: { text: "Overall App Activity", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
            enableRescaling: true,
            tickCount,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.rollingAverage}
              y0={chartBounds.bottom}
              animate={{ type: "timing", duration: 250 }}
            >
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={["rgba(33, 150, 243, 0.5)", "rgba(33, 150, 243, 0.0)"]}
              />
            </Area>
            <Line
              points={points.rollingAverage}
              color="#2196F3"
              strokeWidth={2}
              animate={{ type: "timing", duration: 300 }}
            />
            {isActive && (
              <TooltipShell
                x={state.x.position}
                y={state.y.rollingAverage.position}
                chartBounds={chartBounds}
                theme={theme}
                renderContent={(cardX, cardY) => (
                  <SingleSeriesTooltipContent
                    cardX={cardX}
                    cardY={cardY}
                    value={state.y.rollingAverage.value}
                    dateLabel={state.x.value}
                    theme={theme}
                    valueFont={tooltipFont}
                    labelFont={tooltipLabelFont}
                  />
                )}
              ></TooltipShell>
            )}
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
    height: "99%",
    width: "90%",
  },
});
