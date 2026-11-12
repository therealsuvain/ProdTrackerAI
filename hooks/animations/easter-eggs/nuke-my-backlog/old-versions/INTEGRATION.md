# Nuke My Backlog — Flight Environment + Continuous Spiral (v5)

This iteration is based on the uploaded v3 implementation and preserves its Act 0 pumping/ignition behaviour and `approachReady` handoff.

## What changed

- The vertical launch now awaits the launch player's `play()` call before starting the liftoff animation.
- The flight bed is awaited before the first off-screen hold begins.
- The upper return is one continuous, arc-length-resampled inward spiral (1.5 turns) that exits fully beyond the opposite screen edge. Position and body rotation are both driven by the same linear progress value; there are no intermediate waypoint stops.
- The rocket shrinks to `distantFlightScale` during the launch and upper flight, then grows back during the bottom-to-middle return.
- The projected shadow is rendered on the cloud deck, below nearer cloud sprites, and follows the rocket's position, orientation and scale.
- Cloud opacity and placement are toned down compared with the first composition so the background does not become a stack of competing cloud stripes.
- The audio hook returns a memoized object. This prevents its identity changing on every render and triggering the animation hook's unmount cleanup during ordinary state updates.

## Files

- `hooks/animations/easter-eggs/nuke-backlog-v1/nuke-my-backlog-animation.tsx` — replacement hook.
- `hooks/animations/easter-eggs/nuke-backlog-v1/nuke-flight-environment.tsx` — new cloud scene component.
- `hooks/animations/easter-eggs/nuke-backlog-v1/use-nuke-my-backlog-audio.ts` — replacement Expo Audio helper.
- `assets/easter-eggs/nuke-backlog-assets/flight-scene/` — cleaned cloud assets and the provided cloud-deck background.
- `assets/easter-eggs/nuke-backlog-assets/audio/` — launch, thrust and explosion clips supplied in this conversation.

## Integration

1. Back up the current v3 hook.
2. Merge the package `assets/` folder into your project's matching `assets/` folder.
3. Copy the three files from `hooks/animations/easter-eggs/nuke-backlog-v1/` beside your existing hook, replacing `nuke-my-backlog-animation.tsx`.
4. Keep your existing `flame_1.png` through `flame_5.png` in `assets/easter-eggs/nuke-backlog-assets/`; this package deliberately does not overwrite those files.
5. No `GlobalSearchScreen` change is intended. Its existing `behindLayer` placement and cancellation call should remain as they are.

If the hook folder differs in your project, keep the three code files together so their relative imports resolve. The `@/assets/...` aliases assume the same project alias already used by v3.

## Main tuning values

- `distantFlightScale`: current 0.66.
- `upperFlightPathDurationMs`: current 6000 ms.
- `flightSpiralTurns`: current 1.5.
- `flightSpiralCenterXRatio`, `flightSpiralCenterYRatio`: spiral centre.
- `flightSpiralStartRadius*Ratio`, `flightSpiralEndRadius*Ratio`: initial/final spiral radii.
- `projectedShadowOffsetX/Y`, `projectedShadowOpacity`, `projectedShadowBlurRadius`: shadow treatment.
- `NUKE_FLIGHT_ENVIRONMENT_TUNING`: independent cloud placement, opacity and drift.

## Remaining audio clips

`crash` and `screenCrack` are intentionally left null until those recordings are supplied. The current `explosion.mp3` is wired for the next impact stage but is not played by this flight stage.

## Validation

The files are syntax-transpiled and the ZIP is integrity-checked. This has not been built or run in your Expo app or tested on a physical device, and it has not been type-checked against your exact Expo SDK versions.
