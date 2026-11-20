import React, { useCallback, useEffect, useRef, useState } from "react";
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
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { GlobalSearchResult } from "@/types/global-search";
import {
  PHYSICS_TUNING,
  PhysicsWorld,
  createBody,
  getBodyExtents,
  type PhysicsBody,
} from "./copy-machine-physics";

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableRef = React.RefObject<View | null>;
type CopyAnchor = Rect & { canvasWidth: number; canvasHeight: number };
type Phase = "measuring" | "active" | "clearing" | null;
type SpawnOutcome = "spawned" | "busy" | "full";

type PressCallbacks = {
  onFirstPress?: () => void;
  onFinished?: () => void;
};

/**
 * The Copy Machine: pressing the row ejects a smaller copy that drops and
 * lands as a real rigid body (see copy-machine-physics.ts).
 *
 * Rendering: the pressed row is snapshotted ONCE into a Skia image. Every copy
 * is that image drawn on a single Skia canvas, so no React Native row views
 * exist while the pile moves. The JS physics loop writes one array of poses
 * to one shared value per frame (a single JS -> UI message regardless of how
 * many copies exist), and each sprite derives its transform from it on the UI
 * thread. The loop stops completely once the pile is asleep.
 *
 * Needs: @shopify/react-native-skia and react-native-reanimated.
 * The pressed row's wrapper should have `collapsable={false}` on Android so
 * it can be snapshotted.
 */
export const COPY_MACHINE_TUNING = {
  // Composition
  copyScale: 0.92,
  spawnGap: 3,
  floorInset: 8,
  maxCopiesHardLimit: 20,

  // Spawn: each copy leaves the machine off to one side, tilted, moving out.
  spawnDownSpeed: 600, // dp/s "ejection" kick
  spawnOffsetMin: 0.07, // fraction of canvas width
  spawnOffsetMax: 0.2,
  spawnTiltMin: 0.04, // radians
  spawnTiltMax: 0.15,
  spawnSideSpeedMin: 35, // dp/s
  spawnSideSpeedMax: 110,
  spawnSpinMin: 0.25, // rad/s
  spawnSpinMax: 0.8,
  sameSideChance: 0.25, // otherwise the next copy goes to the opposite side
  maxPendingSpawns: 3,
  fullPileSpeed: 30,

  // Loop
  maxFrameDeltaMs: 50,

  // Clear
  clearFadeMs: 190,
  clearLiftDp: 5,
};

const POSE_STRIDE = 3; // x, y, angle per body

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const between = (min: number, max: number) => min + Math.random() * (max - min);

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
    const p = poses.value;
    const o = index * POSE_STRIDE;
    return [
      { translateX: p[o] },
      {
        translateY:
          p[o + 1] + clearProgress.value * COPY_MACHINE_TUNING.clearLiftDp,
      },
      { rotate: p[o + 2] },
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
  spawnedCount: number;
  layer: React.ReactNode;
};

export function useCopyMachineAnimation(): CopyMachineAnimationController {
  const [active, setActive] = useState(false);
  const [capacityReached, setCapacityReached] = useState(false);
  const [spawnedCount, setSpawnedCount] = useState(0);
  const [anchor, setAnchor] = useState<CopyAnchor | null>(null);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [image, setImage] = useState<SkImage | null>(null);
  // Bodies drive rendering only through `bodyCount`; poses travel via poses.
  const [bodyCount, setBodyCount] = useState(0);
  const [copySize, setCopySize] = useState({ width: 0, height: 0 });

  const poses = useSharedValue<number[]>([]);
  const clearProgress = useSharedValue(0);

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>(null);
  const runIdRef = useRef(0);
  const nextBodyIdRef = useRef(1); // id 0 is the floor
  const bodiesRef = useRef<PhysicsBody[]>([]);
  const worldRef = useRef<PhysicsWorld | null>(null);
  const anchorRef = useRef<CopyAnchor | null>(null);
  const capacityRef = useRef(0);
  const pendingRef = useRef(0);
  const lastSideRef = useRef(1);
  const accumulatorRef = useRef(0);
  const callbacksRef = useRef<PressCallbacks>({});
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPhysics = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
  }, []);

  const finishSession = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;
      stopPhysics();
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      bodiesRef.current = [];
      worldRef.current = null;
      anchorRef.current = null;
      activeRef.current = false;
      phaseRef.current = null;
      capacityRef.current = 0;
      pendingRef.current = 0;
      poses.value = [];
      clearProgress.value = 0;
      setBodyCount(0);
      setImage(null);
      setAnchor(null);
      setResult(null);
      setActive(false);
      setCapacityReached(false);
      setSpawnedCount(0);
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [clearProgress, poses, stopPhysics],
  );

  /** One JS -> UI write per frame, whatever the number of copies. */
  const pushPoses = useCallback(() => {
    const bodies = bodiesRef.current;
    const next = new Array<number>(bodies.length * POSE_STRIDE);
    for (let i = 0; i < bodies.length; i += 1) {
      next[i * POSE_STRIDE] = bodies[i].x;
      next[i * POSE_STRIDE + 1] = bodies[i].y;
      next[i * POSE_STRIDE + 2] = bodies[i].angle;
    }
    poses.value = next;
  }, [poses]);

  /**
   * Tries to eject one copy. A copy only appears when its spawn slot is free,
   * so bodies never start interpenetrated.
   */
  const trySpawn = useCallback((): SpawnOutcome => {
    const currentAnchor = anchorRef.current;
    const world = worldRef.current;
    if (!currentAnchor || !world || !activeRef.current) return "full";
    const t = COPY_MACHINE_TUNING;

    // Pick a side: usually the opposite of the previous copy.
    const side =
      Math.random() < t.sameSideChance
        ? lastSideRef.current
        : -lastSideRef.current;
    const offset =
      side * between(t.spawnOffsetMin, t.spawnOffsetMax) * currentAnchor.width;
    const angle = side * between(t.spawnTiltMin, t.spawnTiltMax);

    const width = currentAnchor.width * t.copyScale;
    const height = currentAnchor.height * t.copyScale;
    const centerX = currentAnchor.x + currentAnchor.width / 2 + offset;
    const baseTop = currentAnchor.y + currentAnchor.height + t.spawnGap;
    const centerY = baseTop + currentAnchor.height / 2;

    const probe = createBody({
      id: -1,
      x: centerX,
      y: centerY,
      width,
      height,
      angle,
    });
    const extents = getBodyExtents(probe);
    const blocker = world.firstOverlap(centerX, centerY, extents.x, extents.y);
    if (blocker) {
      const speed = Math.hypot(blocker.vx, blocker.vy);
      return blocker.isStatic || speed < t.fullPileSpeed ? "full" : "busy";
    }

    lastSideRef.current = side;
    const id = nextBodyIdRef.current++;
    const body = createBody({
      id,
      x: centerX,
      y: centerY,
      width,
      height,
      angle,
      vx: side * between(t.spawnSideSpeedMin, t.spawnSideSpeedMax),
      vy: t.spawnDownSpeed,
      w: side * between(t.spawnSpinMin, t.spawnSpinMax),
    });
    world.add(body);

    const nextBodies = [...bodiesRef.current, body];
    bodiesRef.current = nextBodies;
    pushPoses(); // The sprite must have a valid pose before it mounts.
    setBodyCount(nextBodies.length);
    setSpawnedCount(nextBodies.length);
    if (nextBodies.length >= capacityRef.current) setCapacityReached(true);
    return "spawned";
  }, [pushPoses]);

  const schedulePhysics = useCallback(() => {
    if (rafRef.current != null || !activeRef.current) return;

    const frame = (now: number) => {
      rafRef.current = null;
      const world = worldRef.current;
      if (!activeRef.current || !world || phaseRef.current !== "active") {
        return;
      }

      // Release queued taps whose spawn slot has become free.
      while (pendingRef.current > 0) {
        const outcome = trySpawn();
        if (outcome === "spawned") {
          pendingRef.current -= 1;
        } else if (outcome === "full") {
          pendingRef.current = 0;
          setCapacityReached(true);
        } else {
          break;
        }
      }

      if (world.asleep) {
        if (pendingRef.current === 0) {
          // Nothing is moving and nothing is waiting: stop the loop.
          lastFrameTimeRef.current = 0;
          accumulatorRef.current = 0;
          pushPoses();
          return;
        }
      } else {
        const previous =
          lastFrameTimeRef.current || now - PHYSICS_TUNING.fixedStep * 1000;
        lastFrameTimeRef.current = now;
        accumulatorRef.current +=
          clamp(now - previous, 0, COPY_MACHINE_TUNING.maxFrameDeltaMs) / 1000;

        let steps = 0;
        while (
          accumulatorRef.current >= PHYSICS_TUNING.fixedStep &&
          steps < PHYSICS_TUNING.maxStepsPerFrame
        ) {
          world.step(PHYSICS_TUNING.fixedStep);
          accumulatorRef.current -= PHYSICS_TUNING.fixedStep;
          steps += 1;
        }
        if (steps === PHYSICS_TUNING.maxStepsPerFrame) {
          accumulatorRef.current = 0; // Drop the backlog instead of spiralling.
        }
        pushPoses();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [pushPoses, trySpawn]);

  const beginMeasurement = useCallback(
    async (
      rowRef: MeasurableRef,
      canvasRef: MeasurableRef,
      snapshot: Promise<SkImage | null>,
      runId: number,
    ) => {
      try {
        const [rowWindowRect, canvasWindowRect, rowImage] = await Promise.all([
          measureInWindow(rowRef),
          measureInWindow(canvasRef),
          snapshot,
        ]);
        if (runId !== runIdRef.current) return;
        if (!rowWindowRect || !canvasWindowRect || !rowImage) {
          console.warn(
            "[Copy Machine] Could not measure or snapshot the row/canvas.",
          );
          finishSession(runId);
          return;
        }

        const measuredAnchor: CopyAnchor = {
          x: rowWindowRect.x - canvasWindowRect.x,
          y: rowWindowRect.y - canvasWindowRect.y,
          width: rowWindowRect.width,
          height: rowWindowRect.height,
          canvasWidth: canvasWindowRect.width,
          canvasHeight: canvasWindowRect.height,
        };
        const t = COPY_MACHINE_TUNING;
        const copyHeight = measuredAnchor.height * t.copyScale;
        const spawnCenterY =
          measuredAnchor.y +
          measuredAnchor.height +
          t.spawnGap +
          measuredAnchor.height / 2;
        const floorY = measuredAnchor.canvasHeight - t.floorInset;
        const fallSpace = Math.max(0, floorY - (spawnCenterY + copyHeight / 2));
        capacityRef.current = clamp(
          Math.floor(fallSpace / copyHeight),
          1,
          t.maxCopiesHardLimit,
        );

        // Static floor: a very wide slab whose top face sits at floorY.
        const world = new PhysicsWorld();
        const slab = 400;
        world.add(
          createBody({
            id: 0,
            x: measuredAnchor.canvasWidth / 2,
            y: floorY + slab / 2,
            width: measuredAnchor.canvasWidth * 6,
            height: slab,
            isStatic: true,
            friction: 0.7,
          }),
        );
        worldRef.current = world;
        anchorRef.current = measuredAnchor;
        lastSideRef.current = Math.random() < 0.5 ? 1 : -1;
        setImage(rowImage);
        setCopySize({
          width: measuredAnchor.width * t.copyScale,
          height: measuredAnchor.height * t.copyScale,
        });
        setAnchor(measuredAnchor);
        phaseRef.current = "active";
        pendingRef.current = 1;
        schedulePhysics();
      } catch (error) {
        console.warn("[Copy Machine] Failed to prepare the pile.", error);
        finishSession(runId);
      }
    },
    [finishSession, schedulePhysics],
  );

  const press = useCallback(
    (
      rowRef: MeasurableRef,
      canvasRef: MeasurableRef,
      pressedResult: GlobalSearchResult,
      callbacks: PressCallbacks = {},
    ) => {
      if (phaseRef.current === "measuring" || phaseRef.current === "clearing")
        return;
      if (phaseRef.current === "active") {
        // Taps wait (briefly) for the spawn slot rather than overlapping it.
        const committed = bodiesRef.current.length + pendingRef.current;
        if (
          committed < capacityRef.current &&
          pendingRef.current < COPY_MACHINE_TUNING.maxPendingSpawns
        ) {
          pendingRef.current += 1;
          worldRef.current?.wake();
          schedulePhysics();
        }
        return;
      }

      activeRef.current = true;
      phaseRef.current = "measuring";
      runIdRef.current += 1;
      const runId = runIdRef.current;
      callbacksRef.current = callbacks;
      setResult(pressedResult);
      setActive(true);
      setCapacityReached(false);
      setSpawnedCount(0);
      nextBodyIdRef.current = 1;
      pendingRef.current = 0;
      bodiesRef.current = [];
      poses.value = [];
      clearProgress.value = 0;
      setBodyCount(0);

      // Snapshot before the first-press callback can change the row.
      const snapshot = snapshotRow(rowRef);

      try {
        callbacks.onFirstPress?.();
      } catch (error) {
        console.warn("[Copy Machine] First-press callback failed.", error);
        finishSession(runId);
        return;
      }

      void beginMeasurement(rowRef, canvasRef, snapshot, runId);
    },
    [beginMeasurement, clearProgress, finishSession, poses, schedulePhysics],
  );

  const clear = useCallback(() => {
    if (!activeRef.current || phaseRef.current !== "active") return;
    phaseRef.current = "clearing";
    stopPhysics();
    pendingRef.current = 0;
    const runId = runIdRef.current;
    if (bodiesRef.current.length === 0) {
      finishSession(runId);
      return;
    }
    // Fade runs on the UI thread; JS only waits to tear down afterwards.
    clearProgress.value = withTiming(1, {
      duration: COPY_MACHINE_TUNING.clearFadeMs,
      easing: Easing.out(Easing.quad),
    });
    clearTimerRef.current = setTimeout(
      () => finishSession(runId),
      COPY_MACHINE_TUNING.clearFadeMs + 40,
    );
  }, [clearProgress, finishSession, stopPhysics]);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    runIdRef.current += 1;
    finishSession(runIdRef.current);
  }, [finishSession]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      stopPhysics();
      if (clearTimerRef.current != null) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
      bodiesRef.current = [];
      worldRef.current = null;
      activeRef.current = false;
      phaseRef.current = null;
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    };
  }, [stopPhysics]);

  const accentColor =
    result?.document.kind === "easterEgg"
      ? (result.document.display.presentation?.accentColor ?? "#8A64D6")
      : "#8A64D6";

  const sprites: React.ReactNode[] = [];
  if (active && anchor && image) {
    for (let i = 0; i < bodyCount; i += 1) {
      sprites.push(
        <CopySprite
          key={i}
          index={i}
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
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 100,
          elevation: 100,
        },
      ]}
    >
      {active && image && (
        <Canvas
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}
        >
          {sprites}
        </Canvas>
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
    spawnedCount,
    layer,
  };
}

const styles = StyleSheet.create({
  clearButton: {
    position: "absolute",
    right: 18,
    bottom: 16,
    zIndex: 80,
    elevation: 80,
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
