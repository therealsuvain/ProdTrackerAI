import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { CartesianChart, BarGroup } from "victory-native";
import { matchFont, Text as SkiaText } from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const ExecutionFunnelChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("execution_funnel");
  const data = MetricsTransformer.getExecutionFunnelData(metrics.daily);
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
          Execution Funnel
        </Text>
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={["completed", "missed", "abandoned"]}
          xAxis={{
            font,
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
              title: {
                text: "Completed - Missed - Abandoned",
                font,
                color: theme.text,
              },
              lineWidth: 1,
              lineColor: theme.text,
              labelColor: theme.text,
            },
          ]}
          domainPadding={{ left: 10, right: 5 }}
          viewport={{ x: [0, 10] }}
          transformState={transformState}
        >
          {({ points, chartBounds }) => (
            <>
              <BarGroup
                chartBounds={chartBounds}
                betweenGroupPadding={2}
                withinGroupPadding={1}
                barWidth={10}
                barCount={3}
              >
                <BarGroup.Bar
                  points={points.completed}
                  color={theme.success}
                  animate={{ type: "timing", duration: 250 }}
                />
                <BarGroup.Bar
                  points={points.missed}
                  color={theme.error}
                  animate={{ type: "timing", duration: 250 }}
                />
                <BarGroup.Bar
                  points={points.abandoned}
                  color={theme.greyBasePrimary}
                  animate={{ type: "timing", duration: 250 }}
                />
              </BarGroup>
              {points.completed.map((p, i) => {
                return (
                  data[i].completed > 0 && (
                    <SkiaText
                      key={`completed-${i}`}
                      x={(p.x ?? 0) + 8}
                      y={(p.y ?? 0) - 4}
                      text={String(data[i].completed)}
                      font={tooltipLabelFont}
                      color={theme.text}
                    />
                  )
                );
              })}

              {points.missed.map((p, i) => {
                return (
                  data[i].missed > 0 && (
                    <SkiaText
                      key={`missed-${i}`}
                      x={(p.x ?? 0) - 4}
                      y={(p.y ?? 0) - 4}
                      text={String(data[i].missed)}
                      font={tooltipLabelFont}
                      color={theme.text}
                    />
                  )
                );
              })}
              {points.abandoned.map((p, i) => {
                return (
                  data[i].abandoned > 0 && (
                    <SkiaText
                      key={`missed-${i}`}
                      x={(p.x ?? 0) - 14}
                      y={(p.y ?? 0) - 4}
                      text={String(data[i].abandoned)}
                      font={tooltipLabelFont}
                      color={theme.text}
                    />
                  )
                );
              })}
            </>
          )}
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
});
