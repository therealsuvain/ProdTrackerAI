# Secondary Hello There Easter egg animations

This package adds two independent effects and a session-only activation sequence. It does not modify the existing Hello There animation.

## Files

- `no-no-no-easter-egg-animation.tsx` — arm, separate palm and index-finger layers, finger wag, and “Patience is a virtue” bubble.
- `sleeping-z-easter-egg-animation.tsx` — staggered `z_triple`, `z_double`, and `z_single` upward float. The sequence finishes only after the last complete image exits above the screen.
- `use-easter-egg-animation-sequence.ts` — first/second/third press progression and 90-minute cooldown.

Copy these files into:

```text
components/ui/global-search/easter-eggs/
```

The static images are intentionally not included. Add them to `@/assets/easter-eggs/` with these exact names:

```text
cut_arm_without_hand_smooth.png
cut_hand_without_index_smooth.png
cut_index_alone_smooth.png
cut_hand_alone_smooth.png
z_triple.png
z_double.png
z_single.png
```

`cut_hand_alone_smooth.png` is retained as a reference asset in the source; the independent index uses `cut_hand_without_index_smooth.png` plus `cut_index_alone_smooth.png`.

## Parent integration

Keep your existing Hello There hook/controller. Add the two new hooks and the sequence hook in the same component that owns the Easter egg row refs and the shared animation canvas ref:

```tsx
const helloThere = useHelloThereEasterEggAnimation(theme.background);
const noNoNo = useNoNoNoEasterEggAnimation();
const sleepingZ = useSleepingZEasterEggAnimation();
const sequence = useEasterEggAnimationSequence();
```

On an accepted tap, keep the existing outer `activeEggActivationRef` guard and discovery persistence. Replace the direct Hello There start with:

```tsx
const result = await sequence.activate({
  "hello-there": () => helloThere.start(rowRef, canvasRef),
  "no-no-no": () => noNoNo.start(rowRef, canvasRef),
  "sleeping-z": () => sleepingZ.start(rowRef, canvasRef),
});
```

Do not advance the sequence in the row's `onPress` or in a separate tap counter. `sequence.activate` owns progression and ignores any tap while one of the animations is running.

Render overlays after the normal search content, in this order:

```tsx
{helloThere.behindLayer}
{noNoNo.behindLayer}
{sleepingZ.behindLayer}
{helloThere.foregroundLayer}
{noNoNo.foregroundLayer}
```

The Sleeping Z overlay has no foreground layer. While any effect is active, it is recommended to disable SectionList scrolling and other interactions that would move the measured row away from the overlay anchor.

Cancel the active controllers when the search screen is dismissed/unmounted:

```tsx
helloThere.cancel();
noNoNo.cancel();
sleepingZ.cancel();
```

Note: `useEasterEggAnimationSequence` is intentionally session-only. The 90-minute cooldown begins when the third animation starts. Sleeping Z presses during that cooldown do not extend it. Once it expires, the next accepted press starts Hello There again.

## Tuning

Each animation file has a clearly commented `TUNING` object. The No No No component exposes arm/hand/index placement, finger angle, jitter, number of cycles, movement durations, and bubble position/timing. The Sleeping Z component exposes each cluster's size, X offset, stagger, travel duration, drift, rotation, starting offset, and total exit boundary.
