export { LIGHTNING_STRIKER_TUNING } from "./lightning-config";
export type {
  LightningAppearanceConfig,
  LightningGeneratorConfig,
  LightningStrikerConfig,
  LightningTimingConfig,
} from "./old-versions/lightning-config";
export { generateLightningStrike } from "./lightning-generator";
export type {
  LightningCoverage,
  LightningPoint,
  LightningSegment,
  LightningStrike,
} from "./lightning-types";
export { useLightningStrikerAnimation } from "./old-versions/use-lightning-striker-animation";
export type {
  LightningStrikerAudioOptions,
  LightningStrikerCanvasRef,
  LightningStrikerController,
  LightningStrikerStartOptions,
} from "./old-versions/use-lightning-striker-animation";
export { useLightningStrikerAudio } from "./use-lightning-striker-audio-v2";
