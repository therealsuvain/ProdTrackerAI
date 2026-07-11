export interface DetailScale {
  heightScale: number;
  widthScale: number;
}

const DEFAULT_DETAIL_SCALE: DetailScale = { heightScale: 2, widthScale: 1 };

// How much bigger each chart renders in the standalone detail modal vs its
// grid tile. Most charts just need more vertical room — their width already
// reads fine at the grid's '90%'. A couple (mainly circular ones) want both
// axes scaled together so they don't stretch into an oval.
export const CHART_DETAIL_SCALE: Record<string, DetailScale> = {
  execution_funnel: { heightScale: 2, widthScale: 1 },
  momentum_delta: { heightScale: 2, widthScale: 1 },
  focus_trend: { heightScale: 2, widthScale: 1 },
  task_velocity: { heightScale: 2, widthScale: 1 },
  habit_consistency: { heightScale: 2, widthScale: 1 },
  task_throughput: { heightScale: 2, widthScale: 1 },
  ai_leverage: { heightScale: 2, widthScale: 1 },
  circadian_friction: { heightScale: 1.8, widthScale: 1.3 },
  deep_work: { heightScale: 1.6, widthScale: 1.6 },
};

export function getDetailScale(id: string): DetailScale {
  return CHART_DETAIL_SCALE[id] ?? DEFAULT_DETAIL_SCALE;
}

// Every chart's base (grid) container height, kept here so the modal can
// compute a wrapper size without re-deriving it. Must match each chart's own
// `chartContainer.height`.
export const BASE_CHART_HEIGHT = 400;
export const MODAL_BASE_WIDTH = 640;