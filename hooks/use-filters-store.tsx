import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { chartMMKV } from "@/components/ui/analytics/charts-prefs";
import {
  PersistedFilters,
  DateRangeFilter,
  AdvancedFilter,
} from "@/types/analytics";

const FILTERS_STORAGE_KEY = "analytics_filters_v2";

const DEFAULT_FILTERS: PersistedFilters = {
  global: { dateRange: { preset: "last30" } },
  chartOverrides: {},
};

function loadFilters(): PersistedFilters {
  const raw = chartMMKV.getString(FILTERS_STORAGE_KEY);
  if (!raw) return DEFAULT_FILTERS;
  try {
    return JSON.parse(raw) as PersistedFilters;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function persist(next: PersistedFilters) {
  chartMMKV.set(FILTERS_STORAGE_KEY, JSON.stringify(next));
}

interface FiltersStore extends PersistedFilters {
  setGlobalDateRange: (range: DateRangeFilter) => void;
  setChartDateRangeOverride: (chartId: string, range: DateRangeFilter) => void;
  setChartAdvancedFilter: (chartId: string, advanced: AdvancedFilter) => void;
}

export const useFiltersStore = create<FiltersStore>((set, get) => ({
  ...loadFilters(),

  setGlobalDateRange: (range) => {
    const clearedOverrides = Object.fromEntries(
      Object.entries(get().chartOverrides).map(([id, o]) => [
        id,
        { ...o, dateRange: undefined },
      ]),
    );
    const next: PersistedFilters = {
      global: { dateRange: range },
      chartOverrides: clearedOverrides,
    };
    persist(next);
    set(next);
  },

  setChartDateRangeOverride: (chartId, range) => {
    const chartOverrides = {
      ...get().chartOverrides,
      [chartId]: { ...get().chartOverrides[chartId], dateRange: range },
    };
    persist({ global: get().global, chartOverrides });
    set({ chartOverrides });
  },

  setChartAdvancedFilter: (chartId, advanced) => {
    const chartOverrides = {
      ...get().chartOverrides,
      [chartId]: { ...get().chartOverrides[chartId], advanced },
    };
    persist({ global: get().global, chartOverrides });
    set({ chartOverrides });
  },
}));

// Selector hook — only re-renders the calling component when THIS chart's
// resolved filter output changes, not on every store-wide update.
export function useResolvedChartFilters(chartId: string) {
  return useFiltersStore(
    useShallow((state) => {
      const override = state.chartOverrides[chartId];
      return {
        dateRange: override?.dateRange ?? state.global.dateRange,
        advanced: override?.advanced,
      };
    }),
  );
}
