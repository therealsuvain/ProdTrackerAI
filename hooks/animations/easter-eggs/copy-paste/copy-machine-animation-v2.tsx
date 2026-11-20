import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { GlobalSearchResult } from "@/types/global-search";
import { GlobalSearchEasterEggRow } from "@/components/ui/global-search/search-result-row-easter-egg";
import {
  PHYSICS_TUNING,
  PhysicsWorld,
  createBody,
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

/** A physics body plus the native-driven values that draw it. */
type CopyVisual = {
  id: number;
  body: PhysicsBody;
  translateX: Animated.Value;
  translateY: Animated.Value;
  rotation: Animated.Value;
  opacity: Animated.Value;
  rotate: Animated.AnimatedInterpolation<string>;
  baseCenterX: number;
  baseCenterY: number;
};

/**
 * The Copy Machine: pressing the row ejects a smaller copy that drops and
 * lands as a real rigid body (see copy-machine-physics.ts).
 *
 * Performance notes
 *  - The simulation loop stops as soon as the whole pile is asleep, so a
 *    resting pile costs nothing.
 *  - Each copy is a memoized view; spawning one more copy does not re-render
 *    the existing ones, and the loop only pushes three native values per body.
 *  - Copies are rasterized once, so moving them is just a texture transform.
 */
export const COPY_MACHINE_TUNING = {
  // Composition
  copyScale: 0.92,
  spawnGap: 3,
  floorInset: 8,
  maxCopiesHardLimit: 10,

  // Spawn
  spawnDownSpeed: 600, // The "ejected from the copier" kick, dp/s.
  spawnHorizontalSpeed: 24,
  spawnAngularSpeed: 0.11,
  maxPendingSpawns: 3, // Taps queued while the spawn point is still occupied.
  fullPileSpeed: 30, // A blocker slower than this means the pile is full.

  // Loop
  maxFrameDeltaMs: 50,

  // Rendering
  rasterizeCopies: true,

  // Clear
  clearFadeMs: 190,
  clearLiftDp: 5,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const wrapAngle = (angle: number) => {
  const twoPi = Math.PI * 2;
  return ((((angle + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
};

const noop = () => undefined;

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

function stopVisual(visual: CopyVisual) {
  visual.translateX.stopAnimation();
  visual.translateY.stopAnimation();
  visual.rotation.stopAnimation();
  visual.opacity.stopAnimation();
}

const CopyView = React.memo(function CopyView({
  visual,
  anchor,
  baseTop,
  result,
}: {
  visual: CopyVisual;
  anchor: CopyAnchor;
  baseTop: number;
  result: GlobalSearchResult;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      renderToHardwareTextureAndroid={COPY_MACHINE_TUNING.rasterizeCopies}
      shouldRasterizeIOS={COPY_MACHINE_TUNING.rasterizeCopies}
      style={{
        position: "absolute",
        left: anchor.x,
        top: baseTop,
        width: anchor.width,
        height: anchor.height,
        opacity: visual.opacity,
        transform: [
          { translateX: visual.translateX },
          { translateY: visual.translateY },
          { rotate: visual.rotate },
          { scale: COPY_MACHINE_TUNING.copyScale },
        ],
      }}
    >
      <GlobalSearchEasterEggRow
        result={result}
        activationEnabled={true}
        onPress={noop}
      />
    </Animated.View>
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
  const [visuals, setVisuals] = useState<CopyVisual[]>([]);

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>(null);
  const runIdRef = useRef(0);
  const nextBodyIdRef = useRef(1); // id 0 is the floor
  const visualsRef = useRef<CopyVisual[]>([]);
  const worldRef = useRef<PhysicsWorld | null>(null);
  const anchorRef = useRef<CopyAnchor | null>(null);
  const capacityRef = useRef(0);
  const pendingRef = useRef(0);
  const accumulatorRef = useRef(0);
  const callbacksRef = useRef<PressCallbacks>({});
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const clearAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

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
      clearAnimationRef.current?.stop();
      clearAnimationRef.current = null;
      visualsRef.current.forEach(stopVisual);
      visualsRef.current = [];
      worldRef.current = null;
      anchorRef.current = null;
      activeRef.current = false;
      phaseRef.current = null;
      capacityRef.current = 0;
      pendingRef.current = 0;
      setVisuals([]);
      setAnchor(null);
      setResult(null);
      setActive(false);
      setCapacityReached(false);
      setSpawnedCount(0);
      const callback = callbacksRef.current.onFinished;
      callbacksRef.current = {};
      callback?.();
    },
    [stopPhysics],
  );

  const pushTransforms = useCallback(() => {
    for (const visual of visualsRef.current) {
      const { body } = visual;
      visual.translateX.setValue(body.x - visual.baseCenterX);
      visual.translateY.setValue(body.y - visual.baseCenterY);
      visual.rotation.setValue(wrapAngle(body.angle));
    }
  }, []);

  /**
   * Tries to eject one copy. A new copy only appears when its spawn slot is
   * free, so bodies never start interpenetrated (which is what makes a
   * solver explode or fidget).
   */
  const trySpawn = useCallback((): SpawnOutcome => {
    const currentAnchor = anchorRef.current;
    const world = worldRef.current;
    if (!currentAnchor || !world || !activeRef.current) return "full";

    const scale = COPY_MACHINE_TUNING.copyScale;
    const width = currentAnchor.width * scale;
    const height = currentAnchor.height * scale;
    const baseCenterX = currentAnchor.x + currentAnchor.width / 2;
    const baseTop =
      currentAnchor.y + currentAnchor.height + COPY_MACHINE_TUNING.spawnGap;
    const baseCenterY = baseTop + currentAnchor.height / 2;

    const blocker = world.firstOverlap(
      baseCenterX,
      baseCenterY,
      width / 2,
      height / 2,
    );
    if (blocker) {
      const speed = Math.hypot(blocker.vx, blocker.vy);
      return blocker.isStatic ||
        speed < COPY_MACHINE_TUNING.fullPileSpeed
        ? "full"
        : "busy";
    }

    const index = nextBodyIdRef.current++;
    const body = createBody({
      id: index,
      x: baseCenterX,
      y: baseCenterY,
      width,
      height,
      vx: Math.cos(index * 1.31) * COPY_MACHINE_TUNING.spawnHorizontalSpeed,
      vy: COPY_MACHINE_TUNING.spawnDownSpeed,
      w: Math.sin(index * 1.73) * COPY_MACHINE_TUNING.spawnAngularSpeed,
    });
    world.add(body);

    const rotation = new Animated.Value(0);
    const visual: CopyVisual = {
      id: index,
      body,
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      rotation,
      opacity: new Animated.Value(1),
      rotate: rotation.interpolate({
        inputRange: [-Math.PI, Math.PI],
        outputRange: ["-180deg", "180deg"],
      }),
      baseCenterX,
      baseCenterY,
    };

    const next = [...visualsRef.current, visual];
    visualsRef.current = next;
    setVisuals(next);
    setSpawnedCount(next.length);
    if (next.length >= capacityRef.current) setCapacityReached(true);
    return "spawned";
  }, []);

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
        // Nothing is moving and nothing is waiting: stop the loop entirely.
        if (pendingRef.current === 0) {
          lastFrameTimeRef.current = 0;
          accumulatorRef.current = 0;
          pushTransforms();
          return;
        }
      } else {
        const previous =
          lastFrameTimeRef.current ||
          now - PHYSICS_TUNING.fixedStep * 1000;
        lastFrameTimeRef.current = now;
        accumulatorRef.current += clamp(
          now - previous,
          0,
          COPY_MACHINE_TUNING.maxFrameDeltaMs,
        ) / 1000;

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
        pushTransforms();
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [pushTransforms, trySpawn]);

  const beginMeasurement = useCallback(
    async (rowRef: MeasurableRef, canvasRef: MeasurableRef, runId: number) => {
      try {
        const [rowWindowRect, canvasWindowRect] = await Promise.all([
          measureInWindow(rowRef),
          measureInWindow(canvasRef),
        ]);
        if (runId !== runIdRef.current) return;
        if (!rowWindowRect || !canvasWindowRect) {
          console.warn("[Copy Machine] Could not measure the row/canvas.");
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
        const copyHeight = measuredAnchor.height * COPY_MACHINE_TUNING.copyScale;
        const spawnCenterY =
          measuredAnchor.y +
          measuredAnchor.height +
          COPY_MACHINE_TUNING.spawnGap +
          measuredAnchor.height / 2;
        const floorY =
          measuredAnchor.canvasHeight - COPY_MACHINE_TUNING.floorInset;
        const fallSpace = Math.max(0, floorY - (spawnCenterY + copyHeight / 2));
        capacityRef.current = clamp(
          Math.floor(fallSpace / copyHeight),
          1,
          COPY_MACHINE_TUNING.maxCopiesHardLimit,
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
        const committed = visualsRef.current.length + pendingRef.current;
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
      visualsRef.current = [];
      setVisuals([]);

      try {
        callbacks.onFirstPress?.();
      } catch (error) {
        console.warn("[Copy Machine] First-press callback failed.", error);
        finishSession(runId);
        return;
      }

      void beginMeasurement(rowRef, canvasRef, runId);
    },
    [beginMeasurement, finishSession, schedulePhysics],
  );

  const clear = useCallback(() => {
    if (!activeRef.current || phaseRef.current !== "active") return;
    phaseRef.current = "clearing";
    stopPhysics();
    pendingRef.current = 0;
    const runId = runIdRef.current;
    const current = visualsRef.current;
    if (current.length === 0) {
      finishSession(runId);
      return;
    }

    const animations = current.map((visual) =>
      Animated.parallel([
        Animated.timing(visual.opacity, {
          toValue: 0,
          duration: COPY_MACHINE_TUNING.clearFadeMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(visual.translateY, {
          toValue:
            visual.body.y -
            visual.baseCenterY +
            COPY_MACHINE_TUNING.clearLiftDp,
          duration: COPY_MACHINE_TUNING.clearFadeMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    clearAnimationRef.current = Animated.parallel(animations);
    clearAnimationRef.current.start(({ finished }) => {
      if (finished) finishSession(runId);
    });
  }, [finishSession, stopPhysics]);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    runIdRef.current += 1;
    finishSession(runIdRef.current);
  }, [finishSession]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      stopPhysics();
      clearAnimationRef.current?.stop();
      clearAnimationRef.current = null;
      visualsRef.current.forEach(stopVisual);
      visualsRef.current = [];
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
  const baseTop = anchor
    ? anchor.y + anchor.height + COPY_MACHINE_TUNING.spawnGap
    : 0;

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
      {active &&
        anchor &&
        result &&
        visuals.map((visual) => (
          <CopyView
            key={visual.id}
            visual={visual}
            anchor={anchor}
            baseTop={baseTop}
            result={result}
          />
        ))}

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
