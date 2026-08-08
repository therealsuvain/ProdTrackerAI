export type DateRangePreset = 'last7' | 'last30' | 'last90' | 'allTime' | 'custom';

export interface DateRangeFilter {
  preset: DateRangePreset;
  customStart?: string; // ISO date, only when preset === 'custom'
  customEnd?: string;
}

export interface AdvancedFilter {
  tagIds?: string[];
  categoryIds?: string[];
  priorities?: Array<'low' | 'medium' | 'high'>;
}

export interface GlobalFilterState {
  dateRange: DateRangeFilter;
}

export interface ChartFilterOverride {
  dateRange?: DateRangeFilter;      // undefined = inherit global
  advanced?: AdvancedFilter;         // chart-specific only, no global equivalent
}

export interface PersistedFilters {
  global: { dateRange: DateRangeFilter };
  chartOverrides: Record<string, ChartFilterOverride>;
}
