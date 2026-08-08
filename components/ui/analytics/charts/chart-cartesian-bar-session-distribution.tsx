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

export const SessionDistributionChart = ({
  logs,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("priority_completion");
  const data = MetricsTransformer.getSessionLengthDistribution(logs);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });

  const barColors = {
    "<15min": "#a1d8fc",
    "15-30min": "#81ccff",
    "30-60min": "#50b9ff",
    "60-120min": "#29a8fd",
    ">120min": "#0099ff",
  };
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
          Log Session's Distribution
        </Text>
        <CartesianChart
          data={data}
          xKey="label"
          yKeys={["count"]}
          xAxis={{
            font,
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
            labelRotate: isDetail ? 0 : -45,
            enableRescaling: true,
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
            left: isDetail ? 60 : 25,
            right: isDetail ? 60 : 25,
          }}
          transformState={transformState}
        >
          {({ points, chartBounds }) => {
            const lessThan15Points = points.count.filter(
              (p) => p.xValue === "<15min>",
            );
            const btw15and30Points = points.count.filter(
              (p) => p.xValue === "15-30min",
            );
            const btw30and60Points = points.count.filter(
              (p) => p.xValue === "30-60min",
            );
            const btw30and120Points = points.count.filter(
              (p) => p.xValue === "60-120min",
            );
            const moreThan120Points = points.count.filter(
              (p) => p.xValue === ">120min",
            );
            return (
              <>
                <Bar
                  points={lessThan15Points}
                  chartBounds={chartBounds}
                  color={barColors["<15min"]}
                  barWidth={isDetail ? 60 : 25}
                />

                <Bar
                  points={btw15and30Points}
                  chartBounds={chartBounds}
                  color={barColors["15-30min"]}
                  barWidth={isDetail ? 60 : 25}
                />

                <Bar
                  points={btw30and60Points}
                  chartBounds={chartBounds}
                  color={barColors["30-60min"]}
                  barWidth={isDetail ? 60 : 25}
                />
                <Bar
                  points={btw30and120Points}
                  chartBounds={chartBounds}
                  color={barColors["60-120min"]}
                  barWidth={isDetail ? 60 : 25}
                />
                <Bar
                  points={moreThan120Points}
                  chartBounds={chartBounds}
                  color={barColors[">120min"]}
                  barWidth={isDetail ? 60 : 25}
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
