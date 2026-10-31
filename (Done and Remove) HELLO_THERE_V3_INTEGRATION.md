# Hello There V3 — integration notes (code only)

V3 addresses the three issues reported in `hello_there_v3.mp4`:

1. Character PNG pixels could show below the Easter-egg row. V3 clips all rear artwork at the **row's top edge** with a transparent viewport, rather than drawing an opaque mask that would cover other results.
2. The wave repeatedly swapped among three PNGs and waited between swaps. V3 uses `wave__flat_1.png` only for the arm's entry/exit and one continuously animated `wave_flat_2.png` for all three wave cycles. The cycle is an `Animated.sequence` using the native driver; no React state/image swaps occur inside the cycle.
3. The face briefly flashed back to its fully visible position at the end. V3 keeps all head expressions mounted, switches expression by opacity, and no longer resets `headY` to `0` while the overlay is finishing.

No asset files are included or modified.

## 1. Replace the animation component

Place `hello-there-easter-egg-animation-v3.tsx` at:

```text
components/ui/global-search/hello-there-easter-egg-animation-v3.tsx
```

Change the import in `global-search-screen.tsx`:

```tsx
import { useHelloThereEasterEggAnimation } from
  "@/components/ui/global-search/hello-there-easter-egg-animation-v3";
```

Keep your existing asset files in `assets/easter-eggs/`. The component uses literal `require(...)` calls. V3 uses `wave__flat_1.png` for deployment/return and `wave_flat_2.png` for the wave. The old `wave_flat_3.png` require and its old three-frame tuning block are retained as commented/reference-only material.

## 2. Change the canvas child order

The most important integration change: `behindLayer` must now be rendered **after** search content. That is how the character appears above filter labels and section headings. Its transparent clip ends at the row's top edge, so it does not paint over the row or later result rows.

Use this order inside your existing measured canvas. Keep your actual header, search input, filter controls and SectionList where indicated; don't duplicate or remove them.

```tsx
<View
  ref={animationCanvasRef}
  collapsable={false}
  style={styles.animationCanvas}
>
  <View style={styles.searchContentLayer}>
    {/* Keep all your existing search-screen content here, unchanged. */}
    {/* Header, Searchbar, filters, SectionList, etc. */}
  </View>

  {/* Renders above chip labels/section labels, but is clipped at row top. */}
  {helloThereAnimation.behindLayer}

  {/* Gripping fingers are clipped inside the row; bubble renders above content. */}
  {helloThereAnimation.foregroundLayer}
</View>
```

Keep or add these styles:

```tsx
animationCanvas: {
  flex: 1,
  overflow: "visible",
},
searchContentLayer: {
  flex: 1,
  zIndex: 1,
  elevation: 1,
  backgroundColor: "transparent",
},
```

The V3 overlay itself uses `zIndex: 20` / `elevation: 20`, and the foreground layer uses `zIndex: 30` / `elevation: 30`. Keep the canvas `collapsable={false}` so `measureInWindow` works on Android.

## 3. Prevent the row moving during animation

The controller now exposes a reactive `active` boolean. Add this prop to the existing SectionList:

```tsx
scrollEnabled={!helloThereAnimation.active}
```

If query or filter changes can remove the Easter-egg row during an active animation, cancel the animation before applying that change.

## 4. Keep the existing activation handler

The controller still exposes the same `start(rowRef, animationCanvasRef, onFinished)` / `cancel()` methods. Your current `handleEasterEggPress` can remain as it is, provided it starts Hello There with the tapped row ref and releases `activeEggActivationRef` from the `onFinished` callback.

Keep the visibility cleanup:

```tsx
useEffect(() => {
  if (!visible) helloThereAnimation.cancel();
}, [visible, helloThereAnimation.cancel]);
```

The hook still accepts your current `theme.background` argument for compatibility, but it no longer paints an opaque row mask. Clipping is what prevents the artwork from showing below the row, without hiding other search results.

## 5. Values carried forward from your tuning

- `headTopExtraY: 5`
- `avatarCenterXRatio: 0.70`
- `handSpreadHeadRatio: 0.70`
- `wavePivotHeadOffsetRatio: 0.28`
- `waveHiddenPivotY: 82`
- `waveActivePivotY: -6`
- `WAVE_CYCLE_ART.scale: 0.138` (+15% from your tested `0.12`)

The face remains at the reduced size (`headWidthRatio: 0.27`, min `75`, max `104`). Head expressions stay mounted to eliminate source-loading gaps. The configured 5 dp hair sliver compensates for the `+5` head-top offset during Act 0's hidden curious-to-neutral swap; the final retreat goes fully below the clip edge.

## 6. First things to verify on device

1. No PNG pixels are visible below the Easter-egg row; the next search content remains visible.
2. Character images render above the filter labels, not between chip backgrounds and their text.
3. Left/right gripping hands stay near the reduced head.
4. `wave_flat_2.png` cycles three times continuously without image swaps or mid-wave pauses; `wave__flat_1.png` is used only for entry/exit.
5. The character does not flash back after the final retreat.

The component passed a TypeScript/JSX syntax transpilation check. It has not been executed in your Expo app, so exact on-device alignment still needs visual verification.

