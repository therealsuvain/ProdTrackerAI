import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableRef = React.RefObject<View | null>;
type Work = {
  runId: React.MutableRefObject<number>;
  animations: React.MutableRefObject<Set<Animated.CompositeAnimation>>;
  timers: React.MutableRefObject<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>;
};

// All three layers were supplied on the same 1600 × 1600 canvas.
// Their alpha bounds meet at the wrist, so they MUST share one render size
// and one top-left origin. Do not size the hand/finger independently.
const armWithoutHand = require("@/assets/easter-eggs/hello-there-assets/cut_arm_without_hand_smooth.png");
const handWithoutIndex = require("@/assets/easter-eggs/hello-there-assets/cut_hand_without_index_smooth.png");
const indexFinger = require("@/assets/easter-eggs/hello-there-assets/cut_index_alone_smooth.png");
// Retained as a visual reference; the independently animated index is composed
// from handWithoutIndex + indexFinger instead.
const completePointingHand = require("@/assets/easter-eggs/hello-there-assets/cut_hand_alone_smooth.png");
void completePointingHand;

const ART_CANVAS = { width: 1600, height: 1600 };

// Actual alpha bounds measured from the supplied PNGs (source pixels).
// Keeping these here makes the visible-hand sizing understandable/tunable.
const ART_ALPHA = {
  arm: { left: 583, top: 461, right: 994, bottom: 1600 },
  hand: { left: 680, top: 216, right: 993, bottom: 461 },
  index: { left: 816, top: 78, right: 867, bottom: 266 },
};

// The independent index rotates around its base joint, which is where its
// alpha silhouette meets the palm. These coordinates are source-image pixels.
const INDEX_PIVOT = {
  x: (ART_ALPHA.index.left + ART_ALPHA.index.right) / 2,
  y: ART_ALPHA.index.bottom,
};

// ---------------------------------------------------------------------------
// TUNING — positions are dp; durations are milliseconds; angles are degrees.
// Every image uses one common 1600 × 1600 coordinate frame.
// ---------------------------------------------------------------------------
const TUNING = {
  // Act 2A.1 — ARM POSITION:
  // Desired horizontal centre of the visible palm, measured from the row.
  // Increase to move the speaker right; decrease to move it left.
  armCenterXRatio: 0.70,
  armXOffset: 0,

  // Act 2A.1 — VISIBLE HAND SCALE:
  // This is the VISIBLE palm/finger width as a fraction of the row width.
  // The actual PNG canvas is scaled up to compensate for its transparent margins.
  // At a 400 dp row width, 0.075 gives a visible hand about 30 dp wide.
  handVisibleWidthRatio: 0.1,

  // Act 2A.1 — VERTICAL PLACEMENT:
  // How much of the sleeve/hand composition sits above the row before clipping.
  armVisibleHeight: 120,
  armRiseDistance: 132,
  armRiseMs: 430,
  armRetreatMs: 360,
  armSettleMs: 100,

  // Act 2A.2 — INDEX FINGER PIVOT:
  // Fine source-pixel corrections if the rotating finger appears detached.
  // These are offsets from the measured base joint, not from the PNG centre.
  indexPivotOffsetX: 0,
  indexPivotOffsetY: 0,

  // Act 2A.3 — FINGER SWAY:
  // Main angles create the deliberate left/right "no, no" gesture.
  // Jitter adds a small irregular secondary movement at each end.
  fingerLeftAngle: -23,
  fingerRightAngle: 23,
  fingerJitterDegrees: 2.5,
  fingerMainMoveMs: 210,
  fingerJitterMs: 55,
  fingerSettleMs: 130,
  fingerSwayCycles: 3,

  // Act 2A.4 — SPEECH BUBBLE:
  // The bubble sits to the right of the visible sleeve, near the row's top edge.
  bubbleWidth: 120,
  bubbleHeight: 40,
  bubbleRightGap: 10,
  bubbleTopGap: 30,
  bubbleRightInset: 8,
  bubbleEnterMs: 190,
  bubbleExitMs: 160,
  bubbleDelayMs: 180,

  // Act 2A.5 — REDUCED-MOTION FALLBACK.
  reducedMotionHoldMs: 650,
};

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

function animateTiming(
  work: Work,
  runId: number,
  value: Animated.Value,
  toValue: number,
  duration: number,
  easing: (value: number) => number = Easing.inOut(Easing.cubic),
): Promise<boolean> {
  if (runId !== work.runId.current) return Promise.resolve(false);
  return new Promise((resolve) => {
    const animation = Animated.timing(value, {
      toValue,
      duration: Math.max(0, duration),
      easing,
      useNativeDriver: true,
    });
    work.animations.current.add(animation);
    animation.start(({ finished }) => {
      work.animations.current.delete(animation);
      resolve(finished && runId === work.runId.current);
    });
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

function stopWork(work: Work) {
  work.animations.current.forEach((animation) => animation.stop());
  work.animations.current.clear();
  work.timers.current.forEach((resolve, timer) => {
    clearTimeout(timer);
    resolve(false);
  });
  work.timers.current.clear();
}

export type NoNoNoAnimationController = {
  start: (rowRef: MeasurableRef, canvasRef: MeasurableRef, onFinished?: () => void) => Promise<boolean>;
  cancel: () => void;
  isRunning: () => boolean;
  active: boolean;
  /** Render after normal search content; visible sleeve/hand is clipped at row top. */
  behindLayer: React.ReactNode;
  /** Render after behindLayer so the speech bubble sits above the search controls. */
  foregroundLayer: React.ReactNode;
};

export function useNoNoNoEasterEggAnimation(): NoNoNoAnimationController {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [canvas, setCanvas] = useState<Rect | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const runId = useRef(0);
  const running = useRef(false);
  const finishedCallback = useRef<(() => void) | undefined>(undefined);
  const animations = useRef<Set<Animated.CompositeAnimation>>(new Set());
  const timers = useRef<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>(new Map());
  const work: Work = { runId, animations, timers };

  const armY = useRef(new Animated.Value(TUNING.armRiseDistance)).current;
  const fingerRotation = useRef(new Animated.Value(0)).current;
  const bubbleProgress = useRef(new Animated.Value(0)).current;

  const resetVisualState = useCallback(() => {
    setActive(false);
    setAnchor(null);
    setCanvas(null);
    setBubbleVisible(false);
    // Do not reset Animated.Values during dismissal. start() initializes them
    // before the next visible run, preventing a one-frame snap during unmount.
  }, []);

  const finish = useCallback((id: number) => {
    if (id !== runId.current) return;
    running.current = false;
    resetVisualState();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
  }, [resetVisualState]);

  const cancel = useCallback(() => {
    if (!running.current) return;
    runId.current += 1;
    stopWork(work);
    running.current = false;
    resetVisualState();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
    // work contains stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetVisualState]);

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
        console.warn("[No No No] Could not measure the row/canvas; skipping animation.");
        finish(id);
        return false;
      }

      const localRow: Rect = {
        x: rowWindow.x - canvasWindow.x,
        y: rowWindow.y - canvasWindow.y,
        width: rowWindow.width,
        height: rowWindow.height,
      };
      const localCanvas: Rect = {
        x: 0,
        y: 0,
        width: canvasWindow.width,
        height: canvasWindow.height,
      };

      // The hand's visible alpha width (313 source px) defines the scale.
      // All images then use the same 1600 px canvas scale and exact origin.
      const pixelsPerDp = TUNING.handVisibleWidthRatio * localRow.width /
        (ART_ALPHA.hand.right - ART_ALPHA.hand.left);
      const artSize = ART_CANVAS.width * pixelsPerDp;
      const handCenterSourceX = (ART_ALPHA.hand.left + ART_ALPHA.hand.right) / 2;
      const armRightReachDp = (ART_ALPHA.arm.right - handCenterSourceX) * pixelsPerDp;

      // Keep the full speech bubble to the right of the visible sleeve.
      // The clamp is based on the visible arm edge, not the transparent canvas edge.
      const desiredArmCenterX =
        localRow.x + localRow.width * TUNING.armCenterXRatio + TUNING.armXOffset;
      const maxArmCenterX =
        localCanvas.width -
        TUNING.bubbleWidth -
        TUNING.bubbleRightInset -
        TUNING.bubbleRightGap -
        armRightReachDp;
      const armCenterX = Math.max(
        artSize * 0.5,
        Math.min(desiredArmCenterX, maxArmCenterX),
      );
      const artLeft = armCenterX - handCenterSourceX * pixelsPerDp;
      const artTop = localRow.y - TUNING.armVisibleHeight;

      // Initialize values before revealing the root overlay.
      armY.setValue(TUNING.armRiseDistance);
      fingerRotation.setValue(0);
      bubbleProgress.setValue(0);
      setAnchor(localRow);
      setCanvas(localCanvas);
      setBubbleVisible(false);
      setActive(true);
      if (!(await waitFor(work, id, 16))) return false;

      if (reduceMotion) {
        armY.setValue(0);
        setBubbleVisible(true);
        bubbleProgress.setValue(1);
        if (!(await waitFor(work, id, TUNING.reducedMotionHoldMs))) return false;
        finish(id);
        return true;
      }

      // Act 2A.1 — Arm/hand emergence. The sleeve remains stationary after this.
      if (!(await animateTiming(work, id, armY, 0, TUNING.armRiseMs, Easing.out(Easing.cubic)))) return false;
      if (!(await waitFor(work, id, TUNING.armSettleMs))) return false;

      // Act 2A.2 — Speech bubble appears shortly after the hand emerges.
      const bubbleEnter = (async () => {
        if (!(await waitFor(work, id, TUNING.bubbleDelayMs))) return false;
        setBubbleVisible(true);
        return animateTiming(work, id, bubbleProgress, 1, TUNING.bubbleEnterMs, Easing.out(Easing.cubic));
      })();

      // Act 2A.3 — Finger-only sway. The sleeve and palm remain still.
      const swaySteps: Animated.CompositeAnimation[] = [];
      const left = TUNING.fingerLeftAngle;
      const right = TUNING.fingerRightAngle;
      const jitter = TUNING.fingerJitterDegrees;
      for (let cycle = 0; cycle < TUNING.fingerSwayCycles; cycle += 1) {
        swaySteps.push(
          Animated.timing(fingerRotation, {
            toValue: left,
            duration: TUNING.fingerMainMoveMs,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fingerRotation, {
            toValue: left - jitter,
            duration: TUNING.fingerJitterMs,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(fingerRotation, {
            toValue: right,
            duration: TUNING.fingerMainMoveMs + 25,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fingerRotation, {
            toValue: right + jitter,
            duration: TUNING.fingerJitterMs,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(fingerRotation, {
            toValue: left + jitter * 0.5,
            duration: TUNING.fingerMainMoveMs,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        );
      }
      swaySteps.push(Animated.timing(fingerRotation, {
        toValue: 0,
        duration: TUNING.fingerSettleMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }));

      if (!(await animateComposite(work, id, Animated.sequence(swaySteps)))) return false;
      if (!(await bubbleEnter)) return false;
      if (!(await animateTiming(work, id, bubbleProgress, 0, TUNING.bubbleExitMs, Easing.in(Easing.cubic)))) return false;
      setBubbleVisible(false);

      // Act 2A.4 — Arm retreats after the finger has returned to neutral.
      if (!(await animateTiming(work, id, armY, TUNING.armRiseDistance, TUNING.armRetreatMs, Easing.in(Easing.cubic)))) return false;
      finish(id);
      return true;
    } catch (error) {
      console.warn("[No No No] Animation failed; restoring search UI.", error);
      finish(id);
      return false;
    } finally {
      if (id === runId.current && running.current) finish(id);
    }
  };

  const pixelsPerDp = anchor
    ? (TUNING.handVisibleWidthRatio * anchor.width) /
      (ART_ALPHA.hand.right - ART_ALPHA.hand.left)
    : 0;
  const artSize = pixelsPerDp * ART_CANVAS.width;
  const handCenterSourceX = (ART_ALPHA.hand.left + ART_ALPHA.hand.right) / 2;
  const desiredArmCenterX = anchor
    ? anchor.x + anchor.width * TUNING.armCenterXRatio + TUNING.armXOffset
    : 0;
  const armRightReachDp = (ART_ALPHA.arm.right - handCenterSourceX) * pixelsPerDp;
  const maxArmCenterX = canvas
    ? canvas.width - TUNING.bubbleWidth - TUNING.bubbleRightInset - TUNING.bubbleRightGap - armRightReachDp
    : desiredArmCenterX;
  const armCenterX = Math.max(artSize * 0.5, Math.min(desiredArmCenterX, maxArmCenterX));
  const artLeft = anchor ? armCenterX - handCenterSourceX * pixelsPerDp : 0;
  const artTop = anchor ? anchor.y - TUNING.armVisibleHeight : 0;

  const fingerRotate = fingerRotation.interpolate({
    inputRange: [-45, 45],
    outputRange: ["-45deg", "45deg"],
    extrapolate: "clamp",
  });

  const pivotX = INDEX_PIVOT.x * pixelsPerDp + TUNING.indexPivotOffsetX;
  const pivotY = INDEX_PIVOT.y * pixelsPerDp + TUNING.indexPivotOffsetY;
  const indexPivotLeft = pivotX - 0.5;
  const indexPivotTop = pivotY  + 1.333;
  const bubbleLeft = anchor && canvas
    ? Math.min(
        artLeft + ART_ALPHA.arm.right * pixelsPerDp + TUNING.bubbleRightGap,
        canvas.width - TUNING.bubbleWidth - TUNING.bubbleRightInset,
      )
    : 0;
  const bubbleTop = anchor
    ? anchor.y - TUNING.bubbleHeight - TUNING.bubbleTopGap
    : 0;

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
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: artLeft,
              top: artTop,
              width: artSize,
              height: artSize,
              transform: [{ translateY: armY }],
            }}
          >
            {/* These 3 images share one coordinate space and identical scale. */}
            <Image
              source={armWithoutHand}
              resizeMode="stretch"
              fadeDuration={0}
              style={{ position: "absolute", left: 0, top: 0, width: artSize, height: artSize }}
            />
            <Image
              source={handWithoutIndex}
              resizeMode="stretch"
              fadeDuration={0}
              style={{ position: "absolute", left: 0, top: 0, width: artSize, height: artSize }}
            />
            {/*
              Rotate only the isolated index around its measured base joint.
              The wrapper's centre is placed exactly on the source-space pivot.
            */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: indexPivotLeft,
                top: indexPivotTop,
                width: 1,
                height: 1,
                transform: [{ rotate: fingerRotate }],
              }}
            >
              <Image
                source={indexFinger}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  left: -pivotX,
                  top: -pivotY,
                  width: artSize,
                  height: artSize,
                }}
              />
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );

  const bubbleScale = bubbleProgress.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const bubbleOpacity = bubbleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const bubbleTranslateY = bubbleProgress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  const foregroundLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.foregroundLayer]}
    >
      {active && anchor && bubbleVisible && (
        <Animated.View
          style={{
            position: "absolute",
            left: bubbleLeft,
            top: bubbleTop,
            width: TUNING.bubbleWidth,
            opacity: bubbleOpacity,
            transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }],
          }}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>Patience is a virtue</Text>
          </View>
          <View style={styles.bubbleTail} />
        </Animated.View>
      )}
    </View>
  );

  return {
    start,
    cancel,
    isRunning: () => running.current,
    active,
    behindLayer,
    foregroundLayer,
  };
}

const styles = StyleSheet.create({
  // Match the Hello There overlay's stacking level. The search content layer
  // has elevation: 1, so Android needs an explicit higher elevation here.
  behindLayer: {
    zIndex: 20,
    elevation: 20,
    overflow: "visible",
  },
  foregroundLayer: {
    zIndex: 30,
    elevation: 30,
    overflow: "visible",
  },
  clip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  bubble: {
    minHeight: TUNING.bubbleHeight,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#FFF8E9",
    borderWidth: 1,
    borderColor: "#E8D8BA",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  bubbleText: {
    color: "#3B2A1D",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  bubbleTail: {
    width: 0,
    height: 0,
    marginLeft: 16,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFF8E9",
  },
});
