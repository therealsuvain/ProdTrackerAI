import type { LightningRange } from "./lightning-types-v4";



export type LightningQualitySelectionConfig = {
  /** Set false to generate exactly one candidate and skip all scoring. */
  enabled: boolean;
  /** Additional candidates to try after the first candidate. */
  maxRetries: number;
  /** Return as soon as a candidate reaches this score (0–1). */
  minimumScore: number;
};

export type LightningGeneratorConfig = {
  // Strike footprint
  fullCoverageChance: number;
  fullWidthRange: LightningRange;
  partialWidthRange: LightningRange;
  fullHeightRange: LightningRange;
  partialHeightRange: LightningRange;
  originXRange: LightningRange;
  impactXOffsetRange: LightningRange;
  edgeMarginRatio: number;

  // Multi-scale midpoint displacement
  mainFractalGenerations: number;
  primaryBranchFractalGenerations: number;
  secondaryBranchFractalGenerations: number;
  tertiaryBranchFractalGenerations: number;
  mainDisplacementRatio: number;
  branchDisplacementRatio: number;
  displacementDecay: number;
  /** Minimum fraction of each segment's downward progress retained by its midpoint. */
  minimumForwardProgressRatio: number;
  /** Limit the fraction of width/height available to the midpoint displacement. */
  maximumDisplacementRatio: number;

  // Main channel width
  mainWidth: number;
  /** Final trunk width as a proportion of its initial width; applied linearly. */
  mainWidthTaper: number;

  // Primary branches
  primaryBranchCount: LightningRange;
  primaryBranchAttachmentRange: LightningRange;
  primaryBranchLengthRange: LightningRange;
  primaryBranchAngleRange: LightningRange;

  // Recursive branching
  secondaryBranchProbability: number;
  tertiaryBranchProbability: number;
  maxBranchDepth: number;
  maxChildBranchesPerBranch: number;
  branchLengthDecay: number;
  branchForkAngleRange: LightningRange;
  /** Probability a child continues away from the main trunk's centre line. */
  outwardForkProbability: number;
  branchWidthMultiplier: number;
  branchWidthTaper: number;
  /** Raw reveal-time units assigned to each generated branch segment. */
  branchGrowthRate: number;
  minimumBranchWidth: number;

  // Safety/performance
  maxSegments: number;

  // Optional candidate selection
  qualitySelection: LightningQualitySelectionConfig;


};

export const LIGHTNING_STRIKER_V4_TUNING: { generator: LightningGeneratorConfig } = {
  generator: {
    // Footprint defaults follow the more expansive profile supplied for V2.
    fullCoverageChance: 0.55,
    fullWidthRange: [0.75, 1.0],//[0.68, 1.0],
    partialWidthRange: [0.48, 0.75],//[0.38, 0.72],
    fullHeightRange: [0.85, 1.02],
    partialHeightRange: [0.72, 0.85],//[0.62, 0.85],
    originXRange: [0.25, 0.75],
    impactXOffsetRange: [-0.18, 0.18],
    edgeMarginRatio: 0.04,

    // Six generations produce 64 main-channel micro-segments.
    // Branches use 16 segments at depth 1 and 8 at depths 2 and 3.
    mainFractalGenerations: 6,
    primaryBranchFractalGenerations: 4,
    secondaryBranchFractalGenerations: 3,
    tertiaryBranchFractalGenerations: 3,
    mainDisplacementRatio: 0.22,
    branchDisplacementRatio: 0.24,
    displacementDecay: 0.54,
    minimumForwardProgressRatio: 0.16,
    maximumDisplacementRatio: 0.42,

    mainWidth: 1.25,//2.2,
    mainWidthTaper: 0.992,

    primaryBranchCount: [8, 12/* 7 */],
    primaryBranchAttachmentRange: [0.08, 0.99/* 0.88 */],
    primaryBranchLengthRange: [0.18, 0.36],
    primaryBranchAngleRange: [24, 52],

    secondaryBranchProbability: 0.32,
    tertiaryBranchProbability: 0.22,
    maxBranchDepth: 4,//3,
    maxChildBranchesPerBranch: 5,//1,
    branchLengthDecay: 0.58,
    branchForkAngleRange: [16, 36],
    outwardForkProbability: 0.80,
    branchWidthMultiplier: 0.62,
    branchWidthTaper: 0.92,
    branchGrowthRate: 0.35,
    minimumBranchWidth: 0.28,

    maxSegments: 375,//320,

    // Keep enabled to preserve V3's quality-selection behaviour by default.
    // Set enabled:false for a true single-candidate, no-scoring benchmark.
    qualitySelection: {
      enabled: true,//false,
      maxRetries: 2,
      minimumScore: 0.80,
    },




  },
};
