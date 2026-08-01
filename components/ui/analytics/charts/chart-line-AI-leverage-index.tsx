import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { matchFont } from "@shopify/react-native-skia";
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Line, useChartPressState } from "victory-native";
import { ChartProps } from "../charts-registry";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";
import { MultiSeriesTooltipContent } from "./tool-tips/tooltip-content-multi";
import { TooltipShell } from "./tool-tips/tooltip-shell";

export const AILeverageChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("ai_leverage");
  const data = MetricsTransformer.getAILeverageData(metrics.daily);
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
  const { theme } = useTheme();
  const { state, isActive } = useChartPressState({
    x: "",
    y: { manualActions: 0, aiActions: 0 },
  });
  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        AI Leverage
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="date"
        yKeys={["manualActions", "aiActions"]}
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
            title: { text: "Time and AI Actions", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Line
              points={points.manualActions}
              color="#2196F3"
              strokeWidth={3}
              animate={{ type: "timing", duration: 250 }}
            />
            <Line
              points={points.aiActions}
              color="#9C27B0"
              strokeWidth={3}
              animate={{ type: "timing", duration: 250 }}
            />
            {isActive && (
              <TooltipShell
                x={state.x.position}
                y={state.y.manualActions.position}
                chartBounds={chartBounds}
                theme={theme}
                cardHeight={50}
                renderContent={(cardX, cardY) => (
                  <MultiSeriesTooltipContent
                    cardX={cardX}
                    cardY={cardY}
                    dateLabel={state.x.value}
                    series={[
                      {
                        value: state.y.manualActions.value,
                        label: "Manual",
                        color: "#2196F3",
                      },
                      {
                        value: state.y.aiActions.value,
                        label: "AI Actions",
                        color: "#A78BFA",
                      },
                    ]}
                    valueFont={tooltipFont}
                    labelFont={tooltipLabelFont}
                    theme={theme}
                  />
                )}
              />
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
