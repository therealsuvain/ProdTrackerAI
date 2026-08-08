import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { CartesianChart, BarGroup } from "victory-native";
import {
  Line,
  matchFont,
  Text as SkiaText,
  vec,
} from "@shopify/react-native-skia";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { ChartProps } from "../charts-registry";
import { getTickCount } from "@/components/ui/analytics/charts-layout/chart-common-config";
import {
  getDetailScale,
  BASE_CHART_HEIGHT,
} from "../charts-layout/chart-detail-config";

export const FreezeRelianceChart = ({
  metrics,
  variant = "grid",
  transformState = undefined,
}: ChartProps) => {
  const isDetail = variant === "detail";
  const { heightScale } = getDetailScale("priority_completion");
  const data = MetricsTransformer.getFreezeReliance(metrics.daily);
  const { theme } = useTheme();
  const font = matchFont({
    fontFamily: "sans-serif",
    fontSize: 12,
  });
  const tooltipLabelFont = matchFont({
    fontFamily: "sans-serif",
    fontSize: 16,
  });
  const tickCount = getTickCount(variant, data.length);
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
          Freeze Reliance
        </Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: theme.blueLightPrimary },
              ]}
            />
            <Text style={{ color: theme.text }}>Manual-Frozen</Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: theme.blueDarkPrimary },
              ]}
            />
            <Text style={{ color: theme.text }}>Auto-Frozen</Text>
          </View>
        </View>
        <CartesianChart
          data={data}
          xKey="date"
          yKeys={["manualFreezes", "autoFreezes"]}
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
          domainPadding={{ left: 10, right: 5 }}
          //viewport={{ x: [0, 10] }}
          transformState={transformState}
        >
          {({ points, chartBounds }) => (
            <>
              <BarGroup
                chartBounds={chartBounds}
                //barWidth={15}
                barCount={2}
                //withinGroupPadding={0.99}
              >
                <BarGroup.Bar
                  points={points.manualFreezes}
                  color={theme.blueLightPrimary}
                  animate={{ type: "timing", duration: 250 }}
                />
                <BarGroup.Bar
                  points={points.autoFreezes}
                  color={theme.blueDarkPrimary}
                  animate={{ type: "timing", duration: 250 }}
                />
              </BarGroup>
              {data.map((_, i) => {
                const stubs: { key: string; x: number; color: string }[] = [];

                if (data[i].manualFreezes === 0 && points.manualFreezes[i]) {
                  stubs.push({
                    key: `manualFreezes-stub-${i}`,
                    x: points.manualFreezes[i].x ?? 0,
                    color: theme.blueLightPrimary,
                  });
                }
                if (data[i].autoFreezes === 0 && points.autoFreezes[i]) {
                  stubs.push({
                    key: `autoFreezes-stub-${i}`,
                    x: points.autoFreezes[i].x ?? 0,
                    color: theme.blueDarkPrimary,
                  });
                }

                return stubs.map((s) => (
                  <Line
                    key={s.key}
                    p1={vec(s.x, chartBounds.bottom - 5)}
                    p2={vec(s.x, chartBounds.bottom)}
                    color={s.color}
                    style="stroke"
                    strokeWidth={isDetail ? 2 : 1}
                  />
                ));
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
