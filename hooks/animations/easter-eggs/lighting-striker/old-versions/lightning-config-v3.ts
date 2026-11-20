import type { LightningDepth, LightningRange } from "./lightning-types-v3";

import type { LightningPowerCutConfig } from "../use-lightning-power-cut";
import type { LightningRainConfig } from "../use-lightning-rain-v6";

/**
 * All geometry, rendering, timing and appearance values live here.
 * Generator widths describe geometry; stroke floors describe final Skia widths.
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

  // Recursive branch shape
  secondaryBranchProbability: number;
  tertiaryBranchProbability: number;
  maxBranchDepth: number;
  branchLengthDecay: number;
  branchAngleVariation: number;
  branchWidthMultiplier: number;
  branchWidthTaper: number;
  branchGrowthRate: number;
  minimumBranchWidth: number;

  // New shape controls
  /** Higher values preserve the current turn direction for longer. 0 = fresh jitter each step. */
  branchTurnPersistence: number;
  /** Chance of a short, sharper electrical kink at an individual branch step. */
  branchMicroKinkChance: number;
  branchMicroKinkAngleRange: LightningRange;
  /** Limits each branch to a small number of well-spaced child forks. */
  maxChildBranchesPerBranch: number;
  branchStepCountDecay: number;
  branchStepLengthRange: LightningRange;
  branchForkAngleRange: LightningRange;

  // Seed quality filtering. Generation is cheap; weak candidates can be retried.
  qualityRetryCount: number;
  minimumQualityScore: number;

  // Safety/performance
  maxSegments: number;
};

export type LightningDepthStrokeConfig = {
  /** Minimum rendered stroke widths, in dp. */
  outerGlowMinWidth: number;
  electricGlowMinWidth: number;
  coreMinWidth: number;
  /** Number of connected width sections used for this branch depth. */
  widthSections: number;
  /** Whether this depth receives the broad, expensive outer aura. */
  outerGlowEnabled: boolean;
};

export type LightningAppearanceConfig = {
  atmosphereOpacity: number;
  atmosphereColor: string;

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

  /** Per-depth floors prevent tiny twig widths being overridden by one global minimum. */
  strokeWidths: Record<LightningDepth, LightningDepthStrokeConfig>;

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
  specialEvents: {
    powerCut: LightningPowerCutConfig;
    rain: LightningRainConfig;
  };
};

export const LIGHTNING_STRIKER_TUNING: LightningStrikerConfig = {
  generator: {
    // User-calibrated strike footprint.
    fullCoverageChance: 0.48,
    fullWidthRange: [0.68, 1.0],
    partialWidthRange: [0.3, 0.66],
    fullHeightRange: [0.82, 1.02],
    partialHeightRange: [0.57, 0.82],
    originXRange: [0.25, 0.75],
    impactXOffsetRange: [-0.12, 0.12],
    edgeMarginRatio: 0.035,

    // Main channel: retain the user's narrow geometry and irregular drift.
    mainSegmentCount: [15, 30],
    mainJitterRatio: 0.058,
    mainDriftRatio: 0.027,
    mainWidth: 1.25,
    mainWidthTaper: 0.15,
    mainHorizontalSmoothing: 0.01,

    // Primary branches
    primaryBranchCount: [4, 7],
    primaryBranchAttachmentRange: [0.1, 0.94],
    primaryBranchLengthRange: [0.2, 0.41],
    primaryBranchAngleRange: [34, 77],
    primaryBranchStepCount: [5, 8],

    // Recursive branches
    secondaryBranchProbability: 0.48,
    tertiaryBranchProbability: 0.18,
    maxBranchDepth: 3,
    branchLengthDecay: 0.68,
    branchAngleVariation: 22,
    branchWidthMultiplier: 0.1,
    branchWidthTaper: 0.2,
    branchGrowthRate: 0.8,
    minimumBranchWidth: 0.05,

    // New branch-shape controls. These improve bend character without
    // increasing segment count substantially.
    branchTurnPersistence: 0.28,
    branchMicroKinkChance: 0.28,
    branchMicroKinkAngleRange: [8, 18],
    maxChildBranchesPerBranch: 1,
    branchStepCountDecay: 0.68,
    branchStepLengthRange: [0.72, 1.28],
    branchForkAngleRange: [28, 67],

    // Try up to three deterministic candidates and keep the best-scoring tree.
    qualityRetryCount: 2,
    minimumQualityScore: 0.88,

    maxSegments: 190,
  },

  appearance: {
    atmosphereOpacity: 0.22,
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

    // Per-depth minimums. Broad aura is reserved for the trunk and primary forks.
    strokeWidths: {
      0: {
        outerGlowMinWidth: 1.5,
        electricGlowMinWidth: 0.42,
        coreMinWidth: 0.18,
        widthSections: 3,
        outerGlowEnabled: true,
      },
      1: {
        outerGlowMinWidth: 1.1,
        electricGlowMinWidth: 0.32,
        coreMinWidth: 0.14,
        widthSections: 2,
        outerGlowEnabled: true,
      },
      2: {
        outerGlowMinWidth: 0,
        electricGlowMinWidth: 0.22,
        coreMinWidth: 0.1,
        widthSections: 1,
        outerGlowEnabled: false,
      },
      3: {
        outerGlowMinWidth: 0,
        electricGlowMinWidth: 0.16,
        coreMinWidth: 0.08,
        widthSections: 1,
        outerGlowEnabled: false,
      },
    },

    screenFlashColor: "#DCEEFF",
    screenFlashPeakOpacity: 0.66,
  },

  timing: {
    leaderDurationMs: 750,
    returnStrokeDurationMs: 105,
    // Negative delay values are clamped to zero by setTimeout; use an audio
    // source start offset when the recording contains leading silence.
    strikeSoundDelayMs: 0,
    thunderSoundDelayMs: 0, //470,
    secondaryFlashDelayMs: 300,
    secondaryFlashDurationMs: 475,
    afterglowDurationMs: 480,
    fadeOutDurationMs: 650,
    reducedMotionDurationMs: 540,
  },

  specialEvents: {
    powerCut: {
      enabled: true,
      chance: 0, //1,//0.05, // 5% per lightning activation. Set to 1 while testing.

      // The short-circuit recording has ~480 ms of leading silence.
      // Seeking past it makes the electrical sound audible immediately.
      shortCircuitStartDelayMs: 650, //250,
      shortCircuitStartOffsetMs: 480,
      shortCircuitClipDurationMs: 4899,

      // Start blackout.mp3 during the final ~1.35 seconds of the playable
      // short-circuit clip. Adjust this to change how much the sounds overlap.
      shortCircuitToBlackoutOverlapMs: 1350,

      // blackout.mp3 has ~100 ms of leading silence.
      blackoutStartOffsetMs: 100,
      blackoutClipDurationMs: 3228,

      // Begin fading to black so full darkness is reached ~200 ms before
      // the remaining blackout audio ends.
      darkBeforeBlackoutAudioEndsMs: 100, //200,
      darkTransitionMs: 1000, //120,

      // Time spent completely black, measured after the fade reaches black.
      blackHoldRangeMs: [5000, 10000],

      // Matches the supplied light-flicker.mp3 (approximately 4.885 seconds).
      recoveryDurationMs: 4852,
      flickerSteps: [
        { brightness: 0.08, durationRatio: 0.07 },
        { brightness: 0.0, durationRatio: 0.06 },
        { brightness: 0.18, durationRatio: 0.12 },
        { brightness: 0.03, durationRatio: 0.07 },
        { brightness: 0.42, durationRatio: 0.15 },
        { brightness: 0.12, durationRatio: 0.08 },
        { brightness: 0.7, durationRatio: 0.16 },
        { brightness: 0.46, durationRatio: 0.09 },
        { brightness: 1.0, durationRatio: 0.2 },
      ],

      shortCircuitVolume: 0.65,
      blackoutVolume: 1.25,
      lightFlickerVolume: 0.95,
    },
    rain: {
      enabled: true,
      chance: 1, //0.05, // Per-lightning-activation chance when specialEvent is "random".

      // Full-density rain, followed by a gradual reduction in active droplet emitters.
      heavyDurationRangeMs: [10000, 15000],
      fadeDurationRangeMs: [4000, 6000],
      // The last already-falling drops are allowed to leave the screen.
      drainDurationMs: 1400,

      // One fixed particle pool is generated at event start; no random work per frame.
      maxParticles: 3000, //220,//1600,//220,
      speedRangeDpPerSecond: [850, 1450],
      // Sideways movement of the rain field (separate from streak shape).
      windAngleRangeDegrees: [-3, 3],
      farDropLengthRange: [7, 13],
      midDropLengthRange: [11, 19],
      nearDropLengthRange: [16, 27],

      // Three depth groups are rendered as three Skia paths, with no blur passes.
      farStrokeWidth: 0.5, //0.65,
      midStrokeWidth: 0.75, //0.9,
      nearStrokeWidth: 0.9, //1.2,
      farOpacity: 0.32,
      midOpacity: 0.48,
      nearOpacity: 0.62,

      // A restrained blue-grey storm veil; the search UI remains visible underneath.
      atmosphereColor: "#071525",
      atmosphereOpacity: 0.15, //0.075,
      atmosphereFadeInMs: 650,
      atmosphereFadeOutMs: 1100,

      // The supplied 48-second audio starts cleanly at time zero and is faded with the rain.
      audioVolume: 0.58,
      audioFadeSteps: 12,

      fadeCohortsPerDepth: 6,
      cohortFadeDurationMs: 1100,

      dropAngleRangeDegrees: [-1.4, 1.4],

      // Brief silence after the strike and thunder recordings finish.
      startPaddingAfterLightningAudioMs: 120,

      windEnabled: true,
      windAudioVolume: 0.6667, //0.28,
      windAudioFadeOutMs: 1800, //1100,
      windAudioFadeSteps: 12,
      windGustMaxAngleDegrees: 60, //6.5,
      windGustDepthMultipliers: [0.42, 0.76, 1.08],

      // Briefly brighten the existing rain paths during the automatic strike.
      lightningReactiveRainEnabled: true,
      lightningReactiveRainOpacityBoost: 30, //2.4,
      lightningReactiveRainFadeMs: 650, //430,

      // One automatic follow-up lightning bolt after rain begins.
      autoStrikeEnabled: true,
      autoStrikeDelayMs: 3500,

      splashEnabled: true,
      splashRatePerSecond: 80, //1.15,
      splashMaxCount: 200, //18,
      splashSizeRangeDp: [7, 10],
      splashDurationRangeMs: [320, 470],
      splashOpacity: 0.82,
      splashStrokeWidth: 0.88, //1.1,
      splashBottomInsetDp: 2,
    },
  },
};
