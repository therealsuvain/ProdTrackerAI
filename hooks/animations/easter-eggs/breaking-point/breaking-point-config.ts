/**
 * Breaking Point — iteration 1 tuning.
 *
 * Distances and stroke widths are React Native layout units (dp).
 * Opacity values are normalized from 0 to 1.
 * Keep the generation budget bounded: geometry is generated on accepted taps,
 * never in the render loop.
 */
export const BREAKING_POINT_TUNING = {
  sequence: {
    /** Iteration 1 intentionally stops after three cumulative impact stages. */
    maxImpactStages: 3,
    /** Set to a number to reproduce a fracture sequence while tuning. */
    fixedSeed: null as number | null,
  },

  impact: {
    /** Impact-centre radius relative to the shorter screen dimension. */
    radiusRatio: 0.038,
    minimumRadius: 18,
    maximumRadius: 38,
    centreVertexCount: 11,
    centreIrregularity: 0.48,
  },

  generation: {
    primaryRaysStage1: 15,//8,
    primaryRaysStage2: 25,//9,
    primaryRaysStage3: 50,//14,
    /** Stage 3 reserves evenly distributed rays to guarantee all screen edges are reached. */
    primaryEdgeReachRatio: 0.9,


    stage3EdgeRayCount: 4,
    stage3EdgeRayJitter: 0.025,
    primaryAngleJitter: 0.32,
    primaryLengthMin: 0.48,
    primaryLengthMax: 0.88,
    fullScreenLengthMin: 0.91,
    fullScreenLengthMax: 1.0,
    pathKink: 0.22,
    pathStepsMin: 3,
    pathStepsMax: 6,
    branchChance: 0.62,
    branchLengthMin: 0.12,
    branchLengthMax: 0.44,
    branchAngleMin: 0.42,
    branchAngleMax: 1.42,
    maxBranchesPerImpact: 42,
    hairlineChance: 0.64,
    ringCountMin: 2,
    ringCountMax: 5,
    ringSweepMin: 0.75,
    ringSweepMax: 3.35,
    connectorDistanceRatio: 0.72,
    connectorChance: 0.78,
    maxStrokesTotal: 210,
  },

  appearance: {
    /** Base stroke widths in dp. Each class receives additional layered passes. */
    primaryWidth: 0.000000000001,//0.115,//1.0,
    secondaryWidth: 0.0005,//0.076,//0.62,
    hairlineWidth: 0.00025,//0.04,//0.36,
    ringWidth: 0.005,//0.06,//0.62,

    /** Cool glass edge beneath the bright fracture highlight. */
    edgeColor: "#82909da1",//"#82909D",
    edgeOpacity: 0.29,
    seamColor: "rgba(99, 99, 99, 0.64)",//"#C5D0DA",
    seamOpacity: 0.34,
    highlightColor: "#f4f7faa8",// "#F4F7FA",
    primaryHighlightOpacity: 0.78,
    secondaryHighlightOpacity: 0.54,
    hairlineHighlightOpacity: 0.34,
    ringHighlightOpacity: 0.43,
    highlightOffset: 0.28,

    /** Small irregular glints are restricted to impact centres. */
    impactCoreColor: "#333333b7",
    impactCoreOpacity: 0.36,
    impactGlintOpacity: 0.68,
  },

  limits: {
    maxPointsPerStroke: 100,
    maxImpacts: 3,
  },
  audio: {
    smallCrackVolume: 0.82,
    shatterVolume: 0.95,
  },

} as const;

export type BreakingPointTuning = typeof BREAKING_POINT_TUNING;
