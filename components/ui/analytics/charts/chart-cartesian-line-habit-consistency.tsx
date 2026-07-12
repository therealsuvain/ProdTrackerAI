import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Line, useChartPressState } from "victory-native";
import { matchFont } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";
import { SingleSeriesTooltipContent } from "./tool-tips/tooltip-content-single";
import { TooltipShell } from "./tool-tips/tooltip-shell";

export const HabitConsistencyChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const tickCount = isDetail ? 5 : 3;
  const { heightScale } = getDetailScale("habit_consistency");
  const data = MetricsTransformer.getHabitConsistency(metrics?.daily || {});
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
    y: { adherence: 0 },
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
        Habit Consistency
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="date"
        yKeys={["adherence"]}
        xAxis={{
          font,
          lineWidth: 1,
          lineColor: theme.text,
          labelColor: theme.text,
          labelRotate: -45,
          formatXLabel: (label) => {
            const date = new Date(label);
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          },
        }}
        yAxis={[
          {
            font,
            title: { text: "Created - Completed", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
            enableRescaling: true,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Line
              points={points.adherence}
              color="#4CAF50"
              strokeWidth={3}
              curveType="step"
              animate={{ type: "timing", duration: 250 }}
            />
            {isActive && (
              <TooltipShell
                x={state.x.position}
                y={state.y.adherence.position}
                chartBounds={chartBounds}
                theme={theme}
                renderContent={(cardX, cardY) => (
                  <SingleSeriesTooltipContent
                    cardX={cardX}
                    cardY={cardY}
                    value={state.y.adherence.value}
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
