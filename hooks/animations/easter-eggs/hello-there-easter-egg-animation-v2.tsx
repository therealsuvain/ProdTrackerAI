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
 * Hello There — V2
 *
 * Architecture:
 *   1. `behindLayer` must be rendered BEFORE the normal search content.
 *   2. `foregroundLayer` must be rendered AFTER the normal search content.
 *   3. `start()` measures the tapped Easter-egg row relative to the shared
 *      animation canvas. The character is therefore not a descendant of the
 *      SectionList row and cannot be hidden by its clipping/staking context.
 *   4. An opaque row-shaped occluder is drawn in the behind layer. The actual
 *      row is then drawn on top of that occluder, while gripping fingers are
 *      duplicated into a clipped foreground layer. This makes the character
 *      look as though it is physically behind the row.
 *
 * All listed assets are loaded from @/assets/easter-eggs. They are intentionally
 * not modified or copied by this component.
 */

// ---------------------------------------------------------------------------
// Static assets. Keep these literal requires so Metro can resolve them.
// ---------------------------------------------------------------------------
const editedHeadCurious = require("@/assets/easter-eggs/edited-head-curious.png");
const editedHeadNeutral = require("@/assets/easter-eggs/edited-head-neutral.png");
const editedHeadSmile1 = require("@/assets/easter-eggs/edited-head-smile-1.png");
const editedHeadSmile2 = require("@/assets/easter-eggs/edited-head-smile-2.png");
const headWinking = require("@/assets/easter-eggs/head_winking.png");

const wallGrippedLeft = require("@/assets/easter-eggs/wall_gripped_left_only.png");
const wallGrippedRight = require("@/assets/easter-eggs/wall_gripped_right_only.png");
const wallMidLeft = require("@/assets/easter-eggs/wall_mid_transition_left_only.png");
const wallMidRight = require("@/assets/easter-eggs/wall_mid_transition_right_only.png");
const wallPalmsLeft = require("@/assets/easter-eggs/wall_palms_up_left_only.png");
const wallPalmsRight = require("@/assets/easter-eggs/wall_palms_up_right_only.png");

// Note: wave__arm_with_shoulder.png is intentionally unused in this sequence.
const waveFlat1 = require("@/assets/easter-eggs/wave__flat_1.png");
const waveFlat2 = require("@/assets/easter-eggs/wave_flat_2.png");
const waveFlat3 = require("@/assets/easter-eggs/wave_flat_3.png");

type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type Side = "left" | "right";
type HeadPose = "curious" | "neutral" | "smile1" | "smile2" | "wink";
type HandPose = "hidden" | "palms" | "mid" | "grip";
type WavePose = "flat1" | "flat2" | "flat3";
type MeasurableRef = React.RefObject<View | null>;
type AnimatorWork = {
  runId: React.MutableRefObject<number>;
  animations: React.MutableRefObject<Set<Animated.CompositeAnimation>>;
  timers: React.MutableRefObject<
    Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>
  >;
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
      scale: 0.08,
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
      scale: 0.05,
      handLeft: 125,
      handRight: 825,
      rowEdgeY: 361,
    },
    right: {
      source: wallGrippedRight,
      sourceWidth: 874,
      sourceHeight: 1120,
      scale: 0.0493,
      handLeft: 140,
      handRight: 850,
      rowEdgeY: 347,
    },
  },
};

const WAVE_ART: Record<WavePose, WaveArt> = {
  flat1: {
    source: waveFlat1,
    sourceWidth: 1940,
    sourceHeight: 1120,
    // Act 2.3 SCALE: calibrated to the visible hand width (~35 dp), not the
    // long horizontal sleeve. If it looks larger than the gripping hands, tune here.
    scale: 0.1,
    pivotX: 1000,
    pivotY: 560,
    imageOffsetX: 0,
    imageOffsetY: 0,
  },
  flat2: {
    source: waveFlat2,
    sourceWidth: 1600,
    sourceHeight: 1600,
    scale: 0.1, //0.064,
    pivotX: 450,
    pivotY: 1100,
    imageOffsetX: 0,
    imageOffsetY: 0,
  },
  flat3: {
    source: waveFlat3,
    sourceWidth: 1600,
    sourceHeight: 1600,
    scale: 0.1, //0.075,
    pivotX: 500,
    pivotY: 1000,
    imageOffsetX: 0,
    imageOffsetY: 0,
  },
};

const TUNING = {
  // Act 0.1 POSITION:
  // Horizontal anchor for the avatar. 0.80 means 80% across the row,
  // approximately 20% in from its right edge.
  // Increase to move the avatar right; decrease to move it left.
  avatarCenterXRatio: 0.7,

  // Act 0.1 POSITION:
  // Distance of each visible hand's outer landmark from the avatar centre,
  // relative to the head width. This positions both hands around the smaller
  // character instead of spreading them across the full search row.
  handSpreadHeadRatio: 0.7,

  // Act 0.1 POSITIONS: initial palms image origin is below the row. Raising it
  // reveals the hands from behind the edge. Tune if the first frame is visible.
  palmsBaseTopOffset: 15,

  // Act 0.2 POSITIONS: the mid-transition art has a different transparent top
  // margin. This offset makes its visible hand match the palms pose after swap.
  midBaseTopOffset: 1,

  // Act 0.1 SPEED: slower means a more deliberate pull-up. This is the main
  // palms-up rise duration; it deliberately uses smooth ease-out motion.
  palmsRiseMs: 250,
  palmsHoldMs: 150, // Act 0.1 hold: user requested 200–300 ms.
  midDropMs: 200, // Act 0.2: explicitly requested quick 100 ms drop.

  // Act 0.1 VISIBLE FRACTION: about 80% of the palm should be exposed.
  palmsRiseY: -55,
  midHiddenY: 34,

  // Act 0.1/0.2 POSITION: when the right hand releases, lift it this many dp.
  rightGripLiftY: -12,
  // Act 2.2 POSITIONS: align the mid-transition hand with the lifted grip pose.
  rightMidRevealY: -32,
  // Act 2.2 SPEED: time for the released hand to hide behind the row.
  rightHandHideMs: 180,

  // Act 0.3 POSITION: the hand scale determines this seam alignment. If a robe
  // strip appears above/below the row edge, adjust rowEdgeY in HAND_ART, not X.
  rowCornerRadius: 14,

  // Act 0.4 HEAD SCALE: width is derived from row width, then clamped to keep
  // Half the previous head size. These values also keep the avatar
  // smaller on narrow screens instead of enforcing a large minimum.
  headWidthRatio: 0.27,
  headMinWidth: 75,
  headMaxWidth: 104,

  // Act 0.4 POSITION:
  // Fine horizontal adjustment in dp. Also moves the hand and arm anchors.
  headXOffset: 0,

  // Act 0.5 CURIOUS PEEK: amount of head canvas visible above the row at peak.
  // Increase to reveal more of the goatee; decrease to show less face.
  curiousPeakVisibleRatio: 0.68,
  curiousPeekMs: 1000, //560,
  curiousRetreatMs: 420, //230, // Faster than the peek, as specified.

  // Act 1.1 PULL-UP: spring values shape the smooth pull and settle.
  headSpringStiffness: 55, //185,
  headSpringDamping: 19, //20,
  headSpringMass: 1.9, //0.9,

  // Act 2.3 WAVE POSITION: the wrist/shoulder pivot starts on the right side
  // of the head. Change this ratio if the arm looks detached from the character.
  // Act 2.3 POSITION:
  // Place the waving-arm pivot relative to the avatar centre.
  // Increase to move the pivot toward the character's right shoulder.
  wavePivotHeadOffsetRatio: 0.28,
  waveRotationBox: 640,
  waveHiddenPivotY: 82,
  // Act 2.3 POSITION: the active wrist/pivot sits just above the row. This keeps
  // the sleeve emerging from the same physical origin instead of floating.
  waveActivePivotY: -68,

  // Act 2.3 ASSET ALIGNMENT: pivot corrections (dp) compensate for the three
  // different image canvases. They are intentionally separate and commented.
  waveFlat1PivotX: 0,
  waveFlat2EntryPivotX: 34,
  waveFlat3EntryPivotX: 35,
  waveFlat2CyclePivotX: 35,
  waveFlat3CyclePivotX: 35,
  waveFlat2ExitPivotX: 34,
  waveFlat1ExitPivotX: 0,

  // Act 2.3 Y registration: these are ABSOLUTE offsets from the row top for
  // the rotating wrist pivot. The image pivots differ, so these values change
  // at source swaps to keep the visible hand in almost the same screen position.
  waveFlat2EntryPivotY: -43,
  waveFlat3EntryPivotY: -43,
  waveFlat2CyclePivotY: -43,
  waveFlat3CyclePivotY: -43,
  waveFlat2ExitPivotY: -43,
  waveFlat1ExitPivotY: -68,

  // Act 2.3 WAVE ANGLES: negative values raise the arm. The flat1 transition
  // rotates to about -45°, then flat2 continues to a steeper -70° pose.
  waveEntryAngle: -45,
  waveRaisedAngle: -70,
  waveRightAngle: -40,
  waveDownAngle: -20,
  waveEntryMs: 500, //280,
  waveSteepenMs: 450, //150,
  waveRightMs: 250, //140,
  waveDownMs: 250, //120,
  waveReturnMs: 250, //120,
  waveResetMs: 250, //100,
  waveRepetitions: 3,

  // Act 2.4 SPEECH BUBBLE POSITION: relative to the search row/head.
  // Act 2.4 BUBBLE POSITION:
  // Anchor the bubble relative to the smaller head and keep its right edge
  // within the row's available width.
  // bubbleLeftRatio: 0.58,
  // bubbleTopHeadRatio: 0.73,
  bubbleHeadOffsetRatio: 0.55,
  bubbleAboveHeadOffset: 44,
  bubbleRightInset: 8,
  bubbleWidth: 132,
  bubbleEnterMs: 180,
  bubbleExitMs: 160,

  // Act 3.1 WINK:
  // Increase to hold the wink longer; decrease to shorten it.
  winkHoldMs: 400,
};

const HEAD_ASSETS: Record<HeadPose, ImageSourcePropType> = {
  curious: editedHeadCurious,
  neutral: editedHeadNeutral,
  smile1: editedHeadSmile1,
  smile2: editedHeadSmile2,
  wink: headWinking,
};

const HEAD_POSE_ORDER: HeadPose[] = [
  "curious",
  "neutral",
  "smile1",
  "smile2",
  "wink",
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

function waitFor(
  work: AnimatorWork,
  runId: number,
  duration: number,
): Promise<boolean> {
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
  /*  const targetHandLeft = row.x + TUNING.handOuterInsetX;
  const targetHandRight = row.x + row.width - TUNING.handOuterInsetX; */
  // Act 0.1 POSITION:
  // Keep the gripping hands close to the avatar.
  // Both positions use the visible head's centre and width.
  // Change handSpreadHeadRatio to bring the hands closer together or farther apart.
  const avatarCenterX =
    row.x + row.width * TUNING.avatarCenterXRatio + TUNING.headXOffset;

  const headSize = headSizeForRow(row);
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
  /** True while the overlay owns the measured row position; useful to pause list scrolling. */
  active: boolean;
  /** Start from a row Pressable ref, measured relative to the shared canvas. */
  start: (
    rowRef: MeasurableRef,
    canvasRef: MeasurableRef,
    onFinished?: () => void,
  ) => Promise<boolean>;
  /** Stop all animation/timers and release the caller's activation lock. */
  cancel: () => void;
  isRunning: () => boolean;
  /** Render before normal screen content. Contains head/arms behind the row. */
  behindLayer: React.ReactNode;
  /** Render after normal screen content. Contains only fingers/bubble in front. */
  foregroundLayer: React.ReactNode;
};

export function useHelloThereEasterEggAnimation(
  occlusionColor: string,
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
  const timers = useRef<
    Map<ReturnType<typeof setTimeout>, (finished: boolean) => void>
  >(new Map());
  const work: AnimatorWork = { runId, animations, timers };

  // All movement uses transform values, so the native animation driver can
  // keep frame-to-frame motion smooth even if React briefly does other work.
  const headY = useRef(new Animated.Value(0)).current;
  const leftHandY = useRef(new Animated.Value(0)).current;
  const rightHandY = useRef(new Animated.Value(0)).current;
  const waveRotation = useRef(new Animated.Value(0)).current;
  const wavePivotX = useRef(new Animated.Value(0)).current;
  const wavePivotY = useRef(
    new Animated.Value(TUNING.waveHiddenPivotY),
  ).current;
  const bubbleProgress = useRef(new Animated.Value(0)).current;

  const resetScene = useCallback(() => {
    setActive(false);
    setAnchor(null);
    setHeadPose(null);
    setLeftPose("hidden");
    setRightPose("hidden");
    setWavePose(null);
    setBubbleVisible(false);
    headY.setValue(0);
    leftHandY.setValue(0);
    rightHandY.setValue(0);
    waveRotation.setValue(0);
    wavePivotX.setValue(0);
    wavePivotY.setValue(TUNING.waveHiddenPivotY);
    bubbleProgress.setValue(0);
  }, [
    headY,
    leftHandY,
    rightHandY,
    waveRotation,
    wavePivotX,
    wavePivotY,
    bubbleProgress,
  ]);

  const finishCurrentRun = useCallback(
    (id: number) => {
      if (id !== runId.current) return;
      running.current = false;
      resetScene();
      const callback = finishedCallback.current;
      finishedCallback.current = undefined;
      callback?.();
    },
    [resetScene],
  );

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
      const [rowWindowRect, canvasWindowRect, reduceMotion] = await Promise.all(
        [
          measureInWindow(rowRef),
          measureInWindow(canvasRef),
          AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        ],
      );

      if (id !== runId.current) return false;
      if (!rowWindowRect || !canvasWindowRect) {
        console.warn(
          "[Hello There] Could not measure the row/canvas; skipping animation.",
        );
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

      // Act 0 reset: all artwork begins behind the row; hands rise first.
      setAnchor(localRow);
      setActive(true);
      setHeadPose("curious");
      setLeftPose("palms");
      setRightPose("palms");
      setWavePose(null);
      setBubbleVisible(false);
      headY.setValue(headSize.height); // Entire head begins below the row edge.
      leftHandY.setValue(0);
      rightHandY.setValue(0);
      waveRotation.setValue(0);
      wavePivotX.setValue(TUNING.waveFlat1PivotX);
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
      if (
        !(
          await Promise.all([
            animateTiming(
              work,
              id,
              leftHandY,
              TUNING.palmsRiseY,
              TUNING.palmsRiseMs,
              Easing.out(Easing.cubic),
            ),
            animateTiming(
              work,
              id,
              rightHandY,
              TUNING.palmsRiseY,
              TUNING.palmsRiseMs,
              Easing.out(Easing.cubic),
            ),
          ])
        ).every(Boolean)
      )
        return false;
      if (!(await waitFor(work, id, TUNING.palmsHoldMs))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 0.2 — MID-TRANSITION, THEN QUICK DROP TO THE ROW EDGE
      // The separate left/right source images have different canvas widths.
      // Hand landmarks and scales are independently aligned in HAND_ART.
      // ───────────────────────────────────────────────────────────────────
      setLeftPose("mid");
      setRightPose("mid");
      if (!(await waitFor(work, id, 20))) return false;
      if (
        !(
          await Promise.all([
            animateTiming(
              work,
              id,
              leftHandY,
              TUNING.midHiddenY,
              TUNING.midDropMs,
              Easing.in(Easing.cubic),
            ),
            animateTiming(
              work,
              id,
              rightHandY,
              TUNING.midHiddenY,
              TUNING.midDropMs,
              Easing.in(Easing.cubic),
            ),
          ])
        ).every(Boolean)
      )
        return false;

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
      headY.setValue(headSize.height - 5); // Only a thin top-hair sliver is visible.
      const curiousPeakY =
        headSize.height * (1 - TUNING.curiousPeakVisibleRatio);
      if (
        !(await animateTiming(
          work,
          id,
          headY,
          curiousPeakY,
          TUNING.curiousPeekMs,
          Easing.out(Easing.cubic),
        ))
      )
        return false;
      if (
        !(await animateTiming(
          work,
          id,
          headY,
          headSize.height - 5,
          TUNING.curiousRetreatMs,
          Easing.in(Easing.cubic),
        ))
      )
        return false;

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
      if (
        !(await animateTiming(
          work,
          id,
          rightHandY,
          TUNING.rightGripLiftY,
          150,
          Easing.out(Easing.cubic),
        ))
      )
        return false;
      setRightPose("mid");
      rightHandY.setValue(TUNING.rightMidRevealY);
      if (!(await waitFor(work, id, 20))) return false;
      if (
        !(await animateTiming(
          work,
          id,
          rightHandY,
          TUNING.midHiddenY,
          TUNING.rightHandHideMs,
          Easing.in(Easing.cubic),
        ))
      )
        return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.3 — DEPLOY WAVING ARM
      // The wave pivot is intentionally separate from the asset's image frame.
      // Pose-specific X offsets register each hand when the PNG changes; tune
      // `waveFlat*PivotX` if the hand jumps left/right at a frame swap.
      // Raise waveActivePivotY less (more negative) to raise the hand; increase
      // waveEntryMs/waveSteepenMs to slow down the emergence.
      // ───────────────────────────────────────────────────────────────────
      setWavePose("flat1");
      waveRotation.setValue(0);
      wavePivotX.setValue(TUNING.waveFlat1PivotX);
      wavePivotY.setValue(TUNING.waveHiddenPivotY);
      if (
        !(
          await Promise.all([
            animateTiming(
              work,
              id,
              waveRotation,
              TUNING.waveEntryAngle,
              TUNING.waveEntryMs,
              Easing.out(Easing.cubic),
            ),
            animateTiming(
              work,
              id,
              wavePivotY,
              TUNING.waveActivePivotY,
              TUNING.waveEntryMs,
              Easing.out(Easing.cubic),
            ),
          ])
        ).every(Boolean)
      )
        return false;

      setWavePose("flat2");
      wavePivotX.setValue(TUNING.waveFlat2EntryPivotX);
      wavePivotY.setValue(TUNING.waveFlat2EntryPivotY);
      if (!(await waitFor(work, id, 20))) return false;
      if (
        !(await animateTiming(
          work,
          id,
          waveRotation,
          TUNING.waveRaisedAngle,
          TUNING.waveSteepenMs,
          Easing.inOut(Easing.cubic),
        ))
      )
        return false;

      setWavePose("flat3");
      wavePivotX.setValue(TUNING.waveFlat3EntryPivotX);
      wavePivotY.setValue(TUNING.waveFlat3EntryPivotY);
      if (!(await waitFor(work, id, 30))) return false;

      // The speech bubble starts shortly AFTER the wave gesture starts. It is
      // an actual View/Text, not a rasterized asset, so it stays crisp on scale.
      const bubbleEnter = (async () => {
        if (!(await waitFor(work, id, 80))) return false;
        setBubbleVisible(true);
        return animateTiming(
          work,
          id,
          bubbleProgress,
          1,
          TUNING.bubbleEnterMs,
          Easing.out(Easing.cubic),
        );
      })();

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.4 — THREE WAVE CYCLES
      // Each cycle: flat3 rotates 30° right; swap to flat2; rotate 20° further;
      // rotate back 20°; return to flat3; settle to the raised starting pose.
      // Tune waveRightMs/waveDownMs/waveReturnMs and the angle constants above.
      // ───────────────────────────────────────────────────────────────────
      for (let cycle = 0; cycle < TUNING.waveRepetitions; cycle += 1) {
        // Act 2.4.1 — rotate about 30° to the right before swapping to flat2.
        if (
          !(await animateTiming(
            work,
            id,
            waveRotation,
            TUNING.waveRightAngle,
            TUNING.waveRightMs,
            Easing.inOut(Easing.cubic),
          ))
        )
          return false;
        setWavePose("flat2");
        wavePivotX.setValue(TUNING.waveFlat2CyclePivotX);
        wavePivotY.setValue(TUNING.waveFlat2CyclePivotY);
        if (!(await waitFor(work, id, 18))) return false;

        // Act 2.4.2 — another ~20° downward. The small positive pivot-Y drift
        // is intentional so the hand physically dips instead of just rotating.
        if (
          !(
            await Promise.all([
              animateTiming(
                work,
                id,
                waveRotation,
                TUNING.waveDownAngle,
                TUNING.waveDownMs,
                Easing.inOut(Easing.cubic),
              ),
              animateTiming(
                work,
                id,
                wavePivotY,
                TUNING.waveFlat2CyclePivotY + 10,
                TUNING.waveDownMs,
                Easing.inOut(Easing.cubic),
              ),
            ])
          ).every(Boolean)
        )
          return false;

        // Act 2.4.3 — return upward by the same 20° and settle the pivot height.
        if (
          !(
            await Promise.all([
              animateTiming(
                work,
                id,
                waveRotation,
                TUNING.waveRightAngle,
                TUNING.waveReturnMs,
                Easing.inOut(Easing.cubic),
              ),
              animateTiming(
                work,
                id,
                wavePivotY,
                TUNING.waveFlat2CyclePivotY,
                TUNING.waveReturnMs,
                Easing.inOut(Easing.cubic),
              ),
            ])
          ).every(Boolean)
        )
          return false;

        setWavePose("flat3");
        wavePivotX.setValue(TUNING.waveFlat3CyclePivotX);
        wavePivotY.setValue(TUNING.waveFlat3CyclePivotY);
        if (!(await waitFor(work, id, 16))) return false;
        // Return to the original raised pose between repetitions so the angle
        // does not accumulate and the third wave ends in the same final pose.
        if (
          !(await animateTiming(
            work,
            id,
            waveRotation,
            TUNING.waveRaisedAngle,
            TUNING.waveResetMs,
            Easing.out(Easing.cubic),
          ))
        )
          return false;
      }
      if (!(await bubbleEnter)) return false;
      if (!(await waitFor(work, id, 280))) return false;
      if (
        !(await animateTiming(
          work,
          id,
          bubbleProgress,
          0,
          TUNING.bubbleExitMs,
          Easing.in(Easing.cubic),
        ))
      )
        return false;
      setBubbleVisible(false);

      // ───────────────────────────────────────────────────────────────────
      // ACT 2.5 — REVERSE THE ARM DEPLOYMENT, IN REVERSE ASSET ORDER
      // flat3 → flat2 → flat1 → right mid-transition → right grip. The left
      // hand stays gripping throughout. Tune pose pivot offsets to remove swaps.
      // ───────────────────────────────────────────────────────────────────
      setWavePose("flat2");
      wavePivotX.setValue(TUNING.waveFlat2ExitPivotX);
      wavePivotY.setValue(TUNING.waveFlat2ExitPivotY);
      if (!(await waitFor(work, id, 16))) return false;
      if (
        !(await animateTiming(
          work,
          id,
          waveRotation,
          TUNING.waveEntryAngle,
          TUNING.waveSteepenMs,
          Easing.inOut(Easing.cubic),
        ))
      )
        return false;

      setWavePose("flat1");
      wavePivotX.setValue(TUNING.waveFlat1ExitPivotX);
      wavePivotY.setValue(TUNING.waveFlat1ExitPivotY);
      if (!(await waitFor(work, id, 16))) return false;
      if (
        !(
          await Promise.all([
            animateTiming(
              work,
              id,
              waveRotation,
              0,
              TUNING.waveEntryMs,
              Easing.in(Easing.cubic),
            ),
            animateTiming(
              work,
              id,
              wavePivotY,
              TUNING.waveHiddenPivotY,
              TUNING.waveEntryMs,
              Easing.in(Easing.cubic),
            ),
          ])
        ).every(Boolean)
      )
        return false;
      setWavePose(null);

      // Right mid-transition appears hidden, rises to the same release frame,
      // then the gripping image is restored and lowered into its exact seam.
      setRightPose("mid");
      rightHandY.setValue(TUNING.midHiddenY);
      if (
        !(await animateTiming(
          work,
          id,
          rightHandY,
          TUNING.rightMidRevealY,
          TUNING.rightHandHideMs,
          Easing.out(Easing.cubic),
        ))
      )
        return false;
      setRightPose("grip");
      rightHandY.setValue(TUNING.rightGripLiftY);
      if (!(await waitFor(work, id, 20))) return false;
      if (
        !(await animateTiming(
          work,
          id,
          rightHandY,
          0,
          150,
          Easing.out(Easing.cubic),
        ))
      )
        return false;

      // Act 2.6 — the smile-2 expression rests briefly after the arm is back.
      setHeadPose("smile2");
      if (!(await waitFor(work, id, 180))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 3.1 — WINK, 200 ms, THEN RETURN TO SMILE-1
      // The wink source has a different raw canvas size; all head poses render
      // to one common width/height to prevent the face from jumping on swap.
      // ───────────────────────────────────────────────────────────────────
      setHeadPose("smile1");
      if (!(await waitFor(work, id, 24))) return false;
      setHeadPose("wink");
      if (!(await waitFor(work, id, TUNING.winkHoldMs))) return false;
      setHeadPose("smile1");
      if (!(await waitFor(work, id, 35))) return false;

      // ───────────────────────────────────────────────────────────────────
      // ACT 3.2 — RETREAT. Head descends at the same time as the hands reverse
      // Act 0: grip → hidden mid → palms visible → palms lower behind the row.
      // ───────────────────────────────────────────────────────────────────
      setLeftPose("mid");
      setRightPose("mid");
      leftHandY.setValue(TUNING.midHiddenY);
      rightHandY.setValue(TUNING.midHiddenY);
      const headRetreat = animateTiming(
        work,
        id,
        headY,
        headSize.height - 5,
        450,
        Easing.in(Easing.cubic),
      );

      // Reverse Act 0.2 + 0.1 run as one concurrent arm sequence. The head is
      // descending during BOTH steps, not only during the first 100 ms.
      const handsRetreat = (async () => {
        // Mid-transition rises back to the pose where Act 0 swapped to palms.
        if (
          !(
            await Promise.all([
              animateTiming(
                work,
                id,
                leftHandY,
                TUNING.palmsRiseY,
                100,
                Easing.out(Easing.cubic),
              ),
              animateTiming(
                work,
                id,
                rightHandY,
                TUNING.palmsRiseY,
                100,
                Easing.out(Easing.cubic),
              ),
            ])
          ).every(Boolean)
        )
          return false;

        // Reverse Act 0.1: palms replace mid at the same visible hand landmarks.
        setLeftPose("palms");
        setRightPose("palms");
        if (!(await waitFor(work, id, 18))) return false;

        // Act 3.2 SPEED: increase 350 ms for a slower retreat under the row.
        if (
          !(
            await Promise.all([
              animateTiming(
                work,
                id,
                leftHandY,
                0,
                350,
                Easing.in(Easing.cubic),
              ),
              animateTiming(
                work,
                id,
                rightHandY,
                0,
                350,
                Easing.in(Easing.cubic),
              ),
            ])
          ).every(Boolean)
        )
          return false;
        setLeftPose("hidden");
        setRightPose("hidden");
        return true;
      })();

      if (!(await Promise.all([headRetreat, handsRetreat])).every(Boolean))
        return false;
      setHeadPose(null);
      finishCurrentRun(id);
      return true;
    } catch (error) {
      console.warn(
        "[Hello There] Animation failed; restoring the search UI.",
        error,
      );
      finishCurrentRun(id);
      return false;
    } finally {
      // This handles ordinary completion/failure only. Cancellation increments
      // runId first and releases the lock in cancel(), so it cannot double-finish.
      if (id === runId.current && running.current) finishCurrentRun(id);
    }
  };

  const headSize = anchor ? headSizeForRow(anchor) : null;
  /* const headLeft = anchor && headSize
    ? anchor.x + anchor.width / 2 - headSize.width / 2 + TUNING.headXOffset
    : 0; */
  const headLeft =
    anchor && headSize
      ? anchor.x +
        anchor.width * TUNING.avatarCenterXRatio -
        headSize.width / 2 +
        TUNING.headXOffset
      : 0;
  const headTop = anchor && headSize ? anchor.y - headSize.height + 5 : 0;

  const bubbleLeft =
    anchor && headSize
      ? Math.min(
          headLeft + headSize.width * TUNING.bubbleHeadOffsetRatio,
          anchor.x +
            anchor.width -
            TUNING.bubbleWidth -
            TUNING.bubbleRightInset,
        )
      : 0;

  const bubbleTop =
    anchor && headSize ? headTop - TUNING.bubbleAboveHeadOffset : 0;

  const renderHandBehind = (side: Side, pose: HandPose) => {
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
            // The foreground copy shares the same measured image frame as the
            // behind copy, but is clipped to the row rectangle below.
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

  const waveRotationDegrees = waveRotation.interpolate({
    inputRange: [-90, 0, 90],
    outputRange: ["-90deg", "0deg", "90deg"],
  });

  const behindLayer = (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, styles.behindLayer]}
    >
      {active && anchor && (
        <>
          {renderHandBehind("left", leftPose)}
          {renderHandBehind("right", rightPose)}

          {wavePose && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.waveRotationBox,
                {
                  /*  left:
                    anchor.x +
                    anchor.width * TUNING.wavePivotXRatio -
                    WAVE_BOX_CENTER, */
                  left:
                    anchor.x +
                    anchor.width * TUNING.avatarCenterXRatio +
                    TUNING.headXOffset +
                    (headSize?.width ?? 0) * TUNING.wavePivotHeadOffsetRatio -
                    WAVE_BOX_CENTER,
                  top: anchor.y - WAVE_BOX_CENTER,
                  transform: [
                    { rotate: waveRotationDegrees },
                    { translateX: wavePivotX },
                    { translateY: wavePivotY },
                  ],
                },
              ]}
            >
              <Image
                source={WAVE_ART[wavePose].source}
                resizeMode="stretch"
                fadeDuration={0}
                style={{
                  position: "absolute",
                  left:
                    WAVE_BOX_CENTER -
                    WAVE_ART[wavePose].pivotX * WAVE_ART[wavePose].scale +
                    WAVE_ART[wavePose].imageOffsetX,
                  top:
                    WAVE_BOX_CENTER -
                    WAVE_ART[wavePose].pivotY * WAVE_ART[wavePose].scale +
                    WAVE_ART[wavePose].imageOffsetY,
                  width:
                    WAVE_ART[wavePose].sourceWidth * WAVE_ART[wavePose].scale,
                  height:
                    WAVE_ART[wavePose].sourceHeight * WAVE_ART[wavePose].scale,
                }}
              />
            </Animated.View>
          )}

          {/* {headPose && headSize && (
            <Animated.Image
              source={HEAD_ASSETS[headPose]}
              resizeMode="stretch"
              fadeDuration={0}
              style={[
                styles.sprite,
                {
                  left: headLeft,
                  top: headTop,
                  width: headSize.width,
                  height: headSize.height,
                  transform: [{ translateY: headY }],
                },
              ]}
            />
          )} */}
          {/* 
  HEAD POSE STACK:
  All head images stay mounted together at the same position and size.
  Changing headPose only changes opacity, avoiding a new image-source load
  during expression transitions.
*/}
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

                    // Act 1 / Act 2 / Act 3 EXPRESSION:
                    // Exactly one face is visible at a time.
                    // Every face uses the same frame and headY movement.
                    opacity: headPose === pose ? 1 : 0,

                    transform: [{ translateY: headY }],
                  },
                ]}
              />
            ))}
          {/*
            OCCLUSION MASK: render after the rear character but before the real
            search UI. This uses the screen background rather than a translucent
            tint, so the character cannot bleed through a 0D-alpha row background.
            The real row and its text are rendered over this mask immediately after.
          */}
          <View
            style={{
              position: "absolute",
              left: anchor.x,
              top: anchor.y,
              width: anchor.width,
              height: anchor.height,
              backgroundColor: occlusionColor,
              borderRadius: TUNING.rowCornerRadius,
            }}
          />
        </>
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
                /* left: anchor.x + anchor.width * TUNING.bubbleLeftRatio,
                top: anchor.y - headSize.height * TUNING.bubbleTopHeadRatio, */
                left: bubbleLeft,
                top: bubbleTop,
                width: TUNING.bubbleWidth,
                opacity: bubbleOpacity,
                transform: [
                  { translateY: bubbleTranslateY },
                  { scale: bubbleScale },
                ],
              }}
            >
              <View style={styles.speechBubble}>
                <Text style={styles.speechBubbleText}>HELLO THERE!</Text>
              </View>
              <View style={styles.speechBubbleTail} />
            </Animated.View>
          )}
        </>
      )}
    </View>
  );

  return {
    active,
    start,
    cancel,
    isRunning: () => running.current,
    behindLayer,
    foregroundLayer,
  };
}

const styles = StyleSheet.create({
  sprite: {
    position: "absolute",
  },
  behindLayer: {
    zIndex: 0,
    elevation: 0,
    overflow: "visible",
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
