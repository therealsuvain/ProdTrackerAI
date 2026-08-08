import { useFilteredMetrics } from "@/hooks/use-filtered-analytics-metrics";
import { CHART_REGISTRY, ChartProps } from "../charts-registry";

// FilteredChart.tsx — the missing piece
interface FilteredChartProps {
  chartId: string;
  chartProps: ChartProps; // your existing unfiltered metrics/tasks/habits/events/logs/tags/categories
  variant?: "grid" | "detail";
  transformState?: any;
}

export const FilteredChart = ({
  chartId,
  chartProps,
  variant,
  transformState,
}: FilteredChartProps) => {
  const ChartComponent = CHART_REGISTRY[chartId];
  const { metrics, tasks, habits, events, timerLogs, startDate, endDate } =
    useFilteredMetrics(
      chartId,
      chartProps.metrics,
      chartProps.tasks,
      chartProps.habits,
      chartProps.events,
      chartProps.logs,
    );
  if (!ChartComponent) return null;

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
};
