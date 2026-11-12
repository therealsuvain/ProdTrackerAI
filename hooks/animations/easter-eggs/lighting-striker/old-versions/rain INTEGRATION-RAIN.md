# Lightning Striker — Scenario 2: Heavy Rain

This integration is based on the exact `use-lightning-striker-animation(1).tsx` and `lightning-config-v3.ts` uploaded for this turn. It preserves the existing V4 generator, V3 optimized Skia lightning canvas, Power Cut hook, and the controller's current audio-cleanup choice.

## Behaviour

1. The normal lightning strike, return stroke and thunder complete as they do now.
2. The bolt and its atmosphere fade out using the existing lightning timing.
3. The rain event begins. A subtle `#071525` atmosphere tint fades in, and the supplied rain/thunder recording starts.
4. Heavy rain remains at full emitter density for a randomized 10–15 seconds.
5. Emitter retirement is spread across a randomized 4–6 seconds. The number of cycling drops therefore decreases progressively.
6. Each already-falling drop is allowed to finish its last fall. The final drain period is 1.4 seconds by default.
7. The rain audio volume fades in 12 steps over the same 4–6 second taper.
8. The overlay fades away and the main Easter egg Promise completes, releasing the existing screen activation lock.

Rain is rendered as three Skia paths (far/mid/near). It does not use BlurMask and does not create React components per raindrop. Particle geometry is generated once at event start on JS; one Reanimated shared value drives path updates on the UI thread.

## Files to add

Copy into `hooks/animations/easter-eggs/lighting-striker/`:

- `use-lightning-rain.tsx`
- `use-lightning-striker-animation.rain.tsx` (complete controller based on the uploaded current controller; rename to `use-lightning-striker-animation.tsx` only after reviewing/merging)

Copy the rain audio to:

`assets/easter-eggs/lighting-strike/rain-thunder.mp3`

The `flickering-flames.mp3` file is included in the asset bundle for Scenario 3, but it is not imported or played by this rain implementation.

## Config changes

In your existing `lightning-config-v3.ts`:

1. Add `import type { LightningRainConfig } from "./use-lightning-rain";` beside the Power Cut config type import.
2. Add `rain: LightningRainConfig;` to `LightningStrikerConfig.specialEvents`.
3. Add the `rain` object from `RAIN-CONFIG-CHUNK.md` beside the existing `powerCut` object.

`lightning-config-v3.with-rain.ts` is a complete reference copy made from the config file uploaded in this turn, with only those rain additions. Prefer the small additions above if you have made further local config edits since uploading.

## Controller changes

The complete reference controller is `use-lightning-striker-animation.rain.tsx`. The targeted changes are:

1. Import `useLightningRain`.
2. Extend `specialEvent` to accept `"rain"`.
3. Create the rain controller with `require("@/assets/easter-eggs/lighting-strike/rain-thunder.mp3")` and `LIGHTNING_STRIKER_TUNING.specialEvents.rain`.
4. Select at most one special event per activation. `powerCut` and `rain` cannot both run for the same strike.
5. Start rain only after the existing lightning fade completes, then await `rain.run(canvas.width, canvas.height)` before finishing the animation Promise.
6. Render `rain.overlayLayer` after the existing `powerCut.overlayLayer` inside the topmost lightning overlay.
7. Call `rain.cancel()` from explicit cancellation and unmount cleanup.

The controller's `specialEvent: "rain"` start option forces rain for testing, regardless of the configured random chance. `specialEvent: "powerCut"` similarly forces Power Cut. `specialEvent: "none"` suppresses both.

## Important current config note

In the uploaded `lightning-config-v3.ts`, `powerCut.chance` is currently `1` (testing override). The new rain chance is `0.05`. With a 100% Power Cut chance, random selection will always choose Power Cut and will never reach rain. To test rain, force it:

```tsx
void lightningStriker.start(animationCanvasRef, {
  specialEvent: "rain",
});
```

When you finish testing Power Cut, restore its production chance (for example `0.05`) so the random selector can choose either event. With Power Cut and Rain each set to `0.05`, normal strikes remain approximately 90% of activations.

## Tuning

All rain controls live in `LIGHTNING_STRIKER_TUNING.specialEvents.rain`:

- `heavyDurationRangeMs`: full-density duration (10–15 seconds by default).
- `fadeDurationRangeMs`: gradual emitter retirement period (4–6 seconds by default).
- `drainDurationMs`: time for remaining drops to leave the screen.
- `maxParticles`: fixed pool size.
- `speedRangeDpPerSecond`, `windAngleRangeDegrees`: motion.
- `far/mid/nearDropLengthRange`, `far/mid/nearStrokeWidth`, `far/mid/nearOpacity`: depth appearance.
- `atmosphereColor`, `atmosphereOpacity`, fade times: subtle storm tint.
- `audioVolume`, `audioFadeSteps`: audio level and fade smoothness.

## Audio

The provided `soundreality-rain-thunder-sfx-525011.mp3` is 48.024 seconds long and has audible content from the beginning. It is copied into the app asset path as `rain-thunder.mp3`. The event does not loop it: it starts once, fades its volume across the rain taper, and is paused/reset when the rain event completes or is cancelled.

## Scope

This adds Scenario 2 only. Power Cut remains unchanged. Fire audio is packaged for the later fire scenario but is intentionally not wired yet. No Easter egg registry or GlobalSearchScreen changes are needed; the existing Lightning Striker row activation continues to call the same controller.

## Validation

The new hook, config reference and integrated controller pass TypeScript syntax transpilation. The ZIP passes integrity validation. This is not a full semantic type-check against your exact Expo/Skia package versions and has not been run on a device.
