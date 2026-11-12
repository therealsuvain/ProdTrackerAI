# Lightning Striker — Generator V4

V4 is a hybrid of the uploaded Generator V2 and Generator V3. It is designed to run with the existing V3 Skia canvas unchanged.

## Files to add

Copy these three files into the existing project folder:

`hooks/animations/easter-eggs/lighting-striker/`

- `lightning-generator-v4.ts`
- `lightning-config-v4.ts`
- `lightning-types-v4.ts`

The ZIP already contains them under that folder path.

## One import change in the animation controller

In `use-lightning-striker-animation.tsx`, change the generator import to:

```ts
import { generateLightningStrike } from "./lightning-generator-v4";
```

Change the `LightningStrike` type import to:

```ts
import type { LightningStrike } from "./lightning-types-v4";
```

No changes to the existing `lightning-canvas-v3.tsx` are intended. Its input shape remains structurally compatible with V4's strike result. Keep the V3 canvas and its existing V3 appearance configuration for this comparison.

The V3 canvas reads `generator.mainWidth` from its own config for the return-stroke width. Keep that value aligned with `mainWidth` in `lightning-config-v4.ts` if you tune the trunk width.

## Quality selection: one-switch A/B test

Default (quality selection enabled):

```ts
qualitySelection: {
  enabled: true,
  maxRetries: 2,
  minimumScore: 0.80,
},
```

For the no-selection performance/visual test:

```ts
qualitySelection: {
  enabled: false,
  maxRetries: 2,       // ignored while disabled
  minimumScore: 0.80,  // ignored while disabled
},
```

When disabled, the generator:

1. Generates exactly one candidate using the supplied/base seed.
2. Does not run `scoreLightningStrike()`.
3. Does not derive retry seeds or generate additional candidates.
4. Returns `qualityScored: false`, `qualityScore: -1`, and `qualityAttempts: 1`.

When enabled, the first candidate uses the base seed. Retry candidates use deterministic derived seeds. Generation stops when a candidate meets `minimumScore`; otherwise, the best-scoring candidate is returned after `maxRetries + 1` total attempts.

The returned metadata can be logged while testing:

```ts
console.log("Lightning generation", {
  seed: strike.seed,
  segments: strike.segments.length,
  branches: strike.branchCount,
  qualityScore: strike.qualityScore, // -1 means scoring was skipped
  qualityScored: strike.qualityScored,
  qualityAttempts: strike.qualityAttempts,
});
```

## What changed in V4

### Geometry

- Main channel: recursive midpoint displacement, 6 generations = 64 connected micro-segments.
- Primary branches: 4 generations = 16 segments per full branch.
- Secondary/tertiary branches: 3 generations = 8 segments per full branch.
- Displacement amplitude decays at each subdivision level, producing large bends first and finer electrical chatter later.
- Midpoint Y positions preserve a minimum amount of downward progress, avoiding backwards steps and loops.
- Branch attachment is stratified along the trunk, with a preference for actual trunk kinks.
- Each branch's child forks use the parent's local tangent and an outward bias (80% outward / 20% inward by default).
- Child forks are selected at spaced interior positions rather than independently spawning from many adjacent segments.
- Main-trunk taper is linear from the starting width to the configured final-width ratio. It does not use repeated exponential tapering.

### Quality selection

- Optional score/retry pass.
- Scores primary fork distribution, branch length/curvature, descendant density, main-channel sinuosity, short descendants and non-junction segment crossings.
- The intersection scan runs only while quality selection is enabled.
- The score is a geometric heuristic, not a visual or machine-learning judgement. Keep the toggle during evaluation; don't treat the threshold as an objective measure of beauty.

### Rendering

The V3 canvas is deliberately unchanged. V4 only changes the generated geometry and its metadata. This keeps the performance comparison focused on the generator and quality-selection switch.

## Tuning map

In `lightning-config-v4.ts`:

- `mainFractalGenerations`: main-channel detail; 6 means 64 segments.
- `primaryBranchFractalGenerations`: primary branch detail; 4 means 16 segments.
- `secondaryBranchFractalGenerations` / `tertiaryBranchFractalGenerations`: descendant detail; 3 means 8 segments.
- `mainDisplacementRatio`: size of the broad and fine main-channel bends.
- `branchDisplacementRatio`: size of the broad and fine branch bends.
- `displacementDecay`: how quickly smaller details shrink across subdivision levels.
- `maximumDisplacementRatio`: safety cap on any one midpoint displacement.
- `minimumForwardProgressRatio`: how much downward progress each midpoint must preserve.
- `outwardForkProbability`: directional bias for secondary/tertiary branches.
- `branchForkAngleRange`: extra angle added around the local parent tangent.
- `maxChildBranchesPerBranch`: maximum child forks spawned by each branch.
- `qualitySelection.enabled`: the single switch for score/retry on or off.

The old `mainSegmentCount`, `primaryBranchStepCount`, `branchTurnPersistence` and `branchMicroKinkChance` controls are replaced by explicit fractal generation/displacement controls. The fractal subdivision now supplies the macro-to-micro bends directly.

## Validation performed

- Strict TypeScript check on the three V4 source files.
- 1,000 seeded strikes at 393 × 852.
- Parent references, finite coordinates, reveal ranges and segment ceiling validated.
- Same seed reproduced identical geometry with quality selection on and off.
- Disabled quality selection confirmed to return one candidate and skip scoring.
- Desktop Node microbenchmark included in `VALIDATION-RESULTS.json`.

The desktop benchmark is not a mobile-device performance measurement. Test on-device in a release build before drawing conclusions about frame time.
