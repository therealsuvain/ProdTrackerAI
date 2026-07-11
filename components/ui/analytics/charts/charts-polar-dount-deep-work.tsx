import { AppMetrics } from "@/types/metrics";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { PolarChart, Pie } from "victory-native";
import { ChartProps } from "../charts-registry";
import { matchFont } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const DeepWorkChart = ({
  logs,
  categories,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("deep_work");
  const data = MetricsTransformer.getDeepWorkAllocation(logs, categories);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  return (
    <View
      style={[
        styles.chartContainer,
        ,
        isDetail && { height: BASE_CHART_HEIGHT * heightScale },
      ]}
    >
      <Text style={[styles.chartTitle, { color: theme.text }]}>Deep Work</Text>
      <PolarChart
        data={data}
        colorKey="color"
        valueKey="duration"
        labelKey="label"
        transformState={transformState}
      >
        <Pie.Chart innerRadius={50}>
          {() => (
            <Pie.Slice animate={{ type: "timing", duration: 250 }}>
              <Pie.Label font={font} color={theme.text} radiusOffset={0.75} />
            </Pie.Slice>
          )}
        </Pie.Chart>
      </PolarChart>
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
