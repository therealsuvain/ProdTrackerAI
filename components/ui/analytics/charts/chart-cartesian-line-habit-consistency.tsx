import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { matchFont } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

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
        {({ points }) => (
          <Line
            points={points.adherence}
            color="#4CAF50"
            strokeWidth={3}
            curveType="step"
            animate={{ type: "timing", duration: 250 }}
          />
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
