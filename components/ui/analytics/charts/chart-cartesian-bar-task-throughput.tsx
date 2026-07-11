import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Bar, BarGroup } from "victory-native";
import { matchFont } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const TaskThroughputChart = ({
  tasks,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("task_throughput");
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const { theme } = useTheme();
  const data = MetricsTransformer.getTaskThroughput(tasks);

  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Task Throughput
      </Text>
      <CartesianChart
        data={data}
        xKey="date"
        yKeys={["due", "completed"]}
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
          },
        ]}
        domainPadding={{ left: 10, right: 10 }}
        viewport={{ x: [0, 10] }}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <BarGroup
            chartBounds={chartBounds}
            betweenGroupPadding={2}
            withinGroupPadding={1}
            barWidth={10}
            barCount={2}
          >
            <BarGroup.Bar
              points={points.due}
              color="#E0E0E0"
              animate={{ type: "timing", duration: 250 }}
            />
            <BarGroup.Bar
              points={points.completed}
              color="#5a5a5a"
              animate={{ type: "timing", duration: 250 }}
            />
          </BarGroup>
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
