/* import { FiltersState, DateRangeFilter, AdvancedFilter } from '@/types/analytics';
import { useState } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { chartMMKV } from '@/components/ui/analytics/charts-prefs';

const FILTERS_STORAGE_KEY = 'analytics_filters_v1';


const default_filters: FiltersState = {
  global: { dateRange: { preset: 'allTime' } },
  chartOverrides: {},
};
export default function useAnalyticsFilters() {
  const [filters, setFilters] = useState<FiltersState>(() =>
  {
    const saved = chartMMKV.getString(FILTERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : default_filters;
  }
  );

  const setGlobalDateRange = (range: DateRangeFilter) => {
    setFilters(prev => {
      // Wipe every chart's local dateRange override — advanced filters (tags/category/priority) are untouched.
      const clearedOverrides = Object.fromEntries(
        Object.entries(prev.chartOverrides).map(([chartId, override]) => [
          chartId,
          { ...override, dateRange: undefined },
        ])
      );

      const next: FiltersState = {
        global: { ...prev.global, dateRange: range },
        chartOverrides: clearedOverrides,
      };
      chartMMKV.set(FILTERS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setChartDateRangeOverride = (chartId: string, range: DateRangeFilter) => {
    setFilters(prev => {
      const next = {
        ...prev,
        chartOverrides: {
          ...prev.chartOverrides,
          [chartId]: { ...prev.chartOverrides[chartId], dateRange: range },
        },
      };
       chartMMKV.set(FILTERS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const setChartAdvancedFilter = (chartId: string, advanced: AdvancedFilter) => {
    // Advanced filters are never touched by global changes — no wipe logic here.
    setFilters(prev => {
      const next = {
        ...prev,
        chartOverrides: {
          ...prev.chartOverrides,
          [chartId]: { ...prev.chartOverrides[chartId], advanced },
        },
      };
      chartMMKV.set(FILTERS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resolveChartFilters = (chartId: string) => {
    const override = filters.chartOverrides[chartId];
    return {
      dateRange: override?.dateRange ?? filters.global.dateRange, // undefined after a global change → falls back to new global
      advanced: override?.advanced,
    };
  };

  return {
    filters,
    setGlobalDateRange,
    setChartDateRangeOverride,
    setChartAdvancedFilter,
    resolveChartFilters,
  };
} */