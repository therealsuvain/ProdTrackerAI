import type { LightningRange } from "./lightning-types";

/**
 * All geometry, timing and appearance values live here so the effect can be
 * tuned without changing the generator or the renderer.
 */
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

  // Main channel geometry
  mainSegmentCount: LightningRange;
  mainJitterRatio: number;
  mainDriftRatio: number;
  mainWidth: number;
  mainWidthTaper: number;
  mainHorizontalSmoothing: number;

  // Primary branches
  primaryBranchCount: LightningRange;
  primaryBranchAttachmentRange: LightningRange;
  primaryBranchLengthRange: LightningRange;
  primaryBranchAngleRange: LightningRange;
  primaryBranchStepCount: LightningRange;

  // Branch recursion
  secondaryBranchProbability: number;
  tertiaryBranchProbability: number;
  maxBranchDepth: number;
  branchLengthDecay: number;
  branchAngleVariation: number;
  branchWidthMultiplier: number;
  branchWidthTaper: number;
  branchGrowthRate: number;
  minimumBranchWidth: number;

  // Safety/performance
  maxSegments: number;
};

export type LightningAppearanceConfig = {
  /** Dark blue overlay over the existing search interface. */
  atmosphereOpacity: number;
  atmosphereColor: string;

  /** Three-pass electric glow. */
  outerGlowColor: string;
  outerGlowOpacity: number;
  outerGlowWidthMultiplier: number;
  outerGlowBlur: number;
  electricGlowColor: string;
  electricGlowOpacity: number;
  electricGlowWidthMultiplier: number;
  electricGlowBlur: number;
  coreColor: string;
  coreOpacity: number;
  coreWidthMultiplier: number;

  /** Brief whole-screen illumination at the return stroke. */
  screenFlashColor: string;
  screenFlashPeakOpacity: number;
};

export type LightningTimingConfig = {
  leaderDurationMs: number;
  returnStrokeDurationMs: number;
  strikeSoundDelayMs: number;
  thunderSoundDelayMs: number;
  secondaryFlashDelayMs: number;
  secondaryFlashDurationMs: number;
  afterglowDurationMs: number;
  fadeOutDurationMs: number;
  reducedMotionDurationMs: number;
};

export type LightningStrikerConfig = {
  generator: LightningGeneratorConfig;
  appearance: LightningAppearanceConfig;
  timing: LightningTimingConfig;
};

export const LIGHTNING_STRIKER_TUNING: LightningStrikerConfig = {
  /* generator: {
    // At the default 0.45, around 45% of strikes use the larger footprint.
    fullCoverageChance: 0.48,
    fullWidthRange: [0.68, 1.0],
    partialWidthRange: [0.30, 0.66],
    fullHeightRange: [0.82, 1.02],
    partialHeightRange: [0.57, 0.82],//[0.43, 0.76],
    originXRange: [0.25, 0.75],//[0.06, 0.94],
    impactXOffsetRange: [-0.12, 0.12],
    edgeMarginRatio: 0.035,

    mainSegmentCount: [15, 30],
    mainJitterRatio: 0.058,
    mainDriftRatio: 0.027,
    mainWidth: 1.75,//1.5,//2.7,
    mainWidthTaper: 0.75,//0.15,//0.5,//0.985,
    mainHorizontalSmoothing: 0.01,//0.14,

    primaryBranchCount: [4, 7],
    primaryBranchAttachmentRange: [0.10, 0.94],
    primaryBranchLengthRange: [0.20, 0.41],
    primaryBranchAngleRange: [34, 77],
    primaryBranchStepCount: [3, 6],

    secondaryBranchProbability: 0.48,
    tertiaryBranchProbability: 0.18,
    maxBranchDepth: 3,
    branchLengthDecay: 0.68,
    branchAngleVariation: 17,
    branchWidthMultiplier: 0.1,//0.25,//0.72,
    branchWidthTaper: 0.675,//0.2,//0.86,
    branchGrowthRate: 0.8,//0.58,
    minimumBranchWidth: 0.05,//0.15,//0.42,

    maxSegments: 190,
  }, */

  generator: {
    fullCoverageChance: 0.55,
    fullWidthRange: [0.68, 1.0],
    partialWidthRange: [0.38, 0.72],
    fullHeightRange: [0.85, 1.02],
    partialHeightRange: [0.62, 0.85],
    originXRange: [0.25, 0.75],
    impactXOffsetRange: [-0.18, 0.18],
    edgeMarginRatio: 0.04,

    // Main channel: 48–64 micro-segments via midpoint subdivision
    mainSegmentCount: [48, 64],
    mainJitterRatio: 0.075,
    mainDriftRatio: 0.032,
    mainWidth: 1.5,//2.2,
    mainWidthTaper: 0.992, // Keep trunk thick all the way down!
    mainHorizontalSmoothing: 0.35,

    // Primary branches: more steps = short jagged teeth instead of long needles
    primaryBranchCount: [4, 7],
    primaryBranchAttachmentRange: [0.08, 0.88],
    primaryBranchLengthRange: [0.18, 0.36],
    primaryBranchAngleRange: [24, 52],
    primaryBranchStepCount: [10, 18],

    // Recursion & tapering
    secondaryBranchProbability: 0.32,
    tertiaryBranchProbability: 0.22,
    maxBranchDepth: 3,
    branchLengthDecay: 0.58,
    branchAngleVariation: 22,
    branchWidthMultiplier: 0.62, // 62% of parent width at each fork
    branchWidthTaper: 0.92,      // Gradual taper along the branch
    branchGrowthRate: 0.35,
    minimumBranchWidth: 0.28,

    maxSegments: 320,
  },

  appearance: {
    atmosphereOpacity: 0.22,//0.12
    atmosphereColor: "#000000",

    outerGlowColor: "#276BFF",
    outerGlowOpacity: 0.36,
    outerGlowWidthMultiplier: 8.5,
    outerGlowBlur: 17,
    electricGlowColor: "#54B9FF",
    electricGlowOpacity: 0.88,
    electricGlowWidthMultiplier: 3.0,
    electricGlowBlur: 4.2,
    coreColor: "#F3FBFF",
    coreOpacity: 0.98,
    coreWidthMultiplier: 0.78,

    screenFlashColor: "#DCEEFF",
    screenFlashPeakOpacity: 0.66,
  },

  timing: {
    leaderDurationMs: 750,//430,
    returnStrokeDurationMs: 105,//3000,//105,
    strikeSoundDelayMs: -1200,//65,
    thunderSoundDelayMs: 470,
    secondaryFlashDelayMs: 300,//135,
    secondaryFlashDurationMs: 475,//245,
    afterglowDurationMs: 480,//260,
    fadeOutDurationMs: 650,//310,
    reducedMotionDurationMs: 540,
  },
};
