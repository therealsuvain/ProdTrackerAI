import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Line, Area } from "victory-native";
import { LinearGradient, matchFont, vec } from "@shopify/react-native-skia";
import { ChartProps } from "../charts-registry";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const TaskVelocityChart = ({
  tasks,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("task_velocity");
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const data = MetricsTransformer.getTaskVelocity(tasks);
  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Task Velocity
      </Text>
      <CartesianChart
        data={data}
        xKey="hour"
        yKeys={["completions"]}
        xAxis={{
          font,
          title: { text: "Hour", font, color: theme.text },
          lineWidth: 1,
          lineColor: theme.text,
          labelColor: theme.text,
        }}
        yAxis={[
          {
            font,
            title: { text: "Task Completions", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
          },
        ]}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.completions}
              y0={chartBounds.bottom}
              animate={{ type: "timing", duration: 250 }}
            >
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={["rgba(255, 0, 0, 0.66)", "rgba(255, 0, 0, 0.1)"]}
              />
            </Area>
            <Line
              points={points.completions}
              color="#ffffff"
              strokeWidth={2.5}
              curveType="natural"
              animate={{ type: "timing", duration: 250 }}
            />
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
