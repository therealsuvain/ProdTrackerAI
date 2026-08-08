import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Area, Line, useChartPressState } from "victory-native";
import { LinearGradient, matchFont, vec } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { getTickCount } from "@/components/ui/analytics/charts-layout/chart-common-config";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";
import { SingleSeriesTooltipContent } from "./tool-tips/tooltip-content-single";
import { TooltipShell } from "./tool-tips/tooltip-shell";

export const TimedDurationsChart = ({
  logs,
  variant = "grid",
  transformState = undefined,
  startDate,
  endDate,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("focus_trend");
  const data = MetricsTransformer.getTimerDurations(logs, startDate!, endDate!);
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
  const tickCount = getTickCount(variant, data.length);
  const { state, isActive } = useChartPressState({
    x: "",
    y: { duration: 0 },
  });
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Time Logged
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="date"
        yKeys={["duration"]}
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
          labelRotate: -45,
          tickCount,
        }}
        yAxis={[
          {
            font,
            title: { text: "Seconds Logged", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
            formatYLabel: (label) => {
              const value = Number(label);

              if (value >= 1_000_000) {
                return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
              }

              if (value >= 1_000) {
                return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
              }

              return value.toString();
            },
            tickCount,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.duration}
              y0={chartBounds.bottom}
              animate={{ type: "timing", duration: 250 }}
            >
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={["rgba(0, 195, 255, 0.75)", "transparent"]}
              />
            </Area>
            <Line
              points={points.duration}
              color="#ffffff"
              strokeWidth={3}
              curveType="natural"
              animate={{ type: "timing", duration: 250 }}
            />
            {isActive && (
              <TooltipShell
                x={state.x.position}
                y={state.y.duration.position}
                chartBounds={chartBounds}
                theme={theme}
                renderContent={(cardX, cardY) => (
                  <SingleSeriesTooltipContent
                    cardX={cardX}
                    cardY={cardY}
                    value={state.y.duration.value}
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
