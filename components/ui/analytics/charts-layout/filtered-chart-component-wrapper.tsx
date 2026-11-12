import { useFilteredMetrics } from "@/hooks/use-filtered-analytics-metrics";
import { CHART_REGISTRY, ChartProps } from "../charts-registry";
import { View, StyleSheet, Text } from "react-native";
import { MetricsTransformer } from "@/utils/Analytics/metrics-transformer";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

// FilteredChart.tsx — the missing piece
interface FilteredChartProps {
  chartId: string;
  chartProps: ChartProps; // your existing unfiltered metrics/tasks/habits/events/logs/tags/categories
  variant?: "grid" | "detail";
  transformState?: any;
}

type ChartArchetype =
  | "multi-bar"
  | "bar"
  | "area"
  | "line"
  | "donut"
  | "scatter";

interface ChartGhostMeta {
  title: string;
  archetype: ChartArchetype;
  legends?: Array<{
    label: string;
    colorKey: "success" | "error" | "grey" | "primary" | "warning";
  }>;
}

const CHART_GHOST_META: Record<string, ChartGhostMeta> = {
  execution_funnel: {
    title: "Execution Funnel",
    archetype: "multi-bar",
    legends: [
      { label: "Completed", colorKey: "success" },
      { label: "Missed", colorKey: "error" },
      { label: "Abandoned", colorKey: "grey" },
    ],
  },
  deep_work: {
    title: "Deep Work",
    archetype: "donut",
  },
  circadian_friction: {
    title: "Circadian Friction",
    archetype: "scatter",
  },
  ai_leverage: {
    title: "AI Leverage",
    archetype: "line",
  },
  momentum_delta: {
    title: "Momentum Delta",
    archetype: "area",
  },
  task_velocity: {
    title: "Task Velocity",
    archetype: "line",
  },
  habit_consistency: {
    title: "Habit Consistency",
    archetype: "line",
  },
  timed_durations: {
    title: "Timed Durations",
    archetype: "area",
  },
  task_throughput: {
    title: "Task Throughput",
    archetype: "multi-bar",
    legends: [
      { label: "On Time", colorKey: "success" },
      { label: "Late", colorKey: "error" },
    ],
  },
  task_procrastination: {
    title: "Task Procrastination",
    archetype: "scatter",
  },
  priority_completion: {
    title: "Priority Completion",
    archetype: "bar",
  },
  freeze_reliance: {
    title: "Freeze Reliance",
    archetype: "multi-bar",
  },
  chat_follow_through: {
    title: "Chat Follow Through",
    archetype: "donut",
  },
  session_distribution: {
    title: "Session Distribution",
    archetype: "bar",
  },
};

/**
 * Pinpoints whether a specific chart has any non-zero data to plot
 * using the exact same rules as MetricsTransformer.
 */
function checkHasChartData(
  chartId: string,
  metrics: ChartProps["metrics"],
  tasks: ChartProps["tasks"],
  logs: ChartProps["logs"],
  categories: ChartProps["categories"],
): boolean {
  const daily = metrics?.daily ?? {};
  const globalData = (metrics?.global ?? {}) as Record<string, any>;

  switch (chartId) {
    case "execution_funnel":
      return MetricsTransformer.getExecutionFunnelData(daily).some(
        (d) => d.completed > 0 || d.missed > 0 || d.abandoned > 0,
      );

    case "ai_leverage":
      return MetricsTransformer.getAILeverageData(daily as any).some(
        (d) => d.manualActions > 0 || d.aiActions > 0,
      );

    case "momentum_delta":
      return MetricsTransformer.getMomentumDelta(daily).some(
        (d) => d.rollingAverage > 0,
      );

    case "circadian_friction":
      return MetricsTransformer.getCircadianFriction(daily).length > 0;

    case "deep_work":
      return MetricsTransformer.getDeepWorkAllocation(logs, categories).some(
        (d) => d.duration > 0,
      );

    case "task_velocity":
      return MetricsTransformer.getTaskVelocity(tasks).some(
        (d) => d.completions > 0,
      );

    case "task_procrastination":
      return MetricsTransformer.getProcrastinationLag(tasks).length > 0;

    case "task_throughput":
      return (tasks ?? []).some((t) => t.completed && Boolean(t.completedAt));

    case "timed_durations":
      return (logs ?? []).some(
        (l) => Boolean(l.startTime) && (l.duration ?? 0) > 0,
      );

    case "habit_consistency":
      return Object.values(daily).some(
        (d: any) => (d.habitsCheckedIn ?? 0) + (d.habitsMissed ?? 0) > 0,
      );

    case "freeze_reliance":
      return MetricsTransformer.getFreezeReliance(daily).some(
        (d) => (d.manualFreezes ?? 0) > 0 || (d.autoFreezes ?? 0) > 0,
      );

    case "priority_completion":
      return (tasks ?? []).length > 0;

    case "chat_follow_through": {
      const total =
        (globalData.chatActionsConfirmed ?? 0) +
        (globalData.chatActionsExpired ?? 0) +
        (globalData.chatActionsCancelled ?? 0);
      return total > 0;
    }

    case "session_distribution":
      return MetricsTransformer.getSessionLengthDistribution(logs).some(
        (d) => d.count > 0,
      );

    default:
      return Object.keys(daily).length > 0;
  }
}

/**
 * Pure React Native (Zero-Skia) Ghost Silhouette matching each chart's visual type.
 */
const GhostChartSilhouette = ({
  archetype,
  isDetail,
  textColor,
}: {
  archetype: ChartArchetype;
  isDetail: boolean;
  textColor: string;
}) => {
  if (archetype === "donut") {
    const size = isDetail ? 210 : 108;
    const stroke = isDetail ? 34 : 20;
    return (
      <View style={styles.GhostCenter}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: textColor,
            opacity: 0.12,
          }}
        />
      </View>
    );
  }

  if (archetype === "scatter") {
    const dots = [
      { left: "18%", bottom: "22%" },
      { left: "32%", bottom: "58%" },
      { left: "48%", bottom: "35%" },
      { left: "64%", bottom: "72%" },
      { left: "78%", bottom: "28%" },
      { left: "54%", bottom: "18%" },
    ] as const;

    return (
      <View style={[styles.axesBox, { borderColor: textColor }]}>
        <View
          style={[styles.gridLineH, { top: "33%", backgroundColor: textColor }]}
        />
        <View
          style={[styles.gridLineH, { top: "66%", backgroundColor: textColor }]}
        />
        {dots.map((pos, idx) => (
          <View
            key={idx}
            style={[
              styles.scatterDot,
              {
                left: pos.left,
                bottom: pos.bottom,
                backgroundColor: textColor,
                width: isDetail ? 14 : 9,
                height: isDetail ? 14 : 9,
                borderRadius: 99,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  if (archetype === "area" || archetype === "line") {
    const heights = [28, 52, 38, 70, 48, 82, 60, 75];
    return (
      <View style={[styles.axesBox, { borderColor: textColor }]}>
        <View
          style={[styles.gridLineH, { top: "33%", backgroundColor: textColor }]}
        />
        <View
          style={[styles.gridLineH, { top: "66%", backgroundColor: textColor }]}
        />
        <View style={styles.barsRow}>
          {heights.map((h, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                backgroundColor:
                  archetype === "area" ? textColor : "transparent",
                borderTopWidth: 3,
                borderColor: textColor,
                opacity: archetype === "area" ? 0.55 : 0.85,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  // Default: "bar" or "multi-bar"
  const barHeights =
    archetype === "multi-bar"
      ? [45, 78, 30, 62, 88, 40, 70, 52]
      : [35, 72, 55, 85, 48];

  return (
    <View style={[styles.axesBox, { borderColor: textColor }]}>
      <View
        style={[styles.gridLineH, { top: "33%", backgroundColor: textColor }]}
      />
      <View
        style={[styles.gridLineH, { top: "66%", backgroundColor: textColor }]}
      />
      <View style={styles.barsRow}>
        {barHeights.map((h, i) => (
          <View
            key={i}
            style={{
              width: archetype === "multi-bar" ? "7%" : "12%",
              height: `${h}%`,
              backgroundColor: textColor,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
            }}
          />
        ))}
      </View>
    </View>
  );
};

export const FilteredChart = ({
  chartId,
  chartProps,
  variant,
  transformState,
}: FilteredChartProps) => {
  const ChartComponent = CHART_REGISTRY[chartId];
  const { theme } = useTheme();
  const { metrics, tasks, habits, events, timerLogs, startDate, endDate } =
    useFilteredMetrics(
      chartId,
      chartProps.metrics,
      chartProps.tasks,
      chartProps.habits,
      chartProps.events,
      chartProps.logs,
    );

  const hasData = useMemo(
    () =>
      checkHasChartData(
        chartId,
        metrics,
        tasks,
        timerLogs,
        chartProps.categories,
      ),
    [chartId, metrics, tasks, timerLogs, chartProps.categories],
  );

  if (!ChartComponent) return null;

  if (hasData) {
    return (
      <ChartComponent
        metrics={metrics}
        tasks={tasks}
        habits={habits}
        events={events}
        logs={timerLogs}
        tags={chartProps.tags}
        categories={chartProps.categories}
        transformState={transformState}
        startDate={startDate}
        endDate={endDate}
        variant={variant}
      />
    );
  }
  // Otherwise render the lightweight Zero-Canvas Ghost Silhouette
  const isDetail = variant === "detail";
  const meta = CHART_GHOST_META[chartId] ?? {
    title: chartId.replace(/_/g, " "),
    archetype: "bar",
  };

  const resolveLegendColor = (
    key: NonNullable<ChartGhostMeta["legends"]>[number]["colorKey"],
  ) => {
    switch (key) {
      case "success":
        return theme.success ?? "#22C55E";
      case "error":
        return theme.error ?? "#EF4444";
      case "warning":
        return "#F59E0B";
      case "primary":
        return theme.taskBase ?? "#3B82F6";
      default:
        return theme.greyBasePrimary ?? "#9CA3AF";
    }
  };

  return (
    <View
      style={[
        styles.ghostContainer,
        isDetail && { height: "100%", width: "100%", alignSelf: "stretch" },
      ]}
    >
      {/* Crisp Header: Title + Optional Legend */}
      <Text style={[styles.chartTitle, { color: theme.text }]}>
        {meta.title}
      </Text>

      {meta.legends && (
        <View style={styles.legendRow}>
          {meta.legends.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[
                  styles.colorBox,
                  {
                    backgroundColor: resolveLegendColor(item.colorKey),
                    opacity: 0.5,
                  },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.text }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Body: Dimmed Archetype Silhouette + Translucent Dark Badge */}
      <View style={styles.silhouetteViewport}>
        <GhostChartSilhouette
          archetype={meta.archetype}
          isDetail={isDetail}
          textColor={theme.text}
        />

        <View style={styles.overlayCenter} pointerEvents="none">
          <View
            style={[
              styles.noDataPill,
              isDetail && styles.noDataCardDetail,
              {
                backgroundColor: "rgba(16, 16, 22, 0.86)",
                borderColor: "rgba(255, 255, 255, 0.12)",
              },
            ]}
          >
            <Ionicons
              name="analytics-outline"
              size={isDetail ? 22 : 14}
              color={theme.greyBasePrimary ?? "#9CA3AF"}
            />
            <Text
              style={[styles.noDataTitle, isDetail && styles.noDataTitleDetail]}
            >
              No data in range
            </Text>
            {isDetail && (
              <Text style={styles.noDataSubtitle}>
                Adjust your date range or clear active filters to view metrics
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ghostContainer: {
    flex: 1,
    width: "92%",
    height: "100%",
    alignSelf: "center",
    paddingTop: 2,
    paddingBottom: 8,
  },
  chartTitle: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: "bold",
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendText: {
    fontSize: 11,
    opacity: 0.6,
  },
  colorBox: {
    width: 9,
    height: 9,
    marginRight: 5,
    borderRadius: 2,
  },
  silhouetteViewport: {
    flex: 1,
    width: "100%",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  GhostCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  axesBox: {
    width: "92%",
    height: "84%",
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    opacity: 0.13,
    justifyContent: "flex-end",
    position: "relative",
    paddingHorizontal: 8,
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.4,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    width: "100%",
    height: "88%",
  },
  scatterDot: {
    position: "absolute",
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  noDataPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  noDataCardDetail: {
    flexDirection: "column",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
  },
  noDataTitle: {
    color: "#E5E7EB",
    fontSize: 11.5,
    fontWeight: "600",
  },
  noDataTitleDetail: {
    fontSize: 15,
    fontWeight: "700",
  },
  noDataSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 16,
  },
});
