# Nuke My Backlog — Act 3 integration

## Included

- `nuke-my-backlog-act3.tsx` — new, independently tuneable Act 3 camera-approach component.
- `nuke-my-backlog-animation.act3.patch.diff` — small integration patch for the existing Act 0–2 controller. It does not replace that file.
- `assets/easter-eggs/nuke-backlog-assets/act3/` — the 11 perspective/smoke PNGs supplied for Act 3.
- `act3-perspective-size-preview.jpg` — preview showing the five rocket views aligned by visible alpha width.

## Copy locations

1. Copy `nuke-my-backlog-act3.tsx` beside `nuke-my-backlog-animation.tsx` in `hooks/animations/easter-eggs/nuke-backlog-v1/`.
2. Copy the included `assets/easter-eggs/nuke-backlog-assets/act3/` folder into the same matching location in your project's `assets/` folder.
3. Apply the `.patch.diff` to your current `nuke-my-backlog-animation.tsx`, or use it as a reference for the changes if your locally tuned file differs. Do not replace your controller with a generated full-file copy.

The Act 3 component uses your existing `rocket.png` for the initial side view, so that image is not duplicated in the package.

## What the integration patch changes

- Imports the new Act 3 component.
- Adds `cameraApproach` and `cameraApproachComplete` stages.
- Exposes the existing `audio.fadeFlightTo` callback to Act 3. It does not create another AudioPlayer.
- Starts Act 3 immediately after the current bottom-entry handoff.
- Hides the Act 2 rocket and its projected shadow as Act 3 takes over, while retaining the sky/cloud environment.
- Resets the Act 3 mount flag on session start, cancellation and normal cleanup.

## Main tuning file

At the top of `nuke-my-backlog-act3.tsx`, edit `NUKE_MY_BACKLOG_ACT3_TUNING`. Every chapter has its own settings:

- `3.1` perspective-turn duration and cross-fade.
- `3.2` transition smoke sizes and opacity.
- `3.3` head-on smoke ring size, expansion, frame cross-fade and rotation.
- `3.4` final camera coverage and zoom timing.
- `3.5` left/right roll angles and the three distinct timing segments.
- `3.6` radial rays, atmospheric haze and final bloom.
- `3.7` flight-loop approach volume and fade duration.

The rocket views are sized using their measured alpha bounds, not the full PNG canvas. Their visible cross-section width is held consistent with the existing Act 2 rocket; their visible height therefore shortens naturally as the generated view approaches 90 degrees. No squash transform is applied to fake this.

## Audio volume ceiling

`approachFlightVolume` is set to `1.0`. The Expo Audio `AudioPlayer.volume` property is documented as a `0.0–1.0` range; `2.0` is not a supported volume value. The new component fades the already-running thrust loop to `1.0` over `approachFlightVolumeFadeMs`.

## Validation

The new component and the integrated controller passed TypeScript/TSX syntax transpilation. Static asset files and references were checked. This is not an Expo build or device-runtime test; please run it in your app and check the turn timing, image alignment, smoke layering and FPS on a physical device.
