
import { CHART_FILTERS } from '@/components/ui/analytics/charts-registry';
import { CalendarEvent } from '@/types/calendar';
import { Habit } from '@/types/habits';
import { AppMetrics } from '@/types/metrics';
import { TimerLog } from '@/types/timer';
import { Task } from '@/types/task';
import { DateRangeFilter } from '@/types/analytics';
import { useResolvedChartFilters } from './use-filters-store';

function resolvePresetToDates(dateRange: DateRangeFilter, firstDateEver: string): { start: string; end: string } {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date();

  switch (dateRange.preset) {
    case 'last7': start.setDate(start.getDate() - 7); break;
    case 'last30': start.setDate(start.getDate() - 30); break;
    case 'last90': start.setDate(start.getDate() - 90); break;
    case 'allTime': return { start: firstDateEver, end };
    case 'custom': return { start: dateRange.customStart ?? firstDateEver, end: dateRange.customEnd ?? end };
  }
  return { start: start.toISOString().split('T')[0], end };
}

interface FilteredData {
  metrics: AppMetrics;
  tasks: Task[];
  habits: Habit[];
  events: CalendarEvent[];
  timerLogs: TimerLog[];
   startDate: string,
  endDate: string
}

export function useFilteredMetrics(
  chartId: string,
  fullMetrics: AppMetrics,
  tasks: Task[],
  habits: Habit[],
  events: CalendarEvent[],
  timerLogs: TimerLog[],
): FilteredData {
  const { dateRange, advanced } = useResolvedChartFilters(chartId);
  const dataSource = CHART_FILTERS[chartId];
  const firstDateEver = Object.keys(fullMetrics.daily)[0];
  const { start, end } = resolvePresetToDates(dateRange, firstDateEver);

  const filteredDaily = Object.fromEntries(
    Object.entries(fullMetrics.daily).filter(([date]) => date >= start && date <= end),
  );
  const filteredMetrics = { ...fullMetrics, daily: filteredDaily };

  if (dataSource === 'daily') {
    return { metrics: filteredMetrics, tasks, habits, events, timerLogs, startDate: start, endDate: end };
  }

  // dataSource === 'raw' — filter every raw array by date + advanced fields.
  // Individual chart transformers only consume the arrays they need; passing
  // all four filtered is harmless since unused ones are simply ignored.
  const matchesAdvanced = (tagIds?: string[], categoryId?: string) => {
    const matchesTag = !advanced?.tagIds?.length || tagIds?.some(id => advanced.tagIds!.includes(id));
    const matchesCategory = !advanced?.categoryIds?.length || advanced.categoryIds!.includes(categoryId ?? '');
    return matchesTag && matchesCategory;
  };

  const filteredTasks = tasks.filter(t => {
    const inRange = t.createdAt >= start && t.createdAt <= end;
    const matchesPriority = !advanced?.priorities?.length || advanced.priorities!.includes(t.priority);
    return inRange && matchesAdvanced(t.tags, t.category) && matchesPriority;
  });

  const filteredHabits = habits.filter(h => {
    const inRange = h.createdAt >= start && h.createdAt <= end;
    return inRange && matchesAdvanced(h.tags, h.category);
  });

  const filteredEvents = events.filter(e => {
    const inRange = e.startDate >= start && e.startDate <= end;
    return inRange && matchesAdvanced(e.tags, e.category);
  });

  const filteredTimerLogs = timerLogs.filter(log => {
    const inRange = log.startTime.split('T')[0] >= start && log.startTime.split('T')[0] <= end;
    return inRange && matchesAdvanced(log.tags, log.category);
  });

  return {
    metrics: filteredMetrics,
    tasks: filteredTasks,
    habits: filteredHabits,
    events: filteredEvents,
    timerLogs: filteredTimerLogs,
    startDate: start,
    endDate: end,
  };
}