import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { PolarChart, Pie } from "victory-native";
import { ChartProps } from "../charts-registry";
import { LinearGradient, matchFont, vec } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const ChatFollowThroughChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("deep_work");
  const data = MetricsTransformer.getChatFollowThrough(metrics.global);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: isDetail ? 20 : 14,
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
        Chat Follow Through
      </Text>
      <PolarChart
        data={data}
        colorKey="color"
        valueKey="value"
        labelKey={"label"}
        transformState={transformState}
      >
        <Pie.Chart innerRadius={0}>
          {({ slice }) => {
            const { startX, startY, endX, endY } = calculateGradientPoints(
              slice.radius,
              slice.startAngle,
              slice.endAngle,
              slice.center.x,
              slice.center.y,
            );
            const gradientColor =
              slice.color === "green"
                ? "lightgreen"
                : slice.color === "red"
                  ? "#ff6055"
                  : "#ffd107";
            return (
              <Pie.Slice animate={{ type: "timing", duration: 250 }}>
                <Pie.Label font={font} color={theme.text} radiusOffset={0.6} />
                <LinearGradient
                  start={vec(startX, startY)}
                  end={vec(endX, endY)}
                  colors={[slice.color, gradientColor]}
                  positions={[0, 2]}
                />
              </Pie.Slice>
            );
          }}
        </Pie.Chart>
      </PolarChart>
    </View>
  );
};
function calculateGradientPoints(
  radius: number,
  startAngle: number,
  endAngle: number,
  centerX: number,
  centerY: number,
) {
  // Calculate the midpoint angle of the slice for a central gradient effect
  const midAngle = (startAngle + endAngle) / 2;

  // Convert angles from degrees to radians
  const startRad = (Math.PI / 180) * startAngle;
  const midRad = (Math.PI / 180) * midAngle;

  // Calculate start point (inner edge near the pie's center)
  const startX = centerX + radius * 0.5 * Math.cos(startRad);
  const startY = centerY + radius * 0.5 * Math.sin(startRad);

  // Calculate end point (outer edge of the slice)
  const endX = centerX + radius * Math.cos(midRad);
  const endY = centerY + radius * Math.sin(midRad);

  return { startX, startY, endX, endY };
}

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
