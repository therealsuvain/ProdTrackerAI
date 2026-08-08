import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { CartesianChart, BarGroup, Bar } from "victory-native";
import { matchFont, Text as SkiaText } from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const PriorityCompletionChart = ({
  tasks,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("priority_completion");
  const data = MetricsTransformer.getPriorityCompletionRate(tasks);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const tooltipLabelFont = matchFont({
    fontFamily: "sans-serif",
    fontSize: 16,
  });
  return (
    <>
      <View
        style={[
          styles.chartContainer,
          ,
          isDetail && { height: BASE_CHART_HEIGHT * heightScale },
        ]}
      >
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          Priority Completion
        </Text>
        <CartesianChart
          data={data}
          xKey="priority"
          yKeys={["rate"]}
          xAxis={{
            font,
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
          }}
          yAxis={[
            {
              font,

              lineWidth: 1,
              lineColor: theme.text,
              labelColor: theme.text,
              enableRescaling: true,
            },
          ]}
          domainPadding={{
            left: isDetail ? 100 : 50,
            right: isDetail ? 100 : 50,
          }}
          transformState={transformState}
        >
          {({ points, chartBounds }) => {
            //const barColor = points.rate.xValue === "high" ? theme.habitBase : theme.habitSecondary;
            const highPoints = points.rate.filter((p) => p.xValue === "high");
            const mediumPoints = points.rate.filter(
              (p) => p.xValue === "medium",
            );
            const lowPoints = points.rate.filter((p) => p.xValue === "low");

            return (
              <>
                <Bar
                  points={highPoints}
                  chartBounds={chartBounds}
                  color={theme.eventBase}
                  barWidth={isDetail ? 100 : 50}
                />

                <Bar
                  points={mediumPoints}
                  chartBounds={chartBounds}
                  color={theme.habitBase}
                  barWidth={isDetail ? 100 : 50}
                />

                <Bar
                  points={lowPoints}
                  chartBounds={chartBounds}
                  color={theme.success}
                  barWidth={isDetail ? 100 : 50}
                />
              </>
            );
          }}
        </CartesianChart>
      </View>
    </>
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
    height: 200,
    width: "90%",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorBox: {
    width: 10,
    height: 10,
    marginRight: 6,
    borderRadius: 2,
  },
});
