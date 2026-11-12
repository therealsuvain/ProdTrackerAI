# Nuke My Backlog — Act 3 image pipeline update

## Files

- `nuke-my-backlog-act3-v2.tsx` — replacement Act 3 component.
- `nuke-my-backlog-act3-image-pipeline.diff` — focused diff against the prior transition-fix Act 3 file.

## Apply

1. Back up your current `nuke-my-backlog-act3-v2.tsx`.
2. Check whether `expo-image` is installed: `npm ls expo-image`.
3. If it is missing, install the Expo-compatible version: `npx expo install expo-image`.
   - Expo Go already includes `expo-image`.
   - If you use a custom development build and add `expo-image` for the first time, rebuild that dev client so the native module is included.
4. Replace only the existing `nuke-my-backlog-act3-v2.tsx` with the file in this package. The controller import path remains unchanged; no controller edit is included.
5. Keep the `NUKE_MY_BACKLOG_ACT3_FRAME_MODE` value you currently prefer (`"js-index"` or `"native-opacity"`). Both implementations remain available.

The controller must retain the handoff correction already applied: `act3Preparing` becomes true only after Act 2 reaches its final centre pose, and the component receives `preparing`, `active`, and `onPrepared` props. Do not move preparation back into Act 2.

## What changed

- Replaces the six serial batches of hidden React Native `Animated.Image` views with concurrent `expo-image` `Image.loadAsync()` calls for the local assets.
- Retains the returned native `ImageRef` objects and passes those exact references to the final image views.
- Keeps all 12 authored rocket frames, all 3 transition-smoke images, all 4 smoke-ring frames and all 5 exhaust frames. No source assets are deleted or substituted.
- Decodes rocket frames 0–10 to their maximum pitch-turn display size with a 1.35× oversampling margin. The 90° frame retains the resolution needed for the camera approach.
- Decodes transition smoke and exhaust to their maximum Act 3 display size. Smoke-ring frames retain their final approach resolution.
- Renders each sprite through `Animated.createAnimatedComponent(ExpoImage)` directly, avoiding an extra wrapper View per image while retaining the existing Animated styles.
- Mounts the final scene hidden only after native image references resolve, then waits two animation frames for the image views to commit before reporting readiness.
- Logs image-reference load time, successful reference count, estimated decoded bitmap memory and hidden-scene commit time.

`maxWidth` and `maxHeight` are decode-size limits in physical pixels and preserve aspect ratio. The 1.35× oversampling margin is a tuning constant near the top of the file. The original PNGs, their dimensions, and the APK-bundled source assets remain untouched. Runtime decode sizing does not reduce APK size; it aims to reduce bitmap memory and unnecessary decoded pixels.

## Runtime diagnostics

Look for:

- `[Nuke My Backlog] Act 3 native image decode: 24/24 refs in ...ms; estimated decoded memory ... MiB.`
- `[Nuke My Backlog] Act 3 hidden scene commit: ...ms after decode.`

The first duration tells us how long native image-reference loading took. The second measures the delay from image decoding to the hidden scene being committed. If fewer than 24 references load, the failing asset is logged and that view falls back to its original bundled source.

## Validation performed here

- TypeScript/TSX syntax transpilation: passed with zero syntax diagnostics.
- Static checks: all 12 rocket frame sources remain, both frame-switching modes remain, concurrent `Image.loadAsync` loading and decode-size limits are present, and the old serial batch preloader is absent.
- ZIP integrity check: passed.
- No full project type-check, Expo build, or physical-device test was available here.
