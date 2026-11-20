import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  makeImageFromView,
  type SkImage,
} from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";

import type { GlobalSearchResult } from "@/types/global-search";
import {
  WORKLET_PHYSICS,
  bodyOverlapsSpawn,
  createCopyBody,
  findSpawnPosition,
  getCopyPileBounds,
  hitTestCopy,
  makeCopyWorld,
  packCopyPoses,
  releaseDraggedCopy,
  stepCopyWorld,
  wakeAllCopies,
  type CopyWorld,
} from "./copy-machine-physics-worklet-cv3.1.";

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableRef = React.RefObject<View | null>;
type Phase = "measuring" | "active" | "clearing" | null;
type FrameCallbackHandle = {
  setActive: (active: boolean) => void;
  isActive: boolean;
};

type PressCallbacks = {
  onFirstPress?: () => void;
  onFinished?: () => void;
};

type TouchStore = {
  rect: Rect | null;
  listeners: Set<(rect: Rect | null) => void>;
};

/**
 * Copy Machine v2.1
 *
 * - One makeImageFromView snapshot is reused by every duplicate.
 * - Every copy reuses one captured row texture and is drawn as a Skia image
 *   node on one Canvas. This avoids depending on an Atlas transform buffer for
 *   the first visible copy while keeping all copies out of the RN view tree.
 * - The rigid-body solver runs in Reanimated's UI runtime via useFrameCallback.
 * - Gesture Handler recognises drags and throws on the UI runtime.
 * - Spawns queue while the previous copy clears the nozzle, instead of losing
 *   repeated activations or starting bodies interpenetrating one another.
 * - There is no fixed viewport-height capacity. Capacity is reached when the
 *   entire small spawn lane is physically blocked by settled copies, or the
 *   generous emergency ceiling is reached.
 *
 * The hook intentionally preserves the v5 controller API so the existing
 * GlobalSearchScreen call site can keep calling press(rowRef, canvasRef,
 * result, callbacks), and can keep rendering `layer`.
 */
export const COPY_MACHINE_TUNING = {
  copyScale: 0.92,
  maxQueuedPresses: WORKLET_PHYSICS.maxCopies,
  touchBoundsPadding: 9,
  touchBoundsRefreshMs: 90,
  clearFadeMs: 210,
  clearLiftDp: 7,
  spawnJitterAngle: WORKLET_PHYSICS.spawnJitterAngle,
  spawnInitialDownVelocity: 20,
  spawnLateralVelocity: 12,
  spawnAngularVelocity: 0.14,
} as const;

const POSE_STRIDE = 3;

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

async function snapshotRow(ref: MeasurableRef): Promise<SkImage | null> {
  try {
    if (!ref.current) return null;
    return await makeImageFromView(ref as React.RefObject<View>);
  } catch (error) {
    console.warn("[Copy Machine] Row snapshot failed.", error);
    return null;
  }
}

/** One light Skia draw node per copy; all nodes reuse the same captured image. */
const CopySprite = React.memo(function CopySprite({
  index,
  poses,
  clearProgress,
  image,
  width,
  height,
}: {
  index: number;
  poses: SharedValue<number[]>;
  clearProgress: SharedValue<number>;
  image: SkImage;
  width: number;
  height: number;
}) {
  const transform = useDerivedValue(() => {
    const current = poses.value;
    const offset = index * POSE_STRIDE;
    if (current.length < offset + POSE_STRIDE) return [];
    return [
      { translateX: current[offset] },
      { translateY: current[offset + 1] },
      { rotate: current[offset + 2] },
    ];
  });
  const opacity = useDerivedValue(() => 1 - clearProgress.value);

  return (
    <Group transform={transform} opacity={opacity}>
      <SkiaImage
        image={image}
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fit="fill"
        sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
      />
    </Group>
  );
});

const PileTouchLayer = React.memo(function PileTouchLayer({
  store,
  gesture,
}: {
  store: TouchStore;
  gesture: ReturnType<typeof Gesture.Pan>;
}) {
  const [rect, setRect] = useState<Rect | null>(store.rect);
  useEffect(() => {
    const listener = (next: Rect | null) => setRect(next);
    store.listeners.add(listener);
    listener(store.rect);
    return () => {
      store.listeners.delete(listener);
    };
  }, [store]);
  if (!rect || rect.width < 2 || rect.height < 2) return null;
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible={false}
        style={[
          styles.pileTouchLayer,
          {
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          },
        ]}
      />
    </GestureDetector>
  );
});

export type CopyMachineAnimationController = {
  press: (
    rowRef: MeasurableRef,
    canvasRef: MeasurableRef,
    result: GlobalSearchResult,
    callbacks?: PressCallbacks,
  ) => void;
  clear: () => void;
  cancel: () => void;
  active: boolean;
  capacityReached: boolean;
  layer: React.ReactNode;
};

export function useCopyMachineAnimation(): CopyMachineAnimationController {
  const [active, setActive] = useState(false);
  const [capacityReached, setCapacityReached] = useState(false);
  const [image, setImage] = useState<SkImage | null>(null);
  const [bodyCount, setBodyCount] = useState(0);
  const [copySize, setCopySize] = useState({ width: 0, height: 0 });
  const [accentColor, setAccentColor] = useState("#168ACB");

  const world = useSharedValue<CopyWorld | null>(null);
  const poses = useSharedValue<number[]>([]);
  const pendingSpawns = useSharedValue(0);
  // UI-runtime source of truth for queued + spawned copies; avoids relying on
  // React state, whose update is intentionally asynchronous.
  const spawnedCountShared = useSharedValue(0);
  const clearProgress = useSharedValue(0);
  const canvasOriginX = useSharedValue(0);
  const canvasOriginY = useSharedValue(0);
  const lastTouchRefresh = useSharedValue(0);

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>(null);
  const runIdRef = useRef(0);
  const callbacksRef = useRef<PressCallbacks>({});
  const earlyPressCountRef = useRef(0);
  const frameRef = useRef<FrameCallbackHandle | null>(null);
  const touchStoreRef = useRef<TouchStore>({
    rect: null,
    listeners: new Set(),
  });
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopFrameOnRN = useCallback(() => {
    frameRef.current?.setActive(false);
  }, []);
  const updatePileRectOnRN = useCallback((rect: Rect | null) => {
    const store = touchStoreRef.current;
    const previous = store.rect;
    const unchanged =
      previous === rect ||
      (previous != null &&
        rect != null &&
        Math.abs(previous.x - rect.x) < 1 &&
        Math.abs(previous.y - rect.y) < 1 &&
        Math.abs(previous.width - rect.width) < 1 &&
        Math.abs(previous.height - rect.height) < 1);
    if (unchanged) return;
    store.rect = rect;
    store.listeners.forEach((listener) => listener(rect));
  }, []);
  const markCapacityReachedOnRN = useCallback(() => {
    setCapacityReached(true);
  }, []);
  const clearCapacityReachedOnRN = useCallback(() => {
    setCapacityReached(false);
  }, []);
  const updateBodyCountOnRN = useCallback((count: number) => {
    setBodyCount((current) => (current === count ? current : count));
  }, []);

  const finishSession = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;
      frameRef.current?.setActive(false);
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      world.value = null;
      poses.value = [];
      pendingSpawns.value = 0;
      spawnedCountShared.value = 0;
      clearProgress.value = 0;
      updatePileRectOnRN(null);
      setImage(null);
      setBodyCount(0);
      setCopySize({ width: 0, height: 0 });
      setActive(false);
      setCapacityReached(false);
      activeRef.current = false;
      phaseRef.current = null;
      earlyPressCountRef.current = 0;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [
      clearProgress,
      pendingSpawns,
      poses,
      spawnedCountShared,
      updatePileRectOnRN,
      world,
    ],
  );

  const frameCallback = useFrameCallback((frameInfo) => {
    "worklet";
    const currentWorld = world.value;
    if (!currentWorld || !currentWorld.active || currentWorld.clearing) {
      scheduleOnRN(stopFrameOnRN);
      return;
    }

    let pending = pendingSpawns.value;
    let didSpawn = false;
    let full = false;
    while (pending > 0) {
      if (currentWorld.bodies.length >= WORKLET_PHYSICS.maxCopies) {
        full = true;
        pending = 0;
        break;
      }
      const slot = findSpawnPosition(currentWorld);
      if (!slot.found) {
        if (!slot.movingBlocker) {
          full = true;
          pending = 0;
        }
        break;
      }

      const x = slot.x;
      const y = currentWorld.spawnY;
      const width = currentWorld.copyWidth;
      const height = currentWorld.copyHeight;
      const lateralDrift = (x - currentWorld.spawnX) * -0.08;
      const body = createCopyBody(
        currentWorld.bodies.length + 1,
        x,
        y,
        width,
        height,
        (Math.random() - 0.5) * WORKLET_PHYSICS.spawnJitterAngle * 2,
        lateralDrift +
          (Math.random() - 0.5) * COPY_MACHINE_TUNING.spawnLateralVelocity,
        COPY_MACHINE_TUNING.spawnInitialDownVelocity,
        (Math.random() - 0.5) * COPY_MACHINE_TUNING.spawnAngularVelocity * 2,
      );
      currentWorld.bodies.push(body);
      spawnedCountShared.value = currentWorld.bodies.length;
      wakeAllCopies(currentWorld);
      if (currentWorld.capacityReached) {
        currentWorld.capacityReached = false;
        scheduleOnRN(clearCapacityReachedOnRN);
      }
      pending -= 1;
      didSpawn = true;
      // A second pending spawn normally waits until this one has cleared the
      // nozzle. Do not create overlapping bodies at the same origin.
      if (
        pending > 0 &&
        bodyOverlapsSpawn(
          body,
          currentWorld.spawnX,
          currentWorld.spawnY,
          currentWorld.copyWidth / 2,
          currentWorld.copyHeight / 2,
        )
      ) {
        break;
      }
    }
    pendingSpawns.value = pending;
    if (didSpawn) {
      // React only learns when the number of visual sprites changes, never per frame.
      scheduleOnRN(updateBodyCountOnRN, currentWorld.bodies.length);
    }

    if (full) {
      currentWorld.capacityReached = true;
      scheduleOnRN(markCapacityReachedOnRN);
    }

    const timeSincePrevious = frameInfo.timeSincePreviousFrame ?? 16.667;
    const frameDelta =
      Math.min(
        WORKLET_PHYSICS.maxFrameDeltaMs,
        Math.max(0, timeSincePrevious),
      ) / 1000;
    currentWorld.accumulator += frameDelta;
    let substeps = 0;
    let anyAwake = currentWorld.dragBodyId >= 0;
    while (
      currentWorld.accumulator >= WORKLET_PHYSICS.fixedStep &&
      substeps < WORKLET_PHYSICS.maxSubsteps
    ) {
      anyAwake = stepCopyWorld(currentWorld, WORKLET_PHYSICS.fixedStep);
      currentWorld.accumulator -= WORKLET_PHYSICS.fixedStep;
      substeps += 1;
    }
    if (substeps === WORKLET_PHYSICS.maxSubsteps) {
      currentWorld.accumulator = 0;
    }
    // A render frame can be shorter than the fixed physics step. In that case
    // there was no `stepCopyWorld` call, but awake bodies still require another
    // frame; do not accidentally stop the simulation on a high-refresh display.
    if (substeps === 0) {
      for (let i = 0; i < currentWorld.bodies.length; i += 1) {
        if (!currentWorld.bodies[i].asleep) {
          anyAwake = true;
          break;
        }
      }
    }

    spawnedCountShared.value = currentWorld.bodies.length;
    poses.value = packCopyPoses(currentWorld);

    if (
      frameInfo.timestamp - lastTouchRefresh.value >=
      COPY_MACHINE_TUNING.touchBoundsRefreshMs
    ) {
      lastTouchRefresh.value = frameInfo.timestamp;
      const bounds = getCopyPileBounds(
        currentWorld,
        COPY_MACHINE_TUNING.touchBoundsPadding,
      );
      scheduleOnRN(updatePileRectOnRN, bounds);
    }

    world.value = { ...currentWorld };

    if (!anyAwake && pending === 0 && !didSpawn) {
      currentWorld.accumulator = 0;
      scheduleOnRN(stopFrameOnRN);
    }
  }, false);
  frameRef.current = frameCallback;

  const activateFrame = useCallback(() => {
    frameRef.current?.setActive(true);
  }, []);

  const dragGesture = useMemo(() => {
    return Gesture.Pan()
      .manualActivation(true)
      .maxPointers(1)
      .onTouchesDown((event, stateManager) => {
        "worklet";
        const touch = event.allTouches[0];
        const currentWorld = world.value;
        if (
          !touch ||
          !currentWorld ||
          !currentWorld.active ||
          currentWorld.clearing
        ) {
          stateManager.fail();
          return;
        }
        const x = touch.absoluteX - canvasOriginX.value;
        const y = touch.absoluteY - canvasOriginY.value;
        const id = hitTestCopy(currentWorld, x, y);
        if (id < 0) {
          stateManager.fail();
          return;
        }
        const body = currentWorld.bodies.find((item) => item.id === id);
        if (!body) {
          stateManager.fail();
          return;
        }
        const dx = x - body.x;
        const dy = y - body.y;
        currentWorld.dragBodyId = id;
        currentWorld.dragLocalX = body.cos * dx + body.sin * dy;
        currentWorld.dragLocalY = -body.sin * dx + body.cos * dy;
        currentWorld.dragTargetX = x;
        currentWorld.dragTargetY = y;
        wakeAllCopies(currentWorld);
        world.value = { ...currentWorld };
        stateManager.activate();
        scheduleOnRN(activateFrame);
      })
      .onUpdate((event) => {
        "worklet";
        const currentWorld = world.value;
        if (!currentWorld || currentWorld.dragBodyId < 0) return;
        currentWorld.dragTargetX = event.absoluteX - canvasOriginX.value;
        currentWorld.dragTargetY = event.absoluteY - canvasOriginY.value;
        world.value = { ...currentWorld };
      })
      .onEnd((event) => {
        "worklet";
        const currentWorld = world.value;
        if (!currentWorld || currentWorld.dragBodyId < 0) return;
        releaseDraggedCopy(currentWorld, event.velocityX, event.velocityY);
        world.value = { ...currentWorld };
        scheduleOnRN(activateFrame);
      })
      .onFinalize(() => {
        "worklet";
        const currentWorld = world.value;
        if (!currentWorld || currentWorld.dragBodyId < 0) return;
        releaseDraggedCopy(currentWorld, 0, 0);
        world.value = { ...currentWorld };
        scheduleOnRN(activateFrame);
      });
  }, [activateFrame, canvasOriginX, canvasOriginY, world]);

  const beginMeasurement = useCallback(
    async (
      rowRectPromise: Promise<Rect | null>,
      canvasRectPromise: Promise<Rect | null>,
      rowImagePromise: Promise<SkImage | null>,
      runId: number,
    ) => {
      try {
        // All three native measurements/capture requests are initiated before
        // onFirstPress can update search state or unmount/reorder the result row.
        const [rowRect, canvasRect, rowImage] = await Promise.all([
          rowRectPromise,
          canvasRectPromise,
          rowImagePromise,
        ]);
        if (runId !== runIdRef.current) {
          return;
        }
        if (!rowRect || !canvasRect || !rowImage) {
          console.warn(
            "[Copy Machine] Could not measure or snapshot the row/canvas.",
            {
              rowMeasured: !!rowRect,
              canvasMeasured: !!canvasRect,
              snapshotCreated: !!rowImage,
            },
          );
          finishSession(runId);
          return;
        }

        const localX = rowRect.x - canvasRect.x;
        const localY = rowRect.y - canvasRect.y;
        canvasOriginX.value = canvasRect.x;
        canvasOriginY.value = canvasRect.y;
        const nextWorld = makeCopyWorld(
          canvasRect.width,
          canvasRect.height,
          localX,
          localY,
          rowRect.width,
          rowRect.height,
          COPY_MACHINE_TUNING.copyScale,
        );
        world.value = nextWorld;
        pendingSpawns.value = Math.min(
          1 + earlyPressCountRef.current,
          COPY_MACHINE_TUNING.maxQueuedPresses,
        );
        earlyPressCountRef.current = 0;
        const snapshotWidth = rowImage.width();
        const snapshotHeight = rowImage.height();
        if (
          !Number.isFinite(snapshotWidth) ||
          !Number.isFinite(snapshotHeight) ||
          snapshotWidth <= 0 ||
          snapshotHeight <= 0
        ) {
          throw new Error(
            `Invalid row snapshot dimensions: ${snapshotWidth}x${snapshotHeight}`,
          );
        }
        setCopySize({
          width: nextWorld.copyWidth,
          height: nextWorld.copyHeight,
        });
        setBodyCount(0);
        setImage(rowImage);
        updatePileRectOnRN(null);
        setActive(true);
        phaseRef.current = "active";
        frameCallback.setActive(true);
      } catch (error) {
        console.warn("[Copy Machine] Failed to prepare the pile.", error);
        finishSession(runId);
      }
    },
    [
      canvasOriginX,
      canvasOriginY,
      finishSession,
      frameCallback,
      pendingSpawns,
      updatePileRectOnRN,
      world,
    ],
  );

  const press = useCallback(
    (
      rowRef: MeasurableRef,
      canvasRef: MeasurableRef,
      pressedResult: GlobalSearchResult,
      callbacks: PressCallbacks = {},
    ) => {
      if (phaseRef.current === "clearing") return;

      // Repeated activation is intentional: it queues one physical body per tap.
      if (phaseRef.current === "active") {
        const totalCommitted = spawnedCountShared.value + pendingSpawns.value;
        if (totalCommitted >= COPY_MACHINE_TUNING.maxQueuedPresses) return;
        pendingSpawns.value += 1;
        frameCallback.setActive(true);
        return;
      }
      if (phaseRef.current === "measuring") {
        earlyPressCountRef.current = Math.min(
          earlyPressCountRef.current + 1,
          COPY_MACHINE_TUNING.maxQueuedPresses - 1,
        );
        return;
      }

      activeRef.current = true;
      phaseRef.current = "measuring";
      runIdRef.current += 1;
      const runId = runIdRef.current;
      callbacksRef.current = callbacks;
      setActive(true);
      setCapacityReached(false);
      earlyPressCountRef.current = 0;
      pendingSpawns.value = 0;
      spawnedCountShared.value = 0;
      poses.value = [];
      setBodyCount(0);
      setCopySize({ width: 0, height: 0 });
      clearProgress.value = 0;
      world.value = null;
      if (pressedResult.document.kind === "easterEgg") {
        setAccentColor(
          pressedResult.document.display.presentation?.accentColor ?? "#168ACB",
        );
      }

      // Snapshot AND measure before onFirstPress can update search state or
      // unmount/reorder the result row. measureInWindow dispatches immediately;
      // awaiting these promises later does not re-measure a possibly removed row.
      const rowRectPromise = measureInWindow(rowRef);
      const canvasRectPromise = measureInWindow(canvasRef);
      const rowImagePromise = snapshotRow(rowRef);
      try {
        callbacks.onFirstPress?.();
      } catch (error) {
        console.warn("[Copy Machine] First-press callback failed.", error);
        finishSession(runId);
        return;
      }
      void beginMeasurement(
        rowRectPromise,
        canvasRectPromise,
        rowImagePromise,
        runId,
      );
    },
    [
      beginMeasurement,
      clearProgress,
      finishSession,
      frameCallback,
      pendingSpawns,
      poses,
      world,
    ],
  );

  const clear = useCallback(() => {
    if (!activeRef.current || phaseRef.current !== "active") return;
    phaseRef.current = "clearing";
    pendingSpawns.value = 0;
    const currentWorld = world.value;
    if (currentWorld) world.value = { ...currentWorld, clearing: true };
    frameCallback.setActive(false);
    clearProgress.value = withTiming(1, {
      duration: COPY_MACHINE_TUNING.clearFadeMs,
      easing: Easing.out(Easing.quad),
    });
    const runId = runIdRef.current;
    clearTimerRef.current = setTimeout(
      () => finishSession(runId),
      COPY_MACHINE_TUNING.clearFadeMs + 35,
    );
  }, [clearProgress, finishSession, frameCallback, pendingSpawns, world]);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    runIdRef.current += 1;
    finishSession(runIdRef.current);
  }, [finishSession]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      frameCallback.setActive(false);
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      world.value = null;
      poses.value = [];
      pendingSpawns.value = 0;
      activeRef.current = false;
      phaseRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    };
  }, [frameCallback, pendingSpawns, poses, world]);

  const sprites: React.ReactNode[] = [];
  if (active && image && copySize.width > 0 && copySize.height > 0) {
    for (let index = 0; index < bodyCount; index += 1) {
      sprites.push(
        <CopySprite
          key={index}
          index={index}
          poses={poses}
          clearProgress={clearProgress}
          image={image}
          width={copySize.width}
          height={copySize.height}
        />,
      );
    }
  }

  const layer = (
    <View
      pointerEvents="box-none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]}
    >
      {active && image && (
        <View
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}
        >
          <Canvas style={StyleSheet.absoluteFill}>{sprites}</Canvas>
        </View>
      )}

      {active && image && (
        <PileTouchLayer store={touchStoreRef.current} gesture={dragGesture} />
      )}

      {active && capacityReached && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear duplicated rows"
          onPress={clear}
          style={[styles.clearButton, { backgroundColor: accentColor }]}
        >
          <Text style={styles.clearButtonText}>Clear pile</Text>
        </Pressable>
      )}
    </View>
  );

  return {
    press,
    clear,
    cancel,
    active,
    capacityReached,
    layer,
  };
}

const styles = StyleSheet.create({
  pileTouchLayer: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  clearButton: {
    position: "absolute",
    right: 18,
    bottom: 16,
    zIndex: 200,
    elevation: 200,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
