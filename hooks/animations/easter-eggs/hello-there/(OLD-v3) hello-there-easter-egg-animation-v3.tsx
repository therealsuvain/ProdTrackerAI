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

/*
 * Hello There — V3
 *
 * Architecture:
 *   1. Render `behindLayer` AFTER the normal search content so character art
 *      is not hidden by chip labels or section headers.
 *   2. The character art is clipped at the TOP EDGE of the Easter-egg row.
 *      This prevents any PNG pixels from appearing below the row without
 *      placing an opaque mask over other search results.
 *   3. Render `foregroundLayer` AFTER content as well. It contains only the
 *      gripping fingers clipped to the row plus the speech bubble.
 *   4. `start()` measures the tapped row relative to the shared canvas. The
 *      character remains independent of the SectionList's stacking context.
 *
 * All listed assets are loaded from @/assets/easter-eggs. They are intentionally
 * not modified or copied by this component.
 */

// ---------------------------------------------------------------------------
// Static assets. Keep these literal requires so Metro can resolve them.
// ---------------------------------------------------------------------------
const editedHeadCurious = require("@/assets/easter-eggs/hello-there-assets/head-curious.png");
const editedHeadNeutral = require("@/assets/easter-eggs/hello-there-assets/head-neutral.png");
const editedHeadSmile1 = require("@/assets/easter-eggs/hello-there-assets/head-smile-1.png");
const editedHeadSmile2 = require("@/assets/easter-eggs/hello-there-assets/head-smile-2.png");
const headWinking = require("@/assets/easter-eggs/hello-there-assets/head-winking.png");

const wallGrippedLeft = require("@/assets/easter-eggs/hello-there-assets/wall_gripped_left_only.png");
const wallGrippedRight = require("@/assets/easter-eggs/hello-there-assets/wall_gripped_right_only.png");
const wallMidLeft = require("@/assets/easter-eggs/hello-there-assets/wall_mid_transition_left_only.png");
const wallMidRight = require("@/assets/easter-eggs/hello-there-assets/wall_mid_transition_right_only.png");
const wallPalmsLeft = require("@/assets/easter-eggs/hello-there-assets/wall_palms_up_left_only.png");
const wallPalmsRight = require("@/assets/easter-eggs/hello-there-assets/wall_palms_up_right_only.png");

// Note: wave__arm_with_shoulder.png is intentionally unused in this sequence.
const waveFlat1 = require("@/assets/easter-eggs/hello-there-assets/wave_flat_2.png");
const waveFlat2 = require("@/assets/easter-eggs/hello-there-assets/wave_flat_2.png");
// Legacy three-frame option kept for reference; V3 uses one image throughout the wave.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const waveFlat3 = require("@/assets/easter-eggs/hello-there-assets/wave_flat_3.png");
void waveFlat3; // Keep the asset resolvable for the commented legacy three-frame option.

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type Side = "left" | "right";
type HeadPose = "curious" | "neutral" | "smile1" | "smile2" | "wink";
type HandPose = "hidden" | "palms" | "mid" | "grip";
type WavePose = "entry" | "wave";
type MeasurableRef = React.RefObject<View | null>;
type AnimatorWork = {
  runId: React.MutableRefObject<number>;
  animations: React.MutableRefObject<Set<Animated.CompositeAnimation>>;
  timers: React.MutableRefObject<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>;
};

type HandArt = {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  /** Visible hand landmarks in source-image pixels. */
  handLeft: number;
  handRight: number;
  /** Source y coordinate of the top seam that aligns to the row edge. */
  rowEdgeY?: number;
};

type WaveArt = {
  source: ImageSourcePropType;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  /** Pivot landmarks in source-image pixels. Tune these to keep the wrist steady. */
  pivotX: number;
  pivotY: number;
  /** Fine offsets in dp for pose-to-pose registration. */
  imageOffsetX: number;
  imageOffsetY: number;
};

// ---------------------------------------------------------------------------
// Coordinate calibration and animation tuning.
// Image dimensions/bounds were inspected from the supplied assets. The scales
// target the hand itself, not the full image canvas. These are first-pass
// calibrated values; fine-tune them after running on-device.
// ---------------------------------------------------------------------------
const HEAD_SOURCE_WIDTH = 1390;
const HEAD_SOURCE_HEIGHT = 1494;

const HAND_ART: Record<Exclude<HandPose, "hidden">, Record<Side, HandArt>> = {
  palms: {
    left: {
      source: wallPalmsLeft,
      sourceWidth: 701,
      sourceHeight: 1600,
      // Act 0.1 SCALE: visible palm/finger width ≈ 35 dp. Change the scale
      // here if the palms look too large/small against the face.
      scale: 0.073,
      handLeft: 80,
      handRight: 560,
    },
    right: {
      source: wallPalmsRight,
      sourceWidth: 696,
      sourceHeight: 1600,
      scale: 0.073,
      handLeft: 120,
      handRight: 600,
    },
  },
  mid: {
    left: {
      source: wallMidLeft,
      sourceWidth: 718,
      sourceHeight: 1600,
      // Act 0.2 SCALE: calibrated against the closed hand, not the long sleeve.
      scale: 0.080,
      handLeft: 175,
      handRight: 615,
    },
    right: {
      source: wallMidRight,
      sourceWidth: 817,
      sourceHeight: 1600,
      scale: 0.075,
      handLeft: 80,
      handRight: 550,
    },
  },
  grip: {
    left: {
      source: wallGrippedLeft,
      sourceWidth: 942,
      sourceHeight: 1120,
      // Act 0.3 SCALE: the visible gripping hand is ≈ 35 dp wide.
      scale: 0.050,
      handLeft: 125,
      handRight: 825,
      rowEdgeY: 661,//361,
    },
    right: {
      source: wallGrippedRight,
      sourceWidth: 874,
      sourceHeight: 1120,
      scale: 0.0493,
      handLeft: 140,
      handRight: 850,
      rowEdgeY: 647,//347,
    },
  },
};

/*
 * LEGACY THREE-FRAME CONFIGURATION (V2) — intentionally retained for reference.
 * The old cycle switched flat2/flat3 repeatedly, requiring different image
 * pivots and tiny waits after each swap. That caused the visible mid-wave pause.
 * Restore this block only if you later want to compare the old choreography.
 *
 * const LEGACY_WAVE_ART: Record<"flat1" | "flat2" | "flat3", WaveArt> = {
 *   flat1: { source: waveFlat1, sourceWidth: 1940, sourceHeight: 1120,
 *     scale: 0.100, pivotX: 1000, pivotY: 560, imageOffsetX: 0, imageOffsetY: 0 },
 *   flat2: { source: waveFlat2, sourceWidth: 1600, sourceHeight: 1600,
 *     scale: 0.120, pivotX: 650, pivotY: 500, imageOffsetX: 0, imageOffsetY: 0 },
 *   flat3: { source: waveFlat3, sourceWidth: 1600, sourceHeight: 1600,
 *     scale: 0.120, pivotX: 650, pivotY: 500, imageOffsetX: 0, imageOffsetY: 0 },
 * };
 */

// Act 2.3 DEPLOYMENT/RETREAT ART:
// This is used only while the arm emerges from behind the row and returns.
const WAVE_ENTRY_ART: WaveArt = {
  source: waveFlat1,
  sourceWidth: 1600,//1940,
  sourceHeight: 1600,//1120,
  scale: 0.115,//0.100,
  // Pivot is the shoulder/wrist origin that should stay against the row edge.
  pivotX: 400,//1000,
  pivotY: 750,//560,
  imageOffsetX: 0,
  imageOffsetY: 0,
};

// Act 2.4 WAVE ART:
// One single PNG is kept mounted for every wave repetition, so there are no
// mid-wave source swaps or pose-specific pivot corrections.
const WAVE_CYCLE_ART: WaveArt = {
  source: waveFlat2,
  sourceWidth: 1600,
  sourceHeight: 1600,
  // SCALE: +15% from the 0.12 value you tested. Tune between 0.132 and 0.144.
  scale: 0.115,//0.138,
  // These image-space coordinates place the wrist/arm origin at the rotation box centre.
  // If the arm rotates around the wrong point, tune pivotX/pivotY first.
  pivotX: 400,//650,
  pivotY: 750,//500,
  imageOffsetX: 0,
  imageOffsetY: 0,
};

const TUNING = {
  // Act 0.1 POSITIONS: these assets begin below the row and emerge upward.
  palmsBaseTopOffset: 15,
  midBaseTopOffset: 15,//1,
  palmsRiseY: -55,
  midHiddenY: -35,
  palmsRiseMs: 360,
  palmsHoldMs: 250,
  midDropMs: 175,//100,

  // Act 0.3 POSITION: aligns the gripping sleeve seam to the top row edge.
  // If a robe strip appears above/below the row, tune rowEdgeY in HAND_ART.
  rowCornerRadius: 14,

  // Act 0.4 HEAD SCALE: half the earlier size. Height follows the common head canvas.
  // Lower the ratio / min / max to shrink further; change together to keep responsive sizing.
  headWidthRatio: 0.27,
  headMinWidth: 75,
  headMaxWidth: 104,

  // Act 0.4 HEAD POSITION: anchor at 70% of the row width (about 30% in from the right).
  // Increase avatarCenterXRatio to shift the entire character right.
  avatarCenterXRatio: 0.70,
  headXOffset: 0,

  // Act 0.1 HAND POSITION: locate both visible hand landmarks around the smaller head.
  // Increase to spread the hands outward; decrease to move them closer to the face.
  handSpreadHeadRatio: 0.75,//0.70,

  // HEAD TOP POSITION: +5 dp lowers the base head image and hides its shoulders more naturally.
  headTopExtraY: 5,
  // Act 0.5: how much top hair remains visible during the hidden expression swap.
  // Increase to leave a larger sliver; set to 0 to fully hide the head.
  headSliverVisiblePx: 5,

  // Act 0.4 CURIOUS PEEK: the peak is based on the full head canvas, then retreat quickly.
  curiousPeakVisibleRatio: 0.68,
  curiousPeekMs: 1000,
  curiousRetreatMs: 420,

  // Act 1.2 PULL-UP SPRING: lower stiffness slows the pull-up; damping limits overshoot.
  headSpringStiffness: 55,
  headSpringDamping: 16,
  headSpringMass: 1.0,

  // Act 2.2 RELEASE: this is the gripping hand lifting before the mid-transition image hides.
  rightGripLiftY: -12,
  rightMidRevealY: -32,
  rightHandHideMs: 180,

  // Act 2.3 POSITION: arm pivot is based on the head centre plus this fraction of head width.
  // Increase to move the waving arm farther toward the avatar's screen-right shoulder.
  wavePivotHeadOffsetRatio: 0.28,
  waveRotationBox: 140,//640,
  waveHiddenPivotY: 182,
  // -6 was the better value in your latest tuning. More negative = higher active wrist.
  waveActivePivotY: -20,

  // Act 2.3 / 2.5 SPEED: entry/exit rotate the transition PNG to/from about 45 degrees.
  waveEntryAngle: -45,
  waveRaisedAngle: -50,//-70,
  waveEntryMs: 280,
  waveSteepenMs: 150,

  // Act 2.4 WAVE SPEED/ANGLES: single image, no swaps in the repeated wave.
  // Angle path: raised (-70) -> right (-40) -> down (-20) -> right (-40) -> raised (-70).
  waveRightAngle: -35,//-40,
  waveDownAngle: -15,//-20,
  waveRightMs: 140,
  waveDownMs: 120,
  waveReturnMs: 120,
  waveResetMs: 100,
  // Slight Y movement during the down/up arc makes the gesture feel less mechanical.
  waveDownOffsetY: 10,
  waveRepetitions: 3,

  // Act 2.4 SPEECH BUBBLE POSITION: preserve the existing size/timing; anchor near the head.
  bubbleHeadOffsetRatio: 0.55,
  bubbleAboveHeadOffset: 44,
  bubbleRightInset: 8,
  bubbleWidth: 132,
  bubbleEnterMs: 180,
  bubbleExitMs: 160,
  bubbleHoldMs: 280,

  // Act 3.1 WINK: the wink is held for 400 ms, then returns to smile1.
  winkHoldMs: 700,//400,

  // Act 3.2 RETREAT: duration for the head to lower behind the row.
  headRetreatMs: 450,
  handsRetreatMs: 350,

  // Act 3.2 SPEED:
// Controls how long the mid-transition hand remains visible while moving
// from the gripping pose towards the palms pose.
// Increase for a slower transition; decrease for a faster one.
retreatMidBridgeMs: 150,

// Act 3.2 POSITION:
// Tiny corrections if the mid asset's visible hand doesn't align perfectly
// with the gripping pose. Positive values move it down; negative values up.
retreatMidStartNudgeLeft: 0,
retreatMidStartNudgeRight: 0,

};

const HEAD_ASSETS: Record<HeadPose, ImageSourcePropType> = {
  curious: editedHeadCurious,
  neutral: editedHeadNeutral,
  smile1: editedHeadSmile1,
  smile2: editedHeadSmile2,
  wink: headWinking,
};

// Keeping every head expression mounted prevents a source decode/load gap at pose changes.
const HEAD_POSE_ORDER: HeadPose[] = ["curious", "neutral", "smile1", "smile2", "wink"];
const HAND_POSE_ORDER: Exclude<HandPose, "hidden">[] = [
  "palms",
  "mid",
  "grip",
];

const WAVE_BOX_SIZE = TUNING.waveRotationBox;
const WAVE_BOX_CENTER = WAVE_BOX_SIZE / 2;

function measureInWindow(ref: MeasurableRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) {
      resolve(null);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

function animateTiming(
  work: AnimatorWork,
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

function animateComposite(
  work: AnimatorWork,
  runId: number,
  animation: Animated.CompositeAnimation,
): Promise<boolean> {
  if (runId !== work.runId.current) return Promise.resolve(false);

  return new Promise((resolve) => {
    work.animations.current.add(animation);
    animation.start(({ finished }) => {
      work.animations.current.delete(animation);
      resolve(finished && runId === work.runId.current);
    });
  });
}

function animateSpring(
  work: AnimatorWork,
  runId: number,
  value: Animated.Value,
  toValue: number,
): Promise<boolean> {
  if (runId !== work.runId.current) return Promise.resolve(false);

  return new Promise((resolve) => {
    const animation = Animated.spring(value, {
      toValue,
      stiffness: TUNING.headSpringStiffness,
      damping: TUNING.headSpringDamping,
      mass: TUNING.headSpringMass,
      overshootClamping: false,
      useNativeDriver: true,
    });

    work.animations.current.add(animation);
    animation.start(({ finished }) => {
      work.animations.current.delete(animation);
      resolve(finished && runId === work.runId.current);
    });
  });
}

function waitFor(work: AnimatorWork, runId: number, duration: number): Promise<boolean> {
  if (runId !== work.runId.current) return Promise.resolve(false);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      work.timers.current.delete(timer);
      resolve(runId === work.runId.current);
    }, duration);
    work.timers.current.set(timer, resolve);
  });
}

function stopAllWork(work: AnimatorWork) {
  work.animations.current.forEach((animation) => animation.stop());
  work.animations.current.clear();

  work.timers.current.forEach((resolve, timer) => {
    clearTimeout(timer);
    resolve(false);
  });
  work.timers.current.clear();
}

function headSizeForRow(row: Rect) {
  // Act 0.4 SCALE: tune ratio/min/max to change the head's size relative to row.
  const width = Math.max(
    TUNING.headMinWidth,
    Math.min(TUNING.headMaxWidth, row.width * TUNING.headWidthRatio),
  );
  return { width, height: width * (HEAD_SOURCE_HEIGHT / HEAD_SOURCE_WIDTH) };
}

function handArtFor(pose: Exclude<HandPose, "hidden">, side: Side): HandArt {
  return HAND_ART[pose][side];
}

function handFrame(row: Rect, side: Side, pose: Exclude<HandPose, "hidden">) {
  const art = handArtFor(pose, side);
  const width = art.sourceWidth * art.scale;
  const height = art.sourceHeight * art.scale;
  // Act 0.1 POSITION: derive target landmarks from the face, not row corners.
  // The asset's transparent margins are already accounted for by handLeft/handRight.
  const headSize = headSizeForRow(row);
  const avatarCenterX =
    row.x + row.width * TUNING.avatarCenterXRatio + TUNING.headXOffset;
  const handSpread = headSize.width * TUNING.handSpreadHeadRatio;
  const targetHandLeft = avatarCenterX - handSpread;
  const targetHandRight = avatarCenterX + handSpread;

  // X alignment matches the visible hand landmarks, not the PNG canvas bounds.
  const left =
    side === "left"
      ? targetHandLeft - art.handLeft * art.scale
      : targetHandRight - art.handRight * art.scale;

  let top: number;
  if (pose === "palms") {
    // Act 0.1 POSITIONS: palm images begin below the row, behind the occluder.
    top = row.y + TUNING.palmsBaseTopOffset;
  } else if (pose === "mid") {
    // Act 0.2 POSITIONS: compensate for the mid-asset transparent padding.
    top = row.y + TUNING.midBaseTopOffset;
  } else {
    // Act 0.3 POSITIONS: align the robe seam to the row's top edge.
    top = row.y - (art.rowEdgeY ?? 0) * art.scale;
  }

  return { left, top, width, height, art };
}

export type HelloThereEasterEggAnimationController = {
  /** Start from a row Pressable ref, measured relative to the shared canvas. */
  start: (rowRef: MeasurableRef, canvasRef: MeasurableRef, onFinished?: () => void) => Promise<boolean>;
  /** Stop all animation/timers and release the caller's activation lock. */
  cancel: () => void;
  isRunning: () => boolean;
  /** Reactive animation state; use to temporarily disable SectionList scrolling. */
  active: boolean;
  /** Render AFTER search content; clipped to the region above the row's top edge. */
  behindLayer: React.ReactNode;
  /** Render after search content. Contains only gripping fingers/bubble in front. */
  foregroundLayer: React.ReactNode;
};

export function useHelloThereEasterEggAnimation(
  _occlusionColor: string, // Kept in the signature for compatibility; V3 uses clipping instead of a painted mask.
): HelloThereEasterEggAnimationController {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [headPose, setHeadPose] = useState<HeadPose | null>(null);
  const [leftPose, setLeftPose] = useState<HandPose>("hidden");
  const [rightPose, setRightPose] = useState<HandPose>("hidden");
  const [wavePose, setWavePose] = useState<WavePose | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const runId = useRef(0);
  const running = useRef(false);
  const finishedCallback = useRef<(() => void) | undefined>(undefined);
  const animations = useRef<Set<Animated.CompositeAnimation>>(new Set());
  const timers = useRef<Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>>(new Map());
  const work: AnimatorWork = { runId, animations, timers };

  // All movement uses transform values, so the native animation driver can
  // keep frame-to-frame motion smooth even if React briefly does other work.
  const headY = useRef(new Animated.Value(0)).current;
  const leftHandY = useRef(new Animated.Value(0)).current;
  const rightHandY = useRef(new Animated.Value(0)).current;
  // Act 3.2 — Independent movement values for the mid-transition images.
// These allow the mid pose to enter at the grip's position without moving
// the currently visible gripping images for one frame.
const leftRetreatMidY = useRef(new Animated.Value(0)).current;
const rightRetreatMidY = useRef(new Animated.Value(0)).current;

const [retreatMidBridgeActive, setRetreatMidBridgeActive] =
  useState(false);
  const waveRotation = useRef(new Animated.Value(0)).current;
  const wavePivotY = useRef(new Animated.Value(TUNING.waveHiddenPivotY)).current;
  const bubbleProgress = useRef(new Animated.Value(0)).current;

  const resetScene = useCallback(() => {
    setActive(false);
    setAnchor(null);
    setHeadPose(null);
    setLeftPose("hidden");
    setRightPose("hidden");
    setWavePose(null);
    setBubbleVisible(false);
    setRetreatMidBridgeActive(false);
    // IMPORTANT: don't reset headY here. It can jump back to 0 while the
    // overlay is still mounted for a frame, making the whole head flash at exit.
    // The next start() positions it below the row before activating the overlay.
    leftHandY.setValue(0);
    rightHandY.setValue(0);
    waveRotation.setValue(0);
    wavePivotY.setValue(TUNING.waveHiddenPivotY);
    bubbleProgress.setValue(0);
  }, [leftHandY, rightHandY, waveRotation, wavePivotY, bubbleProgress]);

  const finishCurrentRun = useCallback((id: number) => {
    if (id !== runId.current) return;
    running.current = false;
    resetScene();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
  }, [resetScene]);

  const cancel = useCallback(() => {
    if (!running.current) return;
    // Increment the ID first so callbacks from stopped native animations cannot
    // finish a newer run or release a lock owned by another activation.
    runId.current += 1;
    stopAllWork(work);
    running.current = false;
    resetScene();
    const callback = finishedCallback.current;
    finishedCallback.current = undefined;
    callback?.();
  // `work` contains stable refs, so it deliberately does not change per render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetScene]);

  useEffect(() => {
    return () => {
      // On unmount, don't set state; do stop native work and release the parent lock.
      runId.current += 1;
      stopAllWork(work);
      running.current = false;
      const callback = finishedCallback.current;
      finishedCallback.current = undefined;
      callback?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const [rowWindowRect, canvasWindowRect, reduceMotion] = await Promise.all([
        measureInWindow(rowRef),
        measureInWindow(canvasRef),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
      ]);

      if (id !== runId.current) return false;
      if (!rowWindowRect || !canvasWindowRect) {
        console.warn("[Hello There] Could not measure the row/canvas; skipping animation.");
        finishCurrentRun(id);
        return false;
      }

      const localRow: Rect = {
        x: rowWindowRect.x - canvasWindowRect.x,
        y: rowWindowRect.y - canvasWindowRect.y,
        width: rowWindowRect.width,
        height: rowWindowRect.height,
      };
      const headSize = headSizeForRow(localRow);
      // The base top includes headTopExtraY, so compensate to leave exactly the
      // configured hair sliver visible during the hidden curious -> neutral swap.
      const headSliverY =
        headSize.height - TUNING.headTopExtraY - TUNING.headSliverVisiblePx;

      // Act 0 reset: all artwork begins behind the row; hands rise first.
      setAnchor(localRow);
      // Put the head fully below the clip boundary BEFORE revealing the overlay.
      headY.setValue(headSize.height);
      setActive(true);
      setHeadPose("curious");
      setLeftPose("palms");
      setRightPose("palms");
      setWavePose(null);
      setBubbleVisible(false);
      // headY was initialized before setActive above to prevent a one-frame flash.
      leftHandY.setValue(0);
      rightHandY.setValue(0);
      waveRotation.setValue(0);
      wavePivotY.setValue(TUNING.waveHiddenPivotY);
      bubbleProgress.setValue(0);

      // Let the two overlay layers mount before the first native animation starts.
      if (!(await waitFor(work, id, 32))) return false;

      // Reduced motion keeps the surprise discoverable but avoids the long
      // multi-stage travel and repeated waving sequence.
      if (reduceMotion) {
        setLeftPose("grip");
        setRightPose("grip");
        leftHandY.setValue(0);
        rightHandY.setValue(0);
        setHeadPose("smile1");
        headY.setValue(0);
        setBubbleVisible(true);
        bubbleProgress.setValue(1);
        if (!(await waitFor(work, id, 750))) return false;
        finishCurrentRun(id);
        return true;
      }

      // ───────────────────────────────────────────────────────────────────
      // ACT 0.1 — PALMS EMERGE
      // Positions: hands rise from underneath the row. Adjust palmsBaseTopOffset
      // and palmsRiseY if the palms are too high/low or more than ~80% is visible.
      // Speed: lower palmsRiseMs for a faster grab; increase for a slower one.
      // ───────────────────────────────────────────────────────────────────
      if (!(await Promise.all([
        animateTiming(work, id, leftHandY, TUNING.palmsRiseY, TUNING.palmsRiseMs, Easing.out(Easing.cubic)),
        animateTiming(work, id, rightHandY, TUNING.palmsRiseY, TUNING.palmsRiseMs, Easing.out(Easing.cubic)),
      ])).every(Boolean)) return false;
      if (!(await waitFor(work, id, TUNING.palmsHoldMs))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 0.2 — MID-TRANSITION, THEN QUICK DROP TO THE ROW EDGE
      // The separate left/right source images have different canvas widths.
      // Hand landmarks and scales are independently aligned in HAND_ART.
      // ───────────────────────────────────────────────────────────────────
      setLeftPose("mid");
      setRightPose("mid");
      if (!(await waitFor(work, id, 20))) return false;
      if (!(await Promise.all([
        animateTiming(work, id, leftHandY, TUNING.midHiddenY, TUNING.midDropMs, Easing.in(Easing.cubic)),
        animateTiming(work, id, rightHandY, TUNING.midHiddenY, TUNING.midDropMs, Easing.in(Easing.cubic)),
      ])).every(Boolean)) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 0.3 — GRIP BOTH SIDES
      // The artwork switches while the mid-transition hands are behind the row.
      // The front copy is clipped to the row, so only fingers appear in front.
      // The rowEdgeY values in HAND_ART line the robe seam up with the row edge.
      // ───────────────────────────────────────────────────────────────────
      setLeftPose("grip");
      setRightPose("grip");
      leftHandY.setValue(0);
      rightHandY.setValue(0);
      if (!(await waitFor(work, id, 80))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 0.4 — CURIOUS PEEK, THEN QUICK RETREAT
      // Position: HEAD is behind the row; the row covers everything below y=0.
      // Increase curiousPeakVisibleRatio to reveal more chin/goatee; reduce it
      // if too much face is exposed. Curious retreat is deliberately quicker.
      // ───────────────────────────────────────────────────────────────────
      headY.setValue(headSliverY); // Only a thin top-hair sliver is visible.
      const curiousPeakY = headSize.height * (1 - TUNING.curiousPeakVisibleRatio);
      if (!(await animateTiming(work, id, headY, curiousPeakY, TUNING.curiousPeekMs, Easing.out(Easing.cubic)))) return false;
      if (!(await animateTiming(work, id, headY, headSliverY, TUNING.curiousRetreatMs, Easing.in(Easing.cubic)))) return false;

      // ACT 1.1 — Swap head art while only the hair sliver is exposed. All head
      // poses share one fixed render canvas and dimensions, so the swap is hidden.
      setHeadPose("neutral");
      if (!(await waitFor(work, id, 20))) return false;

      // ACT 1.2 — The true pull-up: quicker than the curious peek but smoother
      // than the quick retreat. Spring gives the head a slight natural settle.
      if (!(await animateSpring(work, id, headY, 0))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.1 — FACIAL EXPRESSION TRANSITION
      // `smile2` is deliberately held for 200 ms before `smile1` takes over.
      // ───────────────────────────────────────────────────────────────────
      setHeadPose("smile2");
      if (!(await waitFor(work, id, 200))) return false;
      setHeadPose("smile1");

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.2 — RIGHT HAND RELEASES; LEFT HAND KEEPS ITS GRIP
      // Speed: rightGripLiftY movement takes 150 ms. Adjust this Y offset if the
      // right fingers lift too far or the source switch becomes noticeable.
      // The mid pose is set to rightMidRevealY to line up its visible hand with
      // the raised grip asset; it then descends behind the row.
      // ───────────────────────────────────────────────────────────────────
      if (!(await animateTiming(work, id, rightHandY, TUNING.rightGripLiftY, 150, Easing.out(Easing.cubic)))) return false;
      setRightPose("mid");
      rightHandY.setValue(TUNING.rightMidRevealY);
      if (!(await waitFor(work, id, 20))) return false;
      if (!(await animateTiming(work, id, rightHandY, TUNING.midHiddenY, TUNING.rightHandHideMs, Easing.in(Easing.cubic)))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.3 — DEPLOY THE ARM, THEN SWITCH ONCE TO THE WAVE IMAGE
      // The transition art rotates out from behind the row. At the 45-degree
      // point, the waving image replaces it once. The wrist pivot is anchored
      // relative to the smaller head; adjust wavePivotHeadOffsetRatio if needed.
      // ───────────────────────────────────────────────────────────────────
      setWavePose("entry");
      waveRotation.setValue(0);
      wavePivotY.setValue(TUNING.waveHiddenPivotY);
      if (!(await Promise.all([
        animateTiming(work, id, waveRotation, TUNING.waveEntryAngle, TUNING.waveEntryMs, Easing.out(Easing.cubic)),
        animateTiming(work, id, wavePivotY, TUNING.waveActivePivotY, TUNING.waveEntryMs, Easing.out(Easing.cubic)),
      ])).every(Boolean)) return false;

      // One deliberate image change at the transition point. WAVE_CYCLE_ART
      // then stays mounted for all wave cycles; no image swaps occur mid-wave.
      setWavePose("wave");
      wavePivotY.setValue(TUNING.waveActivePivotY);
      if (!(await animateTiming(work, id, waveRotation, TUNING.waveRaisedAngle, TUNING.waveSteepenMs, Easing.inOut(Easing.cubic)))) return false;

      // The bubble begins shortly after the greeting arm is deployed.
      const bubbleEnter = (async () => {
        if (!(await waitFor(work, id, 80))) return false;
        setBubbleVisible(true);
        return animateTiming(work, id, bubbleProgress, 1, TUNING.bubbleEnterMs, Easing.out(Easing.cubic));
      })();

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.4 — THREE CONTINUOUS WAVE CYCLES USING ONE PNG
      // There are no React pose changes, source swaps or per-cycle waits here.
      // Each cycle is native-driver animation only, to remove the old mid-wave pause.
      // ───────────────────────────────────────────────────────────────────
      for (let cycle = 0; cycle < TUNING.waveRepetitions; cycle += 1) {
        // Each cycle is one native-driver sequence, so there is no JS round-trip
        // between the swing, dip, return and settle phases.
        const waveCycle = Animated.sequence([
          Animated.timing(waveRotation, {
            toValue: TUNING.waveRightAngle,
            duration: TUNING.waveRightMs,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(waveRotation, {
              toValue: TUNING.waveDownAngle,
              duration: TUNING.waveDownMs,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(wavePivotY, {
              toValue: TUNING.waveActivePivotY + TUNING.waveDownOffsetY,
              duration: TUNING.waveDownMs,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(waveRotation, {
              toValue: TUNING.waveRightAngle,
              duration: TUNING.waveReturnMs,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(wavePivotY, {
              toValue: TUNING.waveActivePivotY,
              duration: TUNING.waveReturnMs,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(waveRotation, {
            toValue: TUNING.waveRaisedAngle,
            duration: TUNING.waveResetMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);
        if (!(await animateComposite(work, id, waveCycle))) return false;
      }

      if (!(await bubbleEnter)) return false;
      if (!(await waitFor(work, id, TUNING.bubbleHoldMs))) return false;
      if (!(await animateTiming(work, id, bubbleProgress, 0, TUNING.bubbleExitMs, Easing.in(Easing.cubic)))) return false;
      setBubbleVisible(false);

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.5 — REVERSE THE ARM DEPLOYMENT
      // Keep the single waving image until it returns to the same 45-degree angle,
      // then switch once back to the entry image and lower it behind the row.
      // This mirrors Act 2.3 and avoids the old three-image return jitter.
      // ───────────────────────────────────────────────────────────────────
      if (!(await animateTiming(work, id, waveRotation, TUNING.waveEntryAngle, TUNING.waveSteepenMs, Easing.inOut(Easing.cubic)))) return false;
      setWavePose("entry");
      wavePivotY.setValue(TUNING.waveActivePivotY);
      if (!(await Promise.all([
        animateTiming(work, id, waveRotation, 0, TUNING.waveEntryMs, Easing.in(Easing.cubic)),
        animateTiming(work, id, wavePivotY, TUNING.waveHiddenPivotY, TUNING.waveEntryMs, Easing.in(Easing.cubic)),
      ])).every(Boolean)) return false;
      setWavePose(null);

      // Right mid-transition appears hidden, rises to the same release frame,
      // then the gripping image is restored and lowered into its exact seam.
      setRightPose("mid");
      rightHandY.setValue(TUNING.midHiddenY);
      if (!(await animateTiming(work, id, rightHandY, TUNING.rightMidRevealY, TUNING.rightHandHideMs, Easing.out(Easing.cubic)))) return false;
      setRightPose("grip");
      rightHandY.setValue(TUNING.rightGripLiftY);
      if (!(await waitFor(work, id, 20))) return false;
      if (!(await animateTiming(work, id, rightHandY, 0, 150, Easing.out(Easing.cubic)))) return false;

      // Act 2.6 — the smile-2 expression rests briefly after the arm is back.
      setHeadPose("smile2");
      if (!(await waitFor(work, id, 180))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 3.1 — WINK FOR TUNING.winkHoldMs, THEN RETURN TO SMILE-1
      // The wink source has a different raw canvas size; all head poses render
      // to one common width/height to prevent the face from jumping on swap.
      // ───────────────────────────────────────────────────────────────────
      setHeadPose("smile2");
      if (!(await waitFor(work, id, 24))) return false;
      setHeadPose("wink");
      if (!(await waitFor(work, id, TUNING.winkHoldMs))) return false;
      setHeadPose("smile2");
      if (!(await waitFor(work, id, 35))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 3.2 — RETREAT. Head descends at the same time as the hands reverse
      // Act 0: grip → hidden mid → palms visible → palms lower behind the row.
      // ───────────────────────────────────────────────────────────────────
      /* setLeftPose("mid");
      setRightPose("mid");
      leftHandY.setValue(TUNING.midHiddenY);
      rightHandY.setValue(TUNING.midHiddenY);
      const headRetreat = animateTiming(
        work,
        id,
        headY,
        headSize.height, // fully below the clipping boundary; no final hair sliver
        TUNING.headRetreatMs,
        Easing.in(Easing.cubic),
      );

      // Reverse Act 0.2 + 0.1 run as one concurrent arm sequence. The head is
      // descending during BOTH steps, not only during the first 100 ms.
      const handsRetreat = (async () => {
        // Mid-transition rises back to the pose where Act 0 swapped to palms.
        if (!(await Promise.all([
          animateTiming(work, id, leftHandY, TUNING.palmsRiseY, 100, Easing.out(Easing.cubic)),
          animateTiming(work, id, rightHandY, TUNING.palmsRiseY, 100, Easing.out(Easing.cubic)),
        ])).every(Boolean)) return false;

        // Reverse Act 0.1: palms replace mid at the same visible hand landmarks.
        setLeftPose("palms");
        setRightPose("palms");
        if (!(await waitFor(work, id, 18))) return false;

        // Act 3.2 SPEED: increase 350 ms for a slower retreat under the row.
        if (!(await Promise.all([
          animateTiming(work, id, leftHandY, 0, TUNING.handsRetreatMs, Easing.in(Easing.cubic)),
          animateTiming(work, id, rightHandY, 0, TUNING.handsRetreatMs, Easing.in(Easing.cubic)),
        ])).every(Boolean)) return false;
        setLeftPose("hidden");
        setRightPose("hidden");
        return true;
      })();

      if (!(await Promise.all([headRetreat, handsRetreat])).every(Boolean)) return false;
      setHeadPose(null);
      finishCurrentRun(id);
      return true; */
      // ───────────────────────────────────────────────────────────────────
// ACT 3.2 — RETREAT: GRIP → MID → PALMS → HIDDEN
//
// The head and hands retreat concurrently.
// The mid pose bridges the gripping and palms poses visibly.
// ───────────────────────────────────────────────────────────────────

// Prepare the hidden mid-pose values BEFORE switching the visible pose.
// This avoids moving the gripping images with the mid-transition offset.
leftRetreatMidY.setValue(midPoseExitStartY("left"));
rightRetreatMidY.setValue(midPoseExitStartY("right"));

setRetreatMidBridgeActive(true);
setLeftPose("mid");
setRightPose("mid");

const headRetreat = animateTiming(
  work,
  id,
  headY,
  headSize.height,
  TUNING.headRetreatMs,
  Easing.in(Easing.cubic),
);

const handsRetreat = (async () => {
  // Act 3.2.1:
  // The visible mid-transition hands move continuously from their aligned
  // grip position towards the same upper position used by the palms pose.
  if (
    !(
      await Promise.all([
        animateTiming(
          work,
          id,
          leftRetreatMidY,
          TUNING.palmsRiseY,
          TUNING.retreatMidBridgeMs,
          Easing.inOut(Easing.cubic),
        ),
        animateTiming(
          work,
          id,
          rightRetreatMidY,
          TUNING.palmsRiseY,
          TUNING.retreatMidBridgeMs,
          Easing.inOut(Easing.cubic),
        ),
      ])
    ).every(Boolean)
  ) {
    return false;
  }

  // Act 3.2.2:
  // Prepare the palms values while the mid pose still uses its own values.
  // The old images therefore cannot jump when the values are updated.
  leftHandY.setValue(TUNING.palmsRiseY);
  rightHandY.setValue(TUNING.palmsRiseY);

  // Switch both sides together at the transition endpoint.
  setRetreatMidBridgeActive(false);
  setLeftPose("palms");
  setRightPose("palms");

  // Allow the pose-state change to render before starting the descent.
  if (!(await waitFor(work, id, 16))) return false;

  // Act 3.2.3:
  // Lower both palms behind the row. The head is already descending.
  if (
    !(
      await Promise.all([
        animateTiming(
          work,
          id,
          leftHandY,
          0,
          TUNING.handsRetreatMs,
          Easing.in(Easing.cubic),
        ),
        animateTiming(
          work,
          id,
          rightHandY,
          0,
          TUNING.handsRetreatMs,
          Easing.in(Easing.cubic),
        ),
      ])
    ).every(Boolean)
  ) {
    return false;
  }

  setLeftPose("hidden");
  setRightPose("hidden");
  return true;
})();

if (!(await Promise.all([headRetreat, handsRetreat])).every(Boolean)) {
  return false;
}

setHeadPose(null);
finishCurrentRun(id);
return true;
    } catch (error) {
      console.warn("[Hello There] Animation failed; restoring the search UI.", error);
      finishCurrentRun(id);
      return false;
    } finally {
      // This handles ordinary completion/failure only. Cancellation increments
      // runId first and releases the lock in cancel(), so it cannot double-finish.
      if (id === runId.current && running.current) finishCurrentRun(id);
    }
  };

  const waveRotationDegrees = waveRotation.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  const headSize = anchor ? headSizeForRow(anchor) : null;
  const headLeft = anchor && headSize
    ? anchor.x +
      anchor.width * TUNING.avatarCenterXRatio -
      headSize.width / 2 +
      TUNING.headXOffset
    : 0;
  // Act 0.4 POSITION: +5 dp lowers the face to hide the shoulders behind the row.
  const headTop = anchor && headSize
    ? anchor.y - headSize.height + TUNING.headTopExtraY
    : 0;

 /*  const renderHandBehind = (side: Side, pose: HandPose) => {
    if (!anchor || pose === "hidden") return null;
    const frame = handFrame(anchor, side, pose);
    const y = side === "left" ? leftHandY : rightHandY;
    return (
      <Animated.Image
        key={`behind-${side}-${pose}`}
        source={frame.art.source}
        resizeMode="stretch"
        fadeDuration={0}
        style={[
          styles.sprite,
          {
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            transform: [{ translateY: y }],
          },
        ]}
      />
    );
  };
 */
function midPoseExitStartY(side: Side) {
  const grip = HAND_ART.grip[side];

  // Act 3.2 POSITION:
  // Align the mid-transition image's row seam to the gripping image's seam.
  // This compensates for differences in canvas size and transparent padding.
  const seamAlignment =
    -(grip.rowEdgeY ?? 0) * grip.scale -
    TUNING.midBaseTopOffset;

  // Adjust the corresponding TUNING nudge if the visible hand itself
  // still sits slightly too high or low after the swap.
  const nudge =
    side === "left"
      ? TUNING.retreatMidStartNudgeLeft
      : TUNING.retreatMidStartNudgeRight;

  return seamAlignment + nudge;
}
  const renderHandBehind = (side: Side, activePose: HandPose) => {
  if (!anchor) return null;

  // Keep all three PNGs mounted during the animation.
  // Switching poses changes opacity without introducing an image-load gap.
  return HAND_POSE_ORDER.map((pose) => {
    const frame = handFrame(anchor, side, pose);

    const normalY = side === "left" ? leftHandY : rightHandY;

    // Act 3.2:
    // Use independent values for the mid-transition pose during the exit.
    // The gripping pose keeps its original Y value until it is replaced.
    const y =
      pose === "mid" && retreatMidBridgeActive
        ? side === "left"
          ? leftRetreatMidY
          : rightRetreatMidY
        : normalY;

    return (
      <Animated.Image
        key={`behind-${side}-${pose}`}
        source={frame.art.source}
        resizeMode="stretch"
        fadeDuration={0}
        style={[
          styles.sprite,
          {
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,

            // Only the currently selected pose is visible.
            opacity: activePose === pose ? 1 : 0,

            transform: [{ translateY: y }],
          },
        ]}
      />
    );
  });
};


  const renderHandFront = (side: Side, pose: HandPose) => {
    if (!anchor || pose !== "grip") return null;
    const frame = handFrame(anchor, side, pose);
    const y = side === "left" ? leftHandY : rightHandY;
    return (
      <Animated.Image
        key={`front-${side}-${pose}`}
        source={frame.art.source}
        resizeMode="stretch"
        fadeDuration={0}
        style={[
          styles.sprite,
          {
            left: frame.left - anchor.x,
            top: frame.top - anchor.y,
            width: frame.width,
            height: frame.height,
            transform: [{ translateY: y }],
          },
        ]}
      />
    );
  };

  const behindLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, styles.behindLayer]}
    >
      {active && anchor && (
        // This is a transparent clipping viewport, NOT an opaque mask.
        // Its bottom edge is exactly the row's top edge, so no portrait/arm
        // pixels can leak below the row and other search-result rows stay visible.
        <View
          pointerEvents="none"
          style={[
            styles.characterClip,
            { height: Math.max(0, anchor.y) },
          ]}
        >
          {renderHandBehind("left", leftPose)}
          {renderHandBehind("right", rightPose)}

          {headSize && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.waveRotationBox,
                {
                  // Act 2.3 POSITION: anchor to the avatar's screen-right shoulder.
                  left:
                    anchor.x +
                    anchor.width * TUNING.avatarCenterXRatio +
                    headSize.width * TUNING.wavePivotHeadOffsetRatio -
                    WAVE_BOX_CENTER,
                  top: anchor.y - WAVE_BOX_CENTER,
                  // Mount both images from the beginning of the animation so the
                  // entry-to-wave switch never waits for a newly-mounted PNG.
                  opacity: wavePose === null ? 0 : 1,
                  transform: [
                    { rotate: waveRotationDegrees },
                    { translateY: wavePivotY },
                  ],
                },
              ]}
            >
              <Image
                source={WAVE_ENTRY_ART.source}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  left: WAVE_BOX_CENTER - WAVE_ENTRY_ART.pivotX * WAVE_ENTRY_ART.scale + WAVE_ENTRY_ART.imageOffsetX,
                  top: WAVE_BOX_CENTER - WAVE_ENTRY_ART.pivotY * WAVE_ENTRY_ART.scale + WAVE_ENTRY_ART.imageOffsetY,
                  width: WAVE_ENTRY_ART.sourceWidth * WAVE_ENTRY_ART.scale,
                  height: WAVE_ENTRY_ART.sourceHeight * WAVE_ENTRY_ART.scale,
                  opacity: wavePose === "entry" ? 1 : 0,
                }}
              />
              <Image
                source={WAVE_CYCLE_ART.source}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  left: WAVE_BOX_CENTER - WAVE_CYCLE_ART.pivotX * WAVE_CYCLE_ART.scale + WAVE_CYCLE_ART.imageOffsetX,
                  top: WAVE_BOX_CENTER - WAVE_CYCLE_ART.pivotY * WAVE_CYCLE_ART.scale + WAVE_CYCLE_ART.imageOffsetY,
                  width: WAVE_CYCLE_ART.sourceWidth * WAVE_CYCLE_ART.scale,
                  height: WAVE_CYCLE_ART.sourceHeight * WAVE_CYCLE_ART.scale,
                  opacity: /* wavePose === "wave" ? 1 : */ 0,
                }}
              />
            </Animated.View>
          )}

          {headSize &&
            HEAD_POSE_ORDER.map((pose) => (
              <Animated.Image
                key={`head-${pose}`}
                source={HEAD_ASSETS[pose]}
                resizeMode="stretch"
                fadeDuration={0}
                style={[
                  styles.sprite,
                  {
                    left: headLeft,
                    top: headTop,
                    width: headSize.width,
                    height: headSize.height,
                    // Keep every expression mounted; opacity switches poses with no load gap.
                    opacity: headPose === pose ? 1 : 0,
                    transform: [{ translateY: headY }],
                  },
                ]}
              />
            ))}
        </View>
      )}
    </View>
  );

  const bubbleScale = bubbleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.78, 1],
  });
  const bubbleOpacity = bubbleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const bubbleTranslateY = bubbleProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 0],
  });

  const foregroundLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, styles.foregroundLayer]}
    >
      {active && anchor && (
        <>
          {/* Clip only the gripping fingers to the row. The sleeves remain behind it. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: anchor.x,
              top: anchor.y,
              width: anchor.width,
              height: anchor.height,
              borderRadius: TUNING.rowCornerRadius,
              overflow: "hidden",
            }}
          >
            {renderHandFront("left", leftPose)}
            {renderHandFront("right", rightPose)}
          </View>

          {bubbleVisible && headSize && (
            <Animated.View
              style={{
                position: "absolute",
                // Act 2.4 POSITION: keep the bubble tied to the smaller head and inside the row's right boundary.
                left: Math.min(
                  headLeft + headSize.width * TUNING.bubbleHeadOffsetRatio,
                  anchor.x + anchor.width - TUNING.bubbleWidth - TUNING.bubbleRightInset,
                ),
                top: headTop - TUNING.bubbleAboveHeadOffset,
                width: TUNING.bubbleWidth,
                opacity: bubbleOpacity,
                transform: [{ translateY: bubbleTranslateY }, { scale: bubbleScale }],
              }}
            >
              <View style={styles.speechBubble}>
                <Text style={styles.speechBubbleText}>HELLO THERE!</Text>
              </View>
              <View style={styles.speechBubbleTail} />
            </Animated.View>
          )}
          {/* ─────────────────────────────────────────────────────────────
    ACT 2.4 — WAVING ARM FOREGROUND LAYER

    The wave must appear in front of the head AND speech bubble.
    Its parent clips everything below the row's top edge, so the
    arm still appears to emerge from behind the row.

    POSITION:
    Keep this pivot identical to the one used by the entry arm.
    Do not tune the pivot separately in this module.
    ───────────────────────────────────────────────────────────── */}
<View
  pointerEvents="none"
  style={[
    styles.characterClip,
    { height: Math.max(0, anchor.y) },
  ]}
>
  <Animated.View
    pointerEvents="none"
    style={[
      styles.waveRotationBox,
      {
        // Keep the same avatar-relative pivot as the entry arm.
        left:
          anchor.x +
          anchor.width * TUNING.avatarCenterXRatio +
          headSize!.width * TUNING.wavePivotHeadOffsetRatio -
          WAVE_BOX_CENTER,
        top: anchor.y - WAVE_BOX_CENTER,

        // Keep this view mounted before the wave starts.
        // This avoids mounting the foreground arm mid-animation.
        opacity: wavePose === "wave" ? 1 : 0,

        // Share the exact same motion values as the entry/exit arm.
        transform: [
          { rotate: waveRotationDegrees },
          { translateY: wavePivotY },
        ],
      },
    ]}
  >
    <Image
      source={WAVE_CYCLE_ART.source}
      resizeMode="stretch"
      fadeDuration={0}
      style={{
        position: "absolute",
        left:
          WAVE_BOX_CENTER -
          WAVE_CYCLE_ART.pivotX * WAVE_CYCLE_ART.scale +
          WAVE_CYCLE_ART.imageOffsetX,
        top:
          WAVE_BOX_CENTER -
          WAVE_CYCLE_ART.pivotY * WAVE_CYCLE_ART.scale +
          WAVE_CYCLE_ART.imageOffsetY,
        width: WAVE_CYCLE_ART.sourceWidth * WAVE_CYCLE_ART.scale,
        height: WAVE_CYCLE_ART.sourceHeight * WAVE_CYCLE_ART.scale,
      }}
    />
  </Animated.View>
</View>
        </>
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
  sprite: {
    position: "absolute",
  },
  behindLayer: {
    // Render after searchContentLayer so art is above chip labels/section headers.
    // characterClip bounds the art to y < row.y, so the card and later results remain visible.
    zIndex: 20,
    elevation: 20,
    overflow: "visible",
  },
  characterClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    overflow: "hidden",
  },
  foregroundLayer: {
    zIndex: 30,
    elevation: 30,
    overflow: "visible",
  },
  waveRotationBox: {
    position: "absolute",
    width: WAVE_BOX_SIZE,
    height: WAVE_BOX_SIZE,
    overflow: "visible",
  },
  speechBubble: {
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DDD5",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  speechBubbleText: {
    color: "#35251D",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
  speechBubbleTail: {
    position: "absolute",
    left: 20,
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: "#FFFFFF",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E3DDD5",
    transform: [{ rotate: "45deg" }],
  },
});
