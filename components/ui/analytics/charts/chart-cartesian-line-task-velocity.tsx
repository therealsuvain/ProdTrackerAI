import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Line, Area, useChartPressState } from "victory-native";
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
  const fontX = matchFont({
    fontFamily: "sans-serif",
    fontSize: 6,
  });
  const fontY = matchFont({
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
    y: { completions: 0 },
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
        When You Get Tasks Done
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="label"
        yKeys={["completions"]}
        xAxis={{
          font: fontX,
          lineWidth: 1,
          lineColor: theme.text,
          labelColor: theme.text,
          labelRotate: -45,
        }}
        yAxis={[
          {
            font: fontY,
            title: { text: "Task Completions", font: fontY, color: theme.text },
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
              curveType="cardinal50"
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
    fontSize: 12,
    marginBottom: 2,
    fontWeight: "bold",
    textAlign: "center",
  },
  chartContainer: {
    height: "99%",
    width: "90%",
  },
});
