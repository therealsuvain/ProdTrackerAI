# Hello There animation V2 — integration notes

This bundle contains source files only. Add your existing PNGs to `assets/easter-eggs/`; the component references the exact filenames with literal `require(...)` calls and does not modify any image.

## Files

- `hello-there-easter-egg-animation-v2.tsx` — the animation controller and two rendering layers.
- `search-result-row-easter-egg-v2.tsx` — the Easter egg row updated to pass its native row ref on tap.

## 1. Add the component

Place `hello-there-easter-egg-animation-v2.tsx` at:

```text
components/ui/global-search/hello-there-easter-egg-animation-v2.tsx
```

The asset paths expected by literal `require(...)` calls are:

```text
assets/easter-eggs/edited-head-curious.png
assets/easter-eggs/edited-head-neutral.png
assets/easter-eggs/edited-head-smile-1.png
assets/easter-eggs/edited-head-smile-2.png
assets/easter-eggs/head_winking.png
assets/easter-eggs/wall_gripped_left_only.png
assets/easter-eggs/wall_gripped_right_only.png
assets/easter-eggs/wall_mid_transition_left_only.png
assets/easter-eggs/wall_mid_transition_right_only.png
assets/easter-eggs/wall_palms_up_left_only.png
assets/easter-eggs/wall_palms_up_right_only.png
assets/easter-eggs/wave__flat_1.png
assets/easter-eggs/wave_flat_2.png
assets/easter-eggs/wave_flat_3.png
```

`wave__arm_with_shoulder.png` is not used by the specified animation sequence. No asset is bundled or changed here.

## 2. Update the row

Use `search-result-row-easter-egg-v2.tsx` as the updated version of your existing `GlobalSearchEasterEggRow` component. It adds a `rowRef` and changes the callback shape to `onPress(rowRef)`; it does not mount the animation inside the row.

## 3. Mount the two layers at the search-screen canvas level

In `global-search-screen.tsx`, import:

```tsx
import { useHelloThereEasterEggAnimation } from "@/components/ui/global-search/hello-there-easter-egg-animation-v2";
```

Ensure `View` is imported from `react-native`, then next to the other refs/hooks add:

```tsx
const animationCanvasRef = useRef<View | null>(null);
const helloThereAnimation = useHelloThereEasterEggAnimation(theme.background);
```

Wrap the current contents of your `KeyboardAvoidingView` in the canvas below. Keep the existing header, search bar, filter controls, SectionList, etc. inside `searchContentLayer` without changing their order:

```tsx
<KeyboardAvoidingView
  style={styles.keyboardContainer}
  behavior={Platform.OS === "ios" ? "padding" : undefined}
>
  <View
    ref={animationCanvasRef}
    collapsable={false}
    style={styles.animationCanvas}
  >
    {/* Behind character: must be BEFORE the actual row/list content. */}
    {helloThereAnimation.behindLayer}

    <View style={styles.searchContentLayer}>
      {/* Keep all existing search screen content here, in its current order. */}
      {/* Header, Searchbar, filters, shortcuts, SectionList, etc. */}
    </View>

    {/* Fingers and speech bubble: must be AFTER the actual row/list content. */}
    {helloThereAnimation.foregroundLayer}
  </View>
</KeyboardAvoidingView>
```

Add these styles to the existing screen StyleSheet:

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

The wrapper is important: `start()` measures the row and this canvas in window coordinates, then converts the row to canvas-local coordinates. Keep `collapsable={false}` so Android retains a measurable native view. During the effect, keep the SectionList from scrolling so the measured row cannot move away from the character; add `scrollEnabled={!helloThereAnimation.active}` to the existing SectionList. If you want query/filter changes to remain available during the animation, cancel the effect before applying a change that could remove or reposition the Easter-egg row.

## 4. Pass the row ref to the handler

Update the Easter-egg branch in `renderItem` to:

```tsx
return (
  <GlobalSearchEasterEggRow
    result={item}
    activationEnabled={eggId === "rickroll" || eggId === "hello-there"}
    onPress={(rowRef) => {
      void handleEasterEggPress(eggId, rowRef);
    }}
  />
);
```

Change the handler signature from `handleEasterEggPress(eggId: string)` to:

```tsx
const handleEasterEggPress = useCallback(
  async (eggId: string, rowRef: React.RefObject<View | null>) => {
```

Keep the existing Rickroll path. In the animation branch, replace the development alert only for Hello There with this pattern:

```tsx
if (egg.activation.kind === "animation") {
  if (eggId !== "hello-there") {
    Alert.alert(
      "Surprise still in development",
      "This Easter egg's effect is being designed. It isn't activated yet.",
    );
    return;
  }

  if (activeEggActivationRef.current) return;
  activeEggActivationRef.current = eggId;
  controller.recordSubmittedSearch();

  void recordGlobalSearchEasterEggDiscovery(eggId).catch((storageError) => {
    console.warn(
      "[Global Search] Couldn't persist Easter egg discovery.",
      storageError,
    );
  });

  void helloThereAnimation.start(rowRef, animationCanvasRef, () => {
    if (activeEggActivationRef.current === eggId) {
      activeEggActivationRef.current = null;
    }
  });
  return;
}
```

Add `View` to the handler's type imports if necessary. Leave the external URL branch for Rickroll unchanged; it must still only execute after an explicit tap.

If the handler uses `activeEggActivationRef.current` as the first guard, keep that guard at the very top, before looking up the egg. This ensures the lock blocks concurrent activations, while the `helloThereAnimation.start(...)` callback releases it when the full sequence ends, fails, or is cancelled.

## 5. Cancel when Search closes

Add or extend the visibility cleanup effect:

```tsx
useEffect(() => {
  if (!visible) helloThereAnimation.cancel();
}, [visible, helloThereAnimation.cancel]);
```

The controller stops native animations/timers and calls the completion callback on cancellation, so the activation lock is released. Do not also set discovery on cancellation; discovery is stored on the explicit tap.

## 6. Tuning and first device review

Most tunables are centralized near the top of `hello-there-easter-egg-animation-v2.tsx` in `TUNING`, with comments beside the Act 0–3 steps. Per-image hand scales, source landmarks and seam alignment are in `HAND_ART`; per-wave-image scales and pivot landmarks are in `WAVE_ART`.

First review on the actual phone for:

1. Whether the opaque occlusion mask exactly matches the Easter-egg row's background/radius.
2. Whether left/right hand sizes match across palms → mid → grip.
3. Whether the curious peek shows just enough goatee and retreat leaves only a hair sliver.
4. Whether the three wave-image swaps preserve the hand's apparent position.
5. Whether the wave stays beside the head and never runs into the filter chips.

Those last pixel-level adjustments depend on the actual row width, font scaling and device layout. The component is structured to tune them without changing the choreography.

Issue 1 — The search controls cut straight through the character

Most obvious around 2.5–8.5 seconds.

The search bar covers the character's hair and forehead, while the type filters and secondary filter row pass across his eyes and mouth. The labels remain readable, but the character looks like it is being rendered underneath unrelated UI elements.

This is not a simple zIndex problem. We need deliberate composition: the character should be revealed in the intended space around the Easter egg row, and the portions that are supposed to be behind the row must be masked correctly. Moving every part above the controls would simply create a different obstruction.
