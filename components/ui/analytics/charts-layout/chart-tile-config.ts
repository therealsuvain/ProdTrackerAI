/**
 * Bento grid sizing for the analytics dashboard.
 *
 * Each chart is tagged with a `TileSize`. Full-width sizes ("wide" / "hero")
 * take an entire row; half-width sizes ("small" / "standard" / "tall") pair
 * up two-per-row. This keeps the packing logic dead simple (no true masonry,
 * no overlap solving) while still producing a varied, tiled look instead of
 * one chart per row.
 *
 * `computeGridLayout` is a pure function of (order, containerWidth), so it
 * can be safely recomputed on every drag/reorder frame with no side effects.
 */

export type TileSize = 'hero' | 'wide' | 'small' | 'standard' | 'tall';

interface TileConfigEntry {
  size: TileSize;
}

// Trend charts read best with the full width of the screen for their time
// axis; everything else is happy paired up two-per-row.
export const CHART_TILE_CONFIG: Record<string, TileConfigEntry> = {
  execution_funnel: { size: 'wide' },
  momentum_delta: { size: 'wide' },
  time_durations: { size: 'wide' },
  deep_work: { size: 'small' },
  circadian_friction: { size: 'standard' },
  ai_leverage: { size: 'standard' },
  task_velocity: { size: 'standard' },
  habit_consistency: { size: 'standard' },
  task_throughput: { size: 'standard' },
  task_procrastination: { size: 'standard' },
  priority_completion: { size: 'standard' },
  freeze_reliance: { size: 'standard' },
  chat_follow_through: { size: 'standard' },
  session_distribution: { size: 'standard' },
};

const DEFAULT_TILE_CONFIG: TileConfigEntry = { size: 'standard' };

export const TILE_DIMENSIONS: Record<TileSize, { widthPct: 48 | 100; height: number }> = {
  hero: { widthPct: 100, height: 300 },
  wide: { widthPct: 100, height: 236 },
  tall: { widthPct: 48, height: 300 },
  standard: { widthPct: 48, height: 236 },
  small: { widthPct: 48, height: 176 },
};

export const GRID_GAP = 9;

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getTileConfig(id: string): TileConfigEntry {
  return CHART_TILE_CONFIG[id] ?? DEFAULT_TILE_CONFIG;
}

/**
 * Greedy row-packing layout.
 * - A "wide"/"hero" tile always starts a fresh row and takes it fully.
 * - "small"/"standard"/"tall" tiles pair up left/right; the pair shares
 *   the taller of the two heights so the row stays a clean rectangle.
 * - An odd trailing half-tile is allowed to occupy a row by itself.
 */
export function computeGridLayout(
  order: string[],
  containerWidth: number
): { rects: Record<string, TileRect>; totalHeight: number } {
  const rects: Record<string, TileRect> = {};
  const halfWidth = (containerWidth - GRID_GAP) / 2;

  let y = 0;
  let pendingHalfId: string | null = null;

  const closeHalfRow = () => {
    if (pendingHalfId) {
      const dim = TILE_DIMENSIONS[getTileConfig(pendingHalfId).size];
      rects[pendingHalfId] = { x: 0, y, width: halfWidth, height: dim.height };
      y += dim.height + GRID_GAP;
      pendingHalfId = null;
    }
  };

  for (const id of order) {
    const cfg = getTileConfig(id);
    const dim = TILE_DIMENSIONS[cfg.size];

    if (dim.widthPct === 100) {
      closeHalfRow();
      rects[id] = { x: 0, y, width: containerWidth, height: dim.height };
      y += dim.height + GRID_GAP;
      continue;
    }

    if (!pendingHalfId) {
      pendingHalfId = id;
      continue;
    }

    const rowHeight = Math.max(
      TILE_DIMENSIONS[getTileConfig(pendingHalfId).size].height,
      dim.height
    );
    rects[pendingHalfId] = { x: 0, y, width: halfWidth, height: rowHeight };
    rects[id] = { x: halfWidth + GRID_GAP, y, width: halfWidth, height: rowHeight };
    y += rowHeight + GRID_GAP;
    pendingHalfId = null;
  }

  closeHalfRow();

  return { rects, totalHeight: Math.max(0, y - GRID_GAP) };
}