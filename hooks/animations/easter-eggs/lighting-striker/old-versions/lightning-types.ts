export type LightningPoint = {
  x: number;
  y: number;
};

export type LightningCoverage = "full" | "partial";

/**
 * One straight channel section. Segments form a tree through parentId.
 * revealStart/revealDuration are normalized to the complete leader phase.
 */
export type LightningSegment = {
  id: string;
  parentId: string | null;
  branchId: string;
  depth: number;
  start: LightningPoint;
  end: LightningPoint;
  length: number;
  width: number;
  revealStart: number;
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
  mainPath: LightningPoint[];
  primaryBranchCount: number;
  branchCount: number;
  maxDepth: number;
};

export type LightningRange = readonly [number, number];
