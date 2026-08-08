import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { CartesianChart, Bar, BarGroup, StackedBar } from "victory-native";
import { Circle, Line, matchFont, vec } from "@shopify/react-native-skia";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { getTickCount } from "@/components/ui/analytics/charts-layout/chart-common-config";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const TaskThroughputChart = ({
  tasks,
  variant = "grid",
  transformState = undefined,
  startDate,
  endDate,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("task_throughput");
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const { theme } = useTheme();
  const data = MetricsTransformer.getTaskThroughput(
    tasks,
    startDate!,
    endDate!,
  );
  const yDomainMax = Math.max(...data.map((d) => d.onTime + d.late));
  const tickCount = getTickCount(variant, data.length);
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
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: "#11e21b" }]} />
          <Text style={{ color: theme.text }}>Created</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: "#ff5100" }]} />
          <Text style={{ color: theme.text }}>Completed</Text>
        </View>
      </View>
      <CartesianChart
        data={data}
        xKey="date"
        yKeys={["onTime", "late"]}
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
          enableRescaling: true,
          tickCount,
        }}
        yAxis={[
          {
            font,
            lineWidth: 1,
            lineColor: theme.text,
            labelColor: theme.text,
            enableRescaling: true,
            tickCount,
          },
        ]}
        domain={{ y: [0, yDomainMax] }}
        domainPadding={{ left: 10, right: 10 }}
        //viewport={{ x: [0, 10] }}
        transformState={transformState}
      >
        {({ points, chartBounds }) => (
          <>
            <StackedBar
              animate={{ type: "spring" }}
              //innerPadding={innerPadding}
              chartBounds={chartBounds}
              points={[points.onTime, points.late]} // 👈 the order here must match the order above
              colors={["#11e21b", "#ff5100"]}
              barWidth={10}
              barOptions={({ isBottom, isTop }) => {
                return {
                  roundedCorners: isTop
                    ? {
                        topLeft: 10,
                        topRight: 10,
                      }
                    : undefined,
                };
              }}
            />
            {data.map((d, i) => {
              if (d.onTime !== 0 || d.late !== 0) return null; // only draw stub for fully-zero days
              const point = points.onTime[i]; // reuse the already-computed point for x-position
              if (!point) return null;
              return (
                <Line
                  p1={vec(point.x, chartBounds.bottom - 5)}
                  p2={vec(point.x, chartBounds.bottom)}
                  key={d.date}
                  color={theme.text}
                  style="stroke"
                  strokeWidth={isDetail ? 2 : 1}
                />
              );
            })}
          </>
        )}
      </CartesianChart>
    </View>
  );
};
{
  /* <Circle
                  key={d.date}
                  cx={point.x}
                  cy={chartBounds.bottom} // baseline
                  r={isDetail ? 4 : 2}
                  color={theme.text}
                /> */
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
