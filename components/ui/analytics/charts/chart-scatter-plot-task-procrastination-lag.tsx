import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Scatter, useChartPressState } from "victory-native";
import { matchFont, Text as SkiaText } from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const TaskProcrastinationLagChart = ({
  tasks,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale, widthScale } = getDetailScale("circadian_friction");
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const { theme } = useTheme();
  const data = MetricsTransformer.getProcrastinationLag(tasks);
  const tooltipLabelFont = matchFont({
    fontFamily: "sans-serif",
    fontSize: 10,
  });
  const { state, isActive } = useChartPressState({
    x: "",
    y: { lagDays: 0 },
  });
  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && {
          height: BASE_CHART_HEIGHT * heightScale,
        },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        Task Procrastination
      </Text>
      <CartesianChart
        chartPressState={state}
        data={data}
        xKey="date"
        yKeys={["lagDays"]}
        xAxis={{
          font,
          title: { text: "Date", font, color: theme.text },
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
        }}
        yAxis={[
          {
            font,
            title: { text: "Completions", font, color: theme.text },
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
          },
        ]}
        transformState={transformState}
      >
        {({ points }) => (
          <>
            <Scatter
              points={points.lagDays}
              shape={"square"}
              color={"#ff9100"}
              animate={{ type: "spring" }}
            />
            {points.lagDays.map((p, i) => (
              <SkiaText
                key={i}
                x={p.x - 10}
                y={p.y ? p.y - 12 : 0}
                text={String(data[i].lagDays.toFixed(1))}
                font={tooltipLabelFont}
                color={theme.text}
              />
            ))}
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
    flex: 1,
    height: "99%",
    width: "90%",
  },
});
