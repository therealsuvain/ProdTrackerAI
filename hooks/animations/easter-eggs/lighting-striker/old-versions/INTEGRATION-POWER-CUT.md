# Lightning Striker — Power Cut scenario (first rare event)

This is an additive integration. It does not replace your V4 generator, optimized canvas, existing strike/thunder audio helper, or Global Search dispatcher.

## Included audio files

Copy `assets/easter-eggs/lighting-striker/audio/` into your project's matching `assets/easter-eggs/lighting-striker/audio/` directory.

- `short-circuit.mp3` — 4.90 s decoded duration. The recording has about 480 ms of leading silence; the hook seeks to 480 ms by default.
- `blackout.mp3` — 3.23 s decoded duration. The recording has about 100 ms of leading silence; the hook seeks to 100 ms by default.
- `light-flicker.mp3` — 4.85 s decoded duration. No meaningful leading silence; used from the beginning.
- `rain-thunder.mp3` — 48.02 s. Reserved for the rain scenario; not loaded by this power-cut implementation.
- `flickering-flames.mp3` — 33.15 s. Reserved for the fire scenario; not loaded by this power-cut implementation.

## 1. Copy the new hook

Copy:

`hooks/animations/easter-eggs/lighting-striker/use-lightning-power-cut.tsx`

to your matching project folder.

## 2. Add the unified configuration

Do not create a second configuration file. Add the `specialEvents` type/property from `POWER-CUT-CONFIG-CHUNK.ts` to your existing `lightning-config.ts`.

Add this type import:

```ts
import type { LightningPowerCutConfig } from "./use-lightning-power-cut";
```

Add this property to your existing config type:

```ts
specialEvents: {
  powerCut: LightningPowerCutConfig;
};
```

Then add the `specialEvents` object from `POWER-CUT-CONFIG-CHUNK.ts` to `LIGHTNING_STRIKER_TUNING`. Keep your existing V4 generator and V3 appearance settings as they are.

## 3. Add the hook to use-lightning-striker-animation.tsx

Import:

```tsx
import { useLightningPowerCut } from "./use-lightning-power-cut";
```

Inside `useLightningStrikerAnimation()`, alongside the existing audio hook, instantiate:

```tsx
const powerCut = useLightningPowerCut(
  {
    shortCircuit: require("@/assets/easter-eggs/lighting-striker/audio/short-circuit.mp3"),
    blackout: require("@/assets/easter-eggs/lighting-striker/audio/blackout.mp3"),
    lightFlicker: require("@/assets/easter-eggs/lighting-striker/audio/light-flicker.mp3"),
  },
  LIGHTNING_STRIKER_TUNING.specialEvents.powerCut,
);
```

These are static Metro `require()` calls. If your project's asset directory differs, adjust only the three paths.

## 4. Add a manual test override

Extend `LightningStrikerStartOptions`:

```ts
specialEvent?: "random" | "none" | "powerCut";
```

Near the beginning of `start()`, determine the selected event once:

```tsx
const powerCutConfig = LIGHTNING_STRIKER_TUNING.specialEvents.powerCut;
const shouldRunPowerCut =
  options.specialEvent === "powerCut" ||
  (options.specialEvent !== "none" &&
    powerCutConfig.enabled &&
    Math.random() < powerCutConfig.chance);

let powerCutPromise: Promise<boolean> | null = null;
```

An explicit `specialEvent: "powerCut"` forces the event even if its random chance is low. `"none"` disables it for a run. Omitting the option uses the configured 5% probability.

## 5. Start the event at the return stroke

In the existing return-stroke section, immediately after scheduling the normal strike and thunder sounds:

```tsx
audio.playStrike(timing.strikeSoundDelayMs);
audio.playThunder(timing.thunderSoundDelayMs);

// The short-circuit sound begins at the return-stroke boundary. The blackout
// sound is scheduled by the power-cut controller near the end of that clip.
if (shouldRunPowerCut) {
  powerCutPromise = powerCut.run();
}
```

This lets the normal lightning visual complete and fade while the short-circuit / blackout audio sequence progresses. The black overlay then takes over near the end of `blackout.mp3`.

## 6. Keep the activation lock until recovery completes

After the existing lightning visual fade has completed, but before the normal `finish(runId)` call:

```tsx
if (powerCutPromise) {
  const powerCutCompleted = await powerCutPromise;
  if (!powerCutCompleted || runId !== runIdRef.current) return false;
}
```

This is essential: `start()` must remain pending while the screen is black and while the light flickers back on. Your existing screen-level activation lock is therefore held until the entire scenario has recovered.

## 7. Add the overlay above the lightning canvas

Inside the existing `overlayLayer` JSX, add the black overlay as the final child, after the lightning canvas and screen-flash layer:

```tsx
{powerCut.overlayLayer}
```

The new layer already has `pointerEvents="none"`, `zIndex: 1000` and `elevation: 1000`. Keep the full Lightning Striker overlay rendered as the final sibling inside the shared animation canvas, as you already fixed for the normal strike.

## 8. Cancellation cleanup — important audio lifecycle detail

Add `powerCut.cancel()` to the explicit `cancel()` path, the error path, and controller unmount cleanup.

Do NOT call `powerCut.cancel()` when the ordinary lightning visuals finish. Do NOT reintroduce `audio.stopAll()` into normal visual cleanup. The one-shot strike/thunder sounds and the power-cut sounds are intentionally allowed to finish naturally unless the whole Easter egg is explicitly cancelled or the controller unmounts.

The power-cut hook owns its three players independently and stops only those players on explicit cancellation/unmount.

## 9. Force the event for testing

Temporarily call:

```tsx
void lightningStriker.start(animationCanvasRef, {
  specialEvent: "powerCut",
});
```

Restore the ordinary call afterwards:

```tsx
void lightningStriker.start(animationCanvasRef);
```

You can also temporarily set `chance: 1` in the config. The explicit override is preferable because it doesn't change the production probability.

## Sequence timing with the supplied recordings

Using the supplied clip durations and default offsets:

1. Return stroke occurs; `short-circuit.mp3` starts from 480 ms (skipping its leading silence), after the configured 250 ms event delay.
2. `blackout.mp3` starts during the final portion of the short-circuit recording. `shortCircuitToBlackoutOverlapMs` controls this overlap.
3. The screen fades completely black near the end of `blackout.mp3`; `darkBeforeBlackoutAudioEndsMs` and `darkTransitionMs` control the alignment.
4. The screen stays fully black for a random 5–10 seconds.
5. `light-flicker.mp3` starts at the same boundary as the visual recovery sequence.
6. The interface flickers through the configured brightness steps and reaches 100% brightness at the end of the 4.852-second recovery.

The event overlays the UI. It does not delete, mutate, or unmount search results.

## Validation notes

The standalone power-cut hook passes TypeScript syntax transpilation. The asset durations and leading-silence offsets were measured from the supplied recordings. This package has not been compiled against your exact Expo SDK / Reanimated versions or device-tested; apply it to your latest integrated controller and run the forced event first.
