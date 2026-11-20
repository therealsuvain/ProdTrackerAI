import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
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
  pointInBody,
  type PhysicsBody,
} from "./copy-machine-physics-v2";

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
  maxCopiesHardLimit: 10,

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

  // Arena: invisible walls/ceiling so thrown rows stay in play. The margin is
  // a fraction of canvas width beyond each side; it must stay larger than how
  // far a spawned (offset) copy overhangs the screen edge (~0.16).
  wallMargin: 0.3,
  ceilingMargin: 300, // dp above the canvas top

  // Throwing
  throwMinSpeed: 120, // dp/s; slower releases just drop
  throwMaxSpeed: 4500, // dp/s
  throwScale: 1,
  velocityWindowMs: 100, // finger samples used for the flick velocity
  staleReleaseMs: 80, // finger paused this long before release = no flick

  // Touch surface refresh while the pile moves
  touchRectRefreshMs: 100,
  touchRectPadding: 10,

  // Clear
  clearFadeMs: 190,
  clearLiftDp: 5,
};

const POSE_STRIDE = 3; // x, y, angle per body

// Body ids: 0 floor, 1 left wall, 2 right wall, 3 ceiling, copies from 4.
const FIRST_COPY_ID = 4;

type TouchStore = {
  rect: Rect | null;
  listeners: Set<() => void>;
};

type DragSession = {
  body: PhysicsBody;
  startX: number;
  startY: number;
  samples: { t: number; x: number; y: number }[];
};

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
  // The pose array can be empty/short for a frame while a session is being
  // torn down (the sprite is still mounted). Native transforms reject
  // undefined, so every read falls back to a number and the sprite hides.
  const transform = useDerivedValue(() => {
    const p = poses.value;
    const o = index * POSE_STRIDE;
    return [
      { translateX: p[o] ?? 0 },
      {
        translateY:
          (p[o + 1] ?? 0) +
          clearProgress.value * COPY_MACHINE_TUNING.clearLiftDp,
      },
      { rotate: p[o + 2] ?? 0 },
    ];
  });
  const opacity = useDerivedValue(() =>
    poses.value.length > index * POSE_STRIDE + 2 ? 1 - clearProgress.value : 0,
  );

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

/**
 * Invisible touch surface sized to the pile (not the whole screen), so the
 * rest of the screen keeps working. It lives in its own component with its own
 * state, so refreshing its rectangle never re-renders the host screen.
 */
const PileTouchLayer = React.memo(function PileTouchLayer({
  store,
  panHandlers,
}: {
  store: TouchStore;
  panHandlers: object;
}) {
  const [rect, setRect] = useState<Rect | null>(store.rect);
  useEffect(() => {
    const listener = () => setRect(store.rect);
    store.listeners.add(listener);
    listener();
    return () => {
      store.listeners.delete(listener);
    };
  }, [store]);
  if (!rect) return null;
  return (
    <View
      {...panHandlers}
      accessible={false}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
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
  const nextBodyIdRef = useRef(FIRST_COPY_ID);
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
  const dragRef = useRef<DragSession | null>(null);
  const touchStoreRef = useRef<TouchStore>({
    rect: null,
    listeners: new Set(),
  });
  const lastRectRefreshRef = useRef(0);

  const stopPhysics = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastFrameTimeRef.current = 0;
    accumulatorRef.current = 0;
  }, []);

  /** Sizes the touch surface to the pile's bounds (clamped to the canvas). */
  const refreshTouchRect = useCallback(() => {
    const store = touchStoreRef.current;
    const currentAnchor = anchorRef.current;
    const bodies = bodiesRef.current;
    let next: Rect | null = null;
    if (currentAnchor && bodies.length > 0) {
      const pad = COPY_MACHINE_TUNING.touchRectPadding;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const body of bodies) {
        const e = getBodyExtents(body);
        minX = Math.min(minX, body.x - e.x);
        maxX = Math.max(maxX, body.x + e.x);
        minY = Math.min(minY, body.y - e.y);
        maxY = Math.max(maxY, body.y + e.y);
      }
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(currentAnchor.canvasWidth, maxX + pad);
      maxY = Math.min(currentAnchor.canvasHeight, maxY + pad);
      if (maxX > minX && maxY > minY) {
        next = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }
    const prev = store.rect;
    const same =
      prev === next ||
      (prev != null &&
        next != null &&
        Math.abs(prev.x - next.x) < 1 &&
        Math.abs(prev.y - next.y) < 1 &&
        Math.abs(prev.width - next.width) < 1 &&
        Math.abs(prev.height - next.height) < 1);
    if (same) return;
    store.rect = next;
    store.listeners.forEach((listener) => listener());
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
      dragRef.current = null;
      refreshTouchRect(); // bodies and anchor are gone, so this hides it
      // Leave `poses` alone: the sprites are still mounted until the state
      // updates below render, and the next press resets it anyway.
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
    [clearProgress, poses, refreshTouchRect, stopPhysics],
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
    refreshTouchRect();
    return "spawned";
  }, [pushPoses, refreshTouchRect]);

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
          refreshTouchRect();
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
        // Keep the touch surface following the pile, but not while a finger
        // is down (the surface must not move under an active gesture).
        if (
          !dragRef.current &&
          now - lastRectRefreshRef.current >=
            COPY_MACHINE_TUNING.touchRectRefreshMs
        ) {
          lastRectRefreshRef.current = now;
          refreshTouchRect();
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [pushPoses, refreshTouchRect, trySpawn]);

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

        // Static arena: floor, two side walls and a ceiling, all thick slabs
        // whose inner faces bound the play area. The walls sit well outside
        // the screen so offset spawns can hang past the edge.
        const world = new PhysicsWorld();
        const slab = 400;
        const w = measuredAnchor.canvasWidth;
        const margin = w * t.wallMargin;
        const top = -t.ceilingMargin;
        const bottom = floorY + slab;
        world.add(
          createBody({
            id: 0,
            x: w / 2,
            y: floorY + slab / 2,
            width: w * 6,
            height: slab,
            isStatic: true,
            friction: 0.7,
          }),
        );
        world.add(
          createBody({
            id: 1,
            x: -margin - slab / 2,
            y: (top + bottom) / 2,
            width: slab,
            height: bottom - top,
            isStatic: true,
            friction: 0.3,
          }),
        );
        world.add(
          createBody({
            id: 2,
            x: w + margin + slab / 2,
            y: (top + bottom) / 2,
            width: slab,
            height: bottom - top,
            isStatic: true,
            friction: 0.3,
          }),
        );
        world.add(
          createBody({
            id: 3,
            x: w / 2,
            y: top - slab / 2,
            width: w + 2 * margin + 2 * slab,
            height: slab,
            isStatic: true,
            friction: 0.3,
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
      nextBodyIdRef.current = FIRST_COPY_ID;
      pendingRef.current = 0;
      bodiesRef.current = [];
      dragRef.current = null;
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

  // --- Dragging and throwing -------------------------------------------------

  /** Topmost copy under the point (later copies are drawn on top). */
  const pickBody = useCallback((x: number, y: number) => {
    const bodies = bodiesRef.current;
    for (let i = bodies.length - 1; i >= 0; i -= 1) {
      if (pointInBody(bodies[i], x, y)) return bodies[i];
    }
    return null;
  }, []);

  /** Touch position in canvas coordinates (the surface is pile-sized). */
  const touchPoint = useCallback((evt: GestureResponderEvent) => {
    const rect = touchStoreRef.current.rect;
    if (!rect) return null;
    return {
      x: rect.x + evt.nativeEvent.locationX,
      y: rect.y + evt.nativeEvent.locationY,
    };
  }, []);

  const releaseDrag = useCallback(
    (evt: GestureResponderEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const world = worldRef.current;
      if (!drag || !world) return;
      const t = COPY_MACHINE_TUNING;

      // Flick velocity from the finger samples of the last ~100 ms. A finger
      // that paused before lifting means "drop", not "throw".
      const releaseAt = evt.nativeEvent.timestamp;
      const all = drag.samples;
      const last = all[all.length - 1];
      let vx = 0;
      let vy = 0;
      if (releaseAt - last.t <= t.staleReleaseMs) {
        const recent = all.filter((s) => s.t >= last.t - t.velocityWindowMs);
        const first = recent[0];
        const dtMs = last.t - first.t;
        if (recent.length >= 2 && dtMs >= 8) {
          vx = ((last.x - first.x) / dtMs) * 1000 * t.throwScale;
          vy = ((last.y - first.y) / dtMs) * 1000 * t.throwScale;
        }
      }
      const speed = Math.hypot(vx, vy);
      if (speed > t.throwMaxSpeed) {
        vx *= t.throwMaxSpeed / speed;
        vy *= t.throwMaxSpeed / speed;
      }
      if (speed >= t.throwMinSpeed) world.endDrag(vx, vy);
      else world.endDrag();
      schedulePhysics();
    },
    [schedulePhysics],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          if (phaseRef.current !== "active" || !worldRef.current) return false;
          const p = touchPoint(evt);
          return p != null && pickBody(p.x, p.y) != null;
        },
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const world = worldRef.current;
          const p = touchPoint(evt);
          if (!world || !p) return;
          const body = pickBody(p.x, p.y);
          if (!body) return;
          dragRef.current = {
            body,
            startX: p.x,
            startY: p.y,
            samples: [{ t: evt.nativeEvent.timestamp, x: p.x, y: p.y }],
          };
          world.beginDrag(body, p.x, p.y);
          schedulePhysics();
        },
        onPanResponderMove: (
          evt: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const drag = dragRef.current;
          const world = worldRef.current;
          const currentAnchor = anchorRef.current;
          if (!drag || !world || !currentAnchor) return;
          const x = clamp(
            drag.startX + gesture.dx,
            0,
            currentAnchor.canvasWidth,
          );
          const y = clamp(
            drag.startY + gesture.dy,
            0,
            currentAnchor.canvasHeight,
          );
          world.dragTo(x, y);
          const now = evt.nativeEvent.timestamp;
          drag.samples.push({ t: now, x, y });
          const cutoff = now - COPY_MACHINE_TUNING.velocityWindowMs * 2;
          while (drag.samples.length > 2 && drag.samples[0].t < cutoff) {
            drag.samples.shift();
          }
          schedulePhysics();
        },
        onPanResponderRelease: releaseDrag,
        onPanResponderTerminate: releaseDrag,
      }),
    [pickBody, releaseDrag, schedulePhysics, touchPoint],
  );

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      dragRef.current = null;
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
        // The wrapper, not the Canvas, must swallow pointer events: a Skia
        // Canvas can otherwise sit on top and block taps on the row below,
        // which stops further presses from reaching it.
        <View
          pointerEvents="none"
          accessible={false}
          style={StyleSheet.absoluteFill}
        >
          <Canvas style={StyleSheet.absoluteFill}>{sprites}</Canvas>
        </View>
      )}

      {active && image && (
        <PileTouchLayer
          store={touchStoreRef.current}
          panHandlers={panResponder.panHandlers}
        />
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
