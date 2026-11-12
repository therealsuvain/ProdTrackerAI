# V4 integration — targeted changes only

## Chunk 1 — Add three files

Add the three files from `hooks/animations/easter-eggs/lighting-striker/` to the matching folder in your project.

## Chunk 2 — Change two imports in `use-lightning-striker-animation.tsx`

Replace the V3 generator import with:

```ts
import { generateLightningStrike } from "./lightning-generator-v4";
```

Replace the strike type import with:

```ts
import type { LightningStrike } from "./lightning-types-v4";
```

Do not change the `LightningCanvas` import. Keep the V3 canvas for the A/B comparison.

## Chunk 3 — Keep the canvas width source aligned

The V3 canvas continues to read its return-stroke base width from its own V3 config. If you change V4 `generator.mainWidth`, keep the V3 config's `generator.mainWidth` at the same value for a fair visual comparison.

## Chunk 4 — Toggle quality selection

Edit only this setting in `lightning-config-v4.ts`:

```ts
qualitySelection: {
  enabled: true, // false for one-candidate/no-scoring mode
  maxRetries: 2,
  minimumScore: 0.80,
},
```

No animation-controller changes are required for the toggle.

## Chunk 5 — Optional diagnostics

Immediately after `generateLightningStrike(...)` in the controller, temporarily log:

```ts
console.log("Lightning V4", {
  seed: generated.seed,
  segmentCount: generated.segments.length,
  branchCount: generated.branchCount,
  qualityScore: generated.qualityScore,
  qualityScored: generated.qualityScored,
  qualityAttempts: generated.qualityAttempts,
});
```

Remove the log after comparing a representative set of strikes.
