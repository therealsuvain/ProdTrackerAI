/** Unified geometry and diagnostics types for Lightning Striker. */

export type LightningRange = readonly [min: number, max: number];
export type LightningCoverage = "full" | "partial";
export type LightningDepth = 0 | 1 | 2 | 3;

export type LightningPoint = {
  x: number;
  y: number;
};

export type LightningSegment = {
  id: string;
  parentId: string | null;
  branchId: string;
  /** 0 = main leader, 1 = primary, 2 = secondary, 3 = tertiary. */
  depth: LightningDepth;
  start: LightningPoint;
  end: LightningPoint;
  length: number;
  width: number;
  /** Normalized start position in the leader-growth timeline. */
  revealStart: number;
  /** Normalized reveal duration in the leader-growth timeline. */
  revealDuration: number;
};

export type LightningStrike = {
  seed: number;
  width: number;
  height: number;
  coverage: LightningCoverage;
  origin: LightningPoint;
  impact: LightningPoint;
  segments: LightningSegment[];
  /** Ordered points of the main leader, used for the upward return stroke. */
  mainPath: LightningPoint[];
  primaryBranchCount: number;
  branchCount: number;
  maxDepth: number;
  /** -1 means quality scoring was intentionally skipped. */
  qualityScore: number;
  /** False when qualitySelection.enabled is false. */
  qualityScored: boolean;
  /** Number of generated candidates, including the initial candidate. */
  qualityAttempts: number;
};
