### 1. Add this import near the existing special-event config type imports in `lightning-config-v3.ts`:

```ts
import type { LightningRainConfig } from "./use-lightning-rain";
```

### 2. Extend `LightningStrikerConfig.specialEvents` with:

```ts
specialEvents: {
  powerCut: LightningPowerCutConfig;
  rain: LightningRainConfig;
};
```

Keep your existing interface structure; this shows only the relevant nested property.

### 3. Add this `rain` property beside `powerCut` inside `LIGHTNING_STRIKER_TUNING.specialEvents`:

```ts
rain: {
  enabled: true,
  chance: 0.05, // Per-lightning-activation chance when specialEvent is "random".

  // Full-density rain, followed by a gradual reduction in active droplet emitters.
  heavyDurationRangeMs: [10000, 15000],
  fadeDurationRangeMs: [4000, 6000],
  // The last already-falling drops are allowed to leave the screen.
  drainDurationMs: 1400,

  // One fixed particle pool is generated at event start; no random work per frame.
  maxParticles: 220,
  speedRangeDpPerSecond: [850, 1450],
  windAngleRangeDegrees: [-8, 8],
  farDropLengthRange: [7, 13],
  midDropLengthRange: [11, 19],
  nearDropLengthRange: [16, 27],

  // Three depth groups are rendered as three Skia paths, with no blur passes.
  farStrokeWidth: 0.65,
  midStrokeWidth: 0.9,
  nearStrokeWidth: 1.2,
  farOpacity: 0.32,
  midOpacity: 0.48,
  nearOpacity: 0.62,

  // A restrained blue-grey storm veil; the search UI remains visible underneath.
  atmosphereColor: "#071525",
  atmosphereOpacity: 0.075,
  atmosphereFadeInMs: 650,
  atmosphereFadeOutMs: 1100,

  // The supplied 48-second audio starts cleanly at time zero and is faded with the rain.
  audioVolume: 0.58,
  audioFadeSteps: 12,
},
```
