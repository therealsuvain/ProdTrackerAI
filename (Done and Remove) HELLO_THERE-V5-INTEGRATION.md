# Secondary Easter Egg Animations — Integration Fixes

This revision addresses the integration and asset/layout issues found in the uploaded `global-search-screen(1).tsx` and supplied PNGs.

## What was actually preventing presses 2 and 3

The sequence hook itself was not the reason presses 2 and 3 were ignored. The screen-level guard was:

```tsx
activeEggActivationRef.current = eggId;
const result = await sequence.activate(...);
return;
```

The ref was set before the animation, but never cleared after `sequence.activate()` resolved. The first run completed, while `activeEggActivationRef.current` still contained `hello_there`; the next tap returned at the top of the handler before the sequence hook was reached.

The updated screen handler uses `try/finally` and releases the ref after the selected animation Promise settles. The sequence hook retains its own lock, so concurrent taps are still ignored and do not consume a sequence step.

**Important:** the three animations are stages of the same `hello_there` Easter egg result. The registered egg ID remains `hello_there` (underscore). The sequence's internal launcher keys (`hello-there`, `no-no-no`, `sleeping-z`) are separate animation-stage names. Do not add separate registry entries for the latter two.

## Files to replace

Copy these two updated hooks over the files already imported by your screen:

```text
hooks/animations/easter-eggs/hello-there-phase-2-animation.tsx
hooks/animations/easter-eggs/hello-there-phase-3-animation.tsx
```

The `require()` asset paths remain unchanged. No PNG assets are included in this bundle or need to be edited.

## GlobalSearchScreen changes

Preferred: apply `global-search-screen.integration.diff` to your current `global-search-screen.tsx`.

A full patched reference copy is also included as `global-search-screen.integration.tsx`, based on the exact uploaded screen. Do not replace a newer local file wholesale; use it to compare the targeted changes.

The screen patch makes three changes:

1. Releases `activeEggActivationRef` in `finally` after the animation sequence completes or fails.
2. Cancels all three animation controllers when Search is dismissed and disables list scrolling while any animation is active.
3. Leaves the same Hello There row as the entry point for all three presses. Its `activationEnabled` check does not need to add `no-no-no` or `sleeping-z` because those are sequence stages, not separate registered eggs.

## No No No asset calibration

The supplied arm, hand-without-index and index images are all **1600 × 1600** and are already aligned on the same source canvas. Their measured alpha bounds are:

- Arm without hand: `(583, 461) – (994, 1600)`
- Hand without index: `(680, 216) – (993, 461)`
- Index alone: `(816, 78) – (867, 266)`

The updated component renders all three with the same scale and top-left origin. The visible palm width, rather than the transparent PNG canvas width, drives the scale. The index rotates around its measured base joint. This avoids the previous tiny index and prevents independent scaling from pulling the hand/arm layers apart.

The overlay now has explicit `zIndex`/Android `elevation` values, matching the already-working Hello There overlay. The arm remains clipped at the tapped row's top edge; the speech bubble is in a higher foreground layer.

## Sleeping Z changes

- Uses 15 hand-authored cluster templates, each containing 2–4 actual Z glyphs.
- Selects 10 unique templates randomly on each run (no duplicate template in one run), producing 24–30 Z glyphs per run.
- Reuses `z_single.png`, `z_double.png` and `z_triple.png`; mirrored and offset arrangements provide visual variation.
- Uses actual alpha bounds to position the first visible pixels about 2.5 dp above the row border, so the first group responds immediately.
- Each group starts inside a narrow horizontal window (±7.5% of row width) and drifts towards a wider exit window (±34%), creating the requested `\\ /` funnel.
- The single-Z canvas width is reduced to 0.065 of the row width, roughly half the previous 0.125 setting.
- All ten groups are independently staggered and float upward for about 12–13 seconds; the full run completes at roughly 14 seconds when the last group's visible alpha bounds have cleared the top of the screen.
- The root overlay now sits above filters, labels and section headers, like Hello There.

## Cooldown

The current project screen imports your existing sequence hook:

```tsx
@/hooks/animations/easter-eggs/use-hello-there-animation-sequence
```

That hook is intentionally **not replaced** in this bundle, so your local 5-minute testing cooldown is preserved. Keep the five-minute value there while testing. The production value can be restored to your preferred greater-than-one-hour duration later.

## Test order

1. Tap Hello There: the original greeting should run exactly as before.
2. Tap the same Hello There row again: No No No should run.
3. Tap it a third time: Sleeping Z should run.
4. During any effect, tap again: the tap should be ignored, not queued, and must not advance the sequence.
5. Confirm No No No and Sleeping Z render above the filter chips/section header, while their artwork remains clipped below the Easter egg row.
6. Confirm the Z run shows the first pixels immediately, has a spread-out funnel rather than one cloud, and finishes only after all ten groups leave the top.
7. Dismiss Search during each effect once: the animation should cancel and the row should be usable after reopening.

The updated TSX files passed syntax transpilation. They have not been run in your Expo app; device rendering, gesture scale and final offsets still need your normal on-device check.
