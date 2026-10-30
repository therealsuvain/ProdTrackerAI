import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableRef = React.RefObject<View | null>;
type Work = {
  runId: React.MutableRefObject<number>;
  animations: React.MutableRefObject<Set<Animated.CompositeAnimation>>;
  timers: React.MutableRefObject<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>;
};
type ZAssetKind = "single" | "double" | "triple";
type AlphaBounds = { left: number; top: number; right: number; bottom: number };
type ZSpriteMeta = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  alpha: AlphaBounds;
  glyphCount: 1 | 2 | 3;
};
type ZNodeTemplate = {
  asset: ZAssetKind;
  /** Horizontal position relative to this group's centre, in row-width units. */
  xRatio: number;
  /** Vertical stagger relative to the row width. Positive values begin lower. */
  yRatio: number;
  /** Full PNG canvas width relative to the row width. */
  widthRatio: number;
  mirror?: boolean;
};
type ZGroupTemplate = { id: string; nodes: readonly ZNodeTemplate[] };
type ZNodeLayout = {
  key: string;
  source: ImageSourcePropType;
  leftOffset: number;
  top: number;
  width: number;
  height: number;
  mirror: boolean;
};
type ZGroupInstance = {
  id: string;
  nodes: ZNodeLayout[];
  startX: number;
  endX: number;
  startRotation: number;
  endRotation: number;
  delayMs: number;
  durationMs: number;
  exitY: number;
};
type FloatValues = { x: Animated.Value; y: Animated.Value; rotation: Animated.Value };

const zSingle = require("@/assets/easter-eggs/hello-there-assets/z_single.png");
const zDouble = require("@/assets/easter-eggs/hello-there-assets/z_double.png");
const zTriple = require("@/assets/easter-eggs/hello-there-assets/z_triple.png");

// Actual source dimensions and visible alpha bounds measured from the supplied PNGs.
// We use alpha bounds when positioning the first visible pixels and calculating
// the exit point, rather than treating transparent canvas margins as artwork.
const Z_SPRITES: Record<ZAssetKind, ZSpriteMeta> = {
  single: {
    source: zSingle,
    width: 788,
    height: 860,
    alpha: { left: 0, top: 0, right: 788, bottom: 860 },
    glyphCount: 1,
  },
  double: {
    source: zDouble,
    width: 1600,
    height: 1600,
    alpha: { left: 72, top: 51, right: 1478, bottom: 1559 },
    glyphCount: 2,
  },
  triple: {
    source: zTriple,
    width: 1920,
    height: 1280,
    alpha: { left: 111, top: 63, right: 1828, bottom: 1224 },
    glyphCount: 3,
  },
};

// 15 cluster templates. Each template contains 2–4 actual Z glyphs.
// z_double and z_triple are already small groups; z_single is repeated freely.
// Mirrored layouts and varied offsets prevent every run from looking identical.
const Z_GROUP_TEMPLATES: readonly ZGroupTemplate[] = [
  { id: "triple-centre", nodes: [
    { asset: "triple", xRatio: 0, yRatio: 0, widthRatio: 0.1025//0.165 

    },
  ] },
  { id: "double-centre", nodes: [
    { asset: "double", xRatio: 0, yRatio: 0, widthRatio: 0.0905// 0.145 

    },
  ] },
  { id: "double-pair", nodes: [
    { asset: "double", xRatio: -0.070, yRatio: 0, widthRatio: 0.0750//0.125 

    },
    { asset: "double", xRatio: 0.070, yRatio: 0.035, widthRatio: 0.0875,//0.125, 
      mirror: true },
  ] },
  { id: "double-single-offset", nodes: [
    { asset: "double", xRatio: -0.035, yRatio: 0.025, widthRatio: 0.0905//0.135

     },
    { asset: "single", xRatio: 0.105, yRatio: 0, widthRatio: 0.0375//0.065

     },
  ] },
  { id: "double-single", nodes: [
    { asset: "double", xRatio: -0.045, yRatio: 0.015, widthRatio: 0.0650//0.13
       },
    { asset: "single", xRatio: 0.095, yRatio: 0.055, widthRatio: 0.0375//0.065

     },
  ] },
  { id: "single-pair", nodes: [
    { asset: "single", xRatio: -0.045, yRatio: 0, widthRatio: 0.04//0.070 

    },
    { asset: "single", xRatio: 0.045, yRatio: 0.040, widthRatio: 0.04,//0.070, 
      mirror: true },
  ] },
  { id: "single-trio", nodes: [
    { asset: "single", xRatio: -0.080, yRatio: 0.035, widthRatio: 0.0325//0.060

     },
    { asset: "single", xRatio: 0, yRatio: 0, widthRatio: 0.0405//0.072 

    },
    { asset: "single", xRatio: 0.080, yRatio: 0.050, widthRatio: 0.0325,//0.060, 
      mirror: true },
  ] },
  { id: "triple-mirrored", nodes: [
    { asset: "triple", xRatio: 0, yRatio: 0, widthRatio: 0.12,//0.165, 
      mirror: true },
  ] },
  { id: "double-mirrored", nodes: [
    { asset: "double", xRatio: 0, yRatio: 0, widthRatio: 0.115//0.145
      , mirror: true },
  ] },
  { id: "double-pair-mirrored", nodes: [
    { asset: "double", xRatio: -0.070, yRatio: 0.035, widthRatio: 0.125, mirror: true },
    { asset: "double", xRatio: 0.070, yRatio: 0, widthRatio: 0.125 },
  ] },
  { id: "double-single-left-mirrored", nodes: [
    { asset: "single", xRatio: -0.105, yRatio: 0.055, widthRatio: 0.065, mirror: true },
    { asset: "double", xRatio: 0.020, yRatio: 0, widthRatio: 0.095, mirror: true },
  ] },
  { id: "double-single-right-mirrored", nodes: [
    { asset: "single", xRatio: -0.105, yRatio: 0.045, widthRatio: 0.065 },
    { asset: "double", xRatio: 0.035, yRatio: 0, widthRatio: 0.135, mirror: true },
  ] },
  { id: "diagonal-single-pair", nodes: [
    { asset: "single", xRatio: -0.045, yRatio: 0.065, widthRatio: 0.065 },
    { asset: "single", xRatio: 0.045, yRatio: 0, widthRatio: 0.075, mirror: true },
  ] },
  { id: "three-single-stagger", nodes: [
    { asset: "single", xRatio: -0.080, yRatio: 0.060, widthRatio: 0.060 },
    { asset: "single", xRatio: 0, yRatio: 0.025, widthRatio: 0.065, mirror: true },
    { asset: "single", xRatio: 0.080, yRatio: 0, widthRatio: 0.070 },
  ] },
  { id: "double-diagonal", nodes: [
    { asset: "double", xRatio: 0, yRatio: 0.035, widthRatio: 0.085 },
  ] },
];

const GROUPS_PER_RUN = 10;

// ---------------------------------------------------------------------------
// TUNING — all positions are dp or row-width ratios; durations are ms.
// Each run chooses 10 unique templates from the 15 above (about 24–30 Zs).
// ---------------------------------------------------------------------------
const TUNING = {
  // Act 3Z.1 — SOURCE / FUNNEL POSITION:
  // The groups emerge from a narrow horizontal window around this row position.
  // The value is an anchor, not a fixed final X position.
  centerXRatio: 0.70,
  centerXOffset: 0,
  // First visible artwork pixels start 2–3 dp ABOVE the row edge immediately.
  // Set to 0 to make the first alpha pixel exactly tangent to the row border.
  firstVisiblePixels: 0,
  // Start window is narrow; exit window is much wider, creating the requested \ / funnel.
  startWindowWidthRatio: 0.075,
  exitWindowWidthRatio: 0.34,
  horizontalScreenInset: 8,
  topExitOvershootPx: 12,

  // Act 3Z.2 — SIZE:
  // All values are full PNG canvas widths relative to row width.
  // The single Z is about half the size of the earlier large single-Z rendering.
  // Individual group templates can make a node slightly smaller/larger as needed.
  singleWidthRatio: 0.065,
  doubleWidthRatio: 0.135,
  tripleWidthRatio: 0.16,

  // Act 3Z.3 — GROUP RELEASE / TOTAL DURATION:
  // Each new group is released 100–150 ms after the previous group.
  // Delays are cumulative, so the gaps stay within this range (unlike adding
  // independent random offsets to index * a fixed interval).
  groupReleaseGapMinMs: 1250,
  groupReleaseGapMaxMs: 1500,

  // Act 3Z.4 — INDIVIDUAL GROUP SPEED:
  // The previous groups all travelled for almost the same 12 seconds, so they
  // stayed at nearly the same height and visually merged into one cloud.
  // Give each group its own travel duration. Faster groups rise ahead while
  // slower groups remain lower, creating distinct upward streaks. With ten
  // groups and the 100–150 ms release gaps, the overall run remains about
  // 12–15 seconds because it ends only after the slowest group exits.
  groupDurationMinMs: 10_000,
  groupDurationMaxMs: 12_500,

  // Act 3Z.4 — FLOAT:
  // Smooth upward travel; easing is deliberately gentle and continuous.
  verticalEasing: Easing.inOut(Easing.sin),
  startRotationMin: -4,
  startRotationMax: 4,
  exitRotationMin: -15,
  exitRotationMax: 15,
  // The groups drift sideways from the narrow entry window into the wider exit window.
  horizontalEasing: Easing.inOut(Easing.sin),

  // Reduced-motion users still get the effect, but in a much shorter single pass.
  reducedMotionDurationMs: 950,
  reducedMotionStaggerMs: 65,
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickRandomGroups(count: number): ZGroupTemplate[] {
  // Fisher–Yates shuffle gives each of the 15 templates an equal chance.
  // Keep trying shuffled subsets until the run contains 24–30 Z glyphs total.
  // This preserves 10 unique random groups without letting a run become sparse
  // or excessively crowded just because it happened to pick many 4-Z templates.
  const glyphCount = (group: ZGroupTemplate) =>
    group.nodes.reduce((total, node) => total + Z_SPRITES[node.asset].glyphCount, 0);

  let fallback: ZGroupTemplate[] = [];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const shuffled = [...Z_GROUP_TEMPLATES];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const candidate = shuffled.slice(0, Math.min(count, shuffled.length));
    fallback = candidate;
    const totalGlyphs = candidate.reduce((total, group) => total + glyphCount(group), 0);
    if (totalGlyphs >= 24 && totalGlyphs <= 30) return candidate;
  }

  // The template set has many valid combinations; this is only a defensive fallback.
  return fallback;
}

function waitFor(work: Work, runId: number, duration: number) {
  if (runId !== work.runId.current) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      work.timers.current.delete(timer);
      resolve(runId === work.runId.current);
    }, duration);
    work.timers.current.set(timer, resolve);
  });
}

function animateComposite(work: Work, runId: number, animation: Animated.CompositeAnimation) {
  if (runId !== work.runId.current) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    work.animations.current.add(animation);
    animation.start(({ finished }) => {
      work.animations.current.delete(animation);
      resolve(finished && runId === work.runId.current);
    });
  });
}

function stopWork(work: Work) {
  work.animations.current.forEach((animation) => animation.stop());
  work.animations.current.clear();
  work.timers.current.forEach((resolve, timer) => {
    clearTimeout(timer);
    resolve(false);
  });
  work.timers.current.clear();
}

function measureInWindow(ref: MeasurableRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return resolve(null);
      resolve({ x, y, width, height });
    });
  });
}

function buildGroupInstances(row: Rect, canvas: Rect): ZGroupInstance[] {
  const centerX = row.x + row.width * TUNING.centerXRatio + TUNING.centerXOffset;
  const chosen = pickRandomGroups(GROUPS_PER_RUN);

  // Accumulate a fresh 100–150 ms interval between consecutive group releases.
  // This is intentionally cumulative so there is no overlap or negative gap
  // caused by independently randomizing each group's absolute delay.
  let nextGroupDelayMs = 0;

  return chosen.map((template, groupIndex) => {
    const delayMs = nextGroupDelayMs;
    nextGroupDelayMs += Math.round(randomBetween(
      TUNING.groupReleaseGapMinMs,
      TUNING.groupReleaseGapMaxMs,
    ));

    // Normalize each template so its uppermost Z begins at the row edge.
    // This guarantees that the first selected group always shows a few pixels
    // immediately, even when every source node in the raw template had a y offset.
    const minNodeYRatio = Math.min(...template.nodes.map((node) => node.yRatio));
    const nodesWithBounds = template.nodes.map((node, nodeIndex) => {
      const sprite = Z_SPRITES[node.asset];
      const widthRatio = node.widthRatio || (
        node.asset === "single"
          ? TUNING.singleWidthRatio
          : node.asset === "double"
            ? TUNING.doubleWidthRatio
            : TUNING.tripleWidthRatio
      );
      const width = row.width * widthRatio;
      const scale = width / sprite.width;
      const height = sprite.height * scale;
      const leftOffset = row.width * node.xRatio - width / 2;
      const top =
        row.y -
        TUNING.firstVisiblePixels -
        sprite.alpha.top * scale +
        row.width * (node.yRatio - minNodeYRatio);
      const alphaBottom = top + sprite.alpha.bottom * scale;
      const alphaLeft = leftOffset + sprite.alpha.left * scale;
      const alphaRight = leftOffset + sprite.alpha.right * scale;

      return {
        key: `${template.id}-${nodeIndex}`,
        source: sprite.source,
        leftOffset,
        top,
        width,
        height,
        mirror: !!node.mirror,
        alphaBottom,
        alphaLeft,
        alphaRight,
      };
    });

    const minLeftOffset = Math.min(...nodesWithBounds.map((node) => node.alphaLeft));
    const maxRightOffset = Math.max(...nodesWithBounds.map((node) => node.alphaRight));
    const maxAlphaBottom = Math.max(...nodesWithBounds.map((node) => node.alphaBottom));
    const groupHalfWidthLeft = -minLeftOffset;
    const groupHalfWidthRight = maxRightOffset;

    const startWindow = row.width * TUNING.startWindowWidthRatio;
    const exitWindow = row.width * TUNING.exitWindowWidthRatio;
    const minCenter = groupHalfWidthLeft + TUNING.horizontalScreenInset;
    const maxCenter = canvas.width - groupHalfWidthRight - TUNING.horizontalScreenInset;
    const clampCenter = (value: number) => Math.max(minCenter, Math.min(maxCenter, value));

    const startCenterX = clampCenter(centerX + randomBetween(-startWindow, startWindow));
    const endCenterX = clampCenter(centerX + randomBetween(-exitWindow, exitWindow));

    return {
      id: `${template.id}-${groupIndex}`,
      nodes: nodesWithBounds.map(({ alphaBottom: _a, alphaLeft: _b, alphaRight: _c, ...node }) => node),
      startX: startCenterX - centerX,
      endX: endCenterX - centerX,
      startRotation: randomBetween(TUNING.startRotationMin, TUNING.startRotationMax),
      endRotation: randomBetween(TUNING.exitRotationMin, TUNING.exitRotationMax),
      delayMs,
      // Each group follows a unique vertical speed while preserving the
      // same smooth easing and the same row-to-top travel distance.
      durationMs: Math.round(randomBetween(
        TUNING.groupDurationMinMs,
        TUNING.groupDurationMaxMs,
      )),
      // Move until the lowest visible alpha pixel in this entire group has exited.
      exitY: -maxAlphaBottom - TUNING.topExitOvershootPx,
    };
  });
}

export type SleepingZEasterEggAnimationController = {
  start: (rowRef: MeasurableRef, canvasRef: MeasurableRef, onFinished?: () => void) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  active: boolean;
  /** Render after search content; Z groups emerge at the row top and float beyond screen top. */
  behindLayer: React.ReactNode;
};

export function useSleepingZEasterEggAnimation(): SleepingZEasterEggAnimationController {
  const [active, setActive] = useState(false);
  const [groups, setGroups] = useState<ZGroupInstance[]>([]);
  const [anchor, setAnchor] = useState<Rect | null>(null);

  const runId = useRef(0);
  const running = useRef(false);
  const finishedCallback = useRef<(() => void) | undefined>(undefined);
  const animations = useRef<Set<Animated.CompositeAnimation>>(new Set());
  const timers = useRef<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>(new Map());
  const work: Work = { runId, animations, timers };

  // Ten independent group timelines. All child Zs in a group share the same
  // smooth path, but each group has its own stagger, horizontal exit and rotation.
  const floatValues = useRef<FloatValues[]>(
    Array.from({ length: GROUPS_PER_RUN }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotation: new Animated.Value(0),
    })),
  ).current;

  const resetScene = useCallback(() => {
    setActive(false);
    setGroups([]);
    setAnchor(null);
    // Keep animated values untouched during dismissal; the next start resets them
    // before rendering the new groups, preventing a one-frame flash.
  }, []);

  const finish = useCallback((id: number) => {
    if (id !== runId.current) return;
    running.current = false;
    resetScene();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
  }, [resetScene]);

  const cancel = useCallback(() => {
    if (!running.current) return;
    runId.current += 1;
    stopWork(work);
    running.current = false;
    resetScene();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
    // work contains stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetScene]);

  useEffect(() => () => {
    runId.current += 1;
    stopWork(work);
    running.current = false;
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
  }, []);

  const start = async (
    rowRef: MeasurableRef,
    canvasRef: MeasurableRef,
    onFinished?: () => void,
  ): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    finishedCallback.current = onFinished;
    const id = ++runId.current;

    try {
      const [rowWindow, canvasWindow, reduceMotion] = await Promise.all([
        measureInWindow(rowRef),
        measureInWindow(canvasRef),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);
      if (id !== runId.current) return false;
      if (!rowWindow || !canvasWindow) {
        console.warn("[Sleeping Z] Could not measure row/canvas; skipping animation.");
        finish(id);
        return false;
      }

      const localRow: Rect = {
        x: rowWindow.x - canvasWindow.x,
        y: rowWindow.y - canvasWindow.y,
        width: rowWindow.width,
        height: rowWindow.height,
      };
      const localCanvas: Rect = { x: 0, y: 0, width: canvasWindow.width, height: canvasWindow.height };
      const nextGroups = buildGroupInstances(localRow, localCanvas);

      // Reset the ten native-driver timelines before displaying any Z pixels.
      floatValues.forEach((values, index) => {
        values.x.setValue(nextGroups[index]?.startX ?? 0);
        values.y.setValue(0);
        values.rotation.setValue(nextGroups[index]?.startRotation ?? 0);
      });
      setAnchor(localRow);
      setGroups(nextGroups);
      setActive(true);

      // Only one short layout wait. The first Z already has 2.5 dp visible above
      // the row at its initial position, so the user sees an immediate response.
      if (!(await waitFor(work, id, 16))) return false;

      const animationsForGroups = nextGroups.map((group, index) => {
        const values = floatValues[index];
        const duration = reduceMotion ? TUNING.reducedMotionDurationMs : group.durationMs;
        const delay = reduceMotion ? index * TUNING.reducedMotionStaggerMs : group.delayMs;
        const targetX = reduceMotion ? group.endX * 0.25 : group.endX;
        const targetRotation = reduceMotion ? 0 : group.endRotation;

        return Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(values.y, {
              toValue: group.exitY,
              duration,
              easing: TUNING.verticalEasing,
              useNativeDriver: true,
            }),
            Animated.timing(values.x, {
              toValue: targetX,
              duration,
              easing: TUNING.horizontalEasing,
              useNativeDriver: true,
            }),
            Animated.timing(values.rotation, {
              toValue: targetRotation,
              duration,
              easing: TUNING.verticalEasing,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      // Promise resolves when the last of the ten selected groups has fully
      // crossed the screen top (based on real alpha bounds, not canvas padding).
      if (!(await animateComposite(work, id, Animated.parallel(animationsForGroups)))) return false;
      finish(id);
      return true;
    } catch (error) {
      console.warn("[Sleeping Z] Animation failed; restoring search UI.", error);
      finish(id);
      return false;
    } finally {
      if (id === runId.current && running.current) finish(id);
    }
  };

  const zFrames = anchor
    ? groups.flatMap((group, groupIndex) => {
        const values = floatValues[groupIndex];
        const rotation = values.rotation.interpolate({
          inputRange: [-25, 25],
          outputRange: ["-25deg", "25deg"],
          extrapolate: "clamp",
        });
        return group.nodes.map((node) => (
          <Animated.Image
            key={`${group.id}-${node.key}`}
            source={node.source}
            resizeMode="contain"
            fadeDuration={0}
            style={{
              position: "absolute",
              left:
                anchor.x +
                anchor.width * TUNING.centerXRatio +
                TUNING.centerXOffset +
                node.leftOffset,
              top: node.top,
              width: node.width,
              height: node.height,
              opacity: 1,
              transform: [
                { translateX: values.x },
                { translateY: values.y },
                { rotate: rotation },
                { scaleX: node.mirror ? -1 : 1 },
              ],
            }}
          />
        ));
      })
    : null;

  const behindLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.behindLayer]}
    >
      {active && anchor && (
        <View
          pointerEvents="none"
          style={[styles.clip, { height: Math.max(0, anchor.y) }]}
        >
          {zFrames}
        </View>
      )}
    </View>
  );

  return {
    start,
    cancel,
    isRunning: () => running.current,
    active,
    behindLayer,
  };
}

const styles = StyleSheet.create({
  // Match Hello There's root overlay layer so Zs paint above filters and headers.
  // Android needs elevation > searchContentLayer's elevation: 1.
  behindLayer: {
    zIndex: 20,
    elevation: 20,
    overflow: "visible",
  },
  clip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
});
