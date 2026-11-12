# Lightning Striker — Scenario 2: Heavy Rain

This update adds the procedural heavy-rain special event to the latest uploaded Lightning Striker controller and `lightning-config-v3.ts`.

Start with `INTEGRATION-RAIN.md` for the exact merge steps.

## Package contents

- `hooks/animations/easter-eggs/lighting-striker/use-lightning-rain.tsx` — new independent rain controller and Skia particle renderer.
- `hooks/animations/easter-eggs/lighting-striker/use-lightning-striker-animation.rain.tsx` — full controller reference with rain selection, overlay, cancellation and promise lifecycle wired in.
- `lightning-config-v3.with-rain.ts` — complete reference copy of the uploaded config with rain type/config additions.
- `RAIN-CONFIG-CHUNK.md` — minimal additions for your existing unified config.
- `assets/easter-eggs/lighting-strike/rain-thunder.mp3` — rain/thunder sound used by Scenario 2.
- `assets/easter-eggs/lighting-strike/flickering-flames.mp3` — supplied fire audio reserved for Scenario 3; not used yet.

## Test immediately

After applying the config/controller changes and copying the rain audio into your app's matching assets folder:

```tsx
void lightningStriker.start(animationCanvasRef, {
  specialEvent: "rain",
});
```

This forces rain independent of probability settings. Normal calls retain random event selection.
