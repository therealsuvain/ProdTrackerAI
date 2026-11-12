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
    fontSize: 12,
  });
  const tickCount = getTickCount(variant, data.length);
  return (
    <>
      <View
        style={[
          styles.chartContainer,
          ,
          isDetail && {
            height: "100%",
            width: "100%",
            /* alignSelf: "stretch", */
          } /* { height: BASE_CHART_HEIGHT * heightScale } */,
        ]}
      >
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          Execution Funnel
        </Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[styles.colorBox, { backgroundColor: theme.success }]}
            />
            <Text style={{ color: theme.text }}>Completed</Text>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.colorBox, { backgroundColor: theme.error }]} />
            <Text style={{ color: theme.text }}>Missed</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: theme.greyBasePrimary },
              ]}
            />
            <Text style={{ color: theme.text }}>Abandoned</Text>
          </View>
        </View>
        <View style={{ flex: 1 /* , width: "100%", alignSelf: "stretch" */ }}>
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
              enableRescaling: true,
              tickCount,
            }}
            yAxis={[
              {
                font,
                lineWidth: 1,
                lineColor: theme.text,
                labelColor: theme.text,
                tickCount,
                enableRescaling: true,
              },
            ]}
            //domainPadding={{ left: 10, right: 5 }}
            //viewport={{ x: [0, 10] }}
            transformState={transformState}
          >
            {({ points, chartBounds }) => (
              <>
                <BarGroup
                  chartBounds={chartBounds}
                  //betweenGroupPadding={2}
                  //withinGroupPadding={1}
                  //barWidth={10}
                  //barCount={3}
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
                        x={p.x ?? 0 /* + 8 */}
                        y={p.y ?? 0 /* - 4 */}
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
                        x={p.x ?? 0 /* - 4 */}
                        y={p.y ?? 0 /* - 4 */}
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
                        x={p.x ?? 0 /* - 14 */}
                        y={p.y ?? 0 /* - 4 */}
                        text={String(data[i].abandoned)}
                        font={tooltipLabelFont}
                        color={theme.text}
                      />
                    )
                  );
                })}
                {data.map((_, i) => {
                  const stubs: { key: string; x: number; color: string }[] = [];

                  if (data[i].completed === 0 && points.completed[i]) {
                    stubs.push({
                      key: `completed-stub-${i}`,
                      x: points.completed[i].x ?? 0,
                      color: theme.success,
                    });
                  }
                  if (data[i].missed === 0 && points.missed[i]) {
                    stubs.push({
                      key: `missed-stub-${i}`,
                      x: points.missed[i].x ?? 0,
                      color: theme.error,
                    });
                  }
                  if (data[i].abandoned === 0 && points.abandoned[i]) {
                    stubs.push({
                      key: `abandoned-stub-${i}`,
                      x: points.abandoned[i].x ?? 0,
                      color: theme.greyBasePrimary,
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
