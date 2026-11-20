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

type Rect = { x: number; y: number; width: number; height: number };
type MeasurableRef = React.RefObject<View | null>;
type CopyAnchor = Rect & { canvasWidth: number; canvasHeight: number };
type Phase = "measuring" | "active" | "clearing" | null;

type PressCallbacks = {
  onFirstPress?: () => void;
  onFinished?: () => void;
};

type CopyBody = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  width: number;
  height: number;
  mass: number;
  settled: boolean;
  translateX: Animated.Value;
  translateY: Animated.Value;
  rotation: Animated.Value;
  opacity: Animated.Value;
  baseCenterX: number;
  baseCenterY: number;
};

/**
 * The Copy Machine — lightweight rigid-body-inspired row duplication.
 *
 * Physics runs only while at least one copy is moving. It uses a fixed-step,
 * bounded O(n²) solver; the maximum body count is derived from the measured
 * free viewport height and additionally capped for predictable phone workload.
 * All visible movement is applied to native-driver transforms.
 */
export const COPY_MACHINE_TUNING = {
  // Composition
  copyScale: 0.92,
  spawnGap: 3,
  floorInset: 8,
  maxCopiesHardLimit: 10,

  // Physics (dp, seconds, radians)
  gravity: 2450,
  maxFrameDeltaMs: 50,
  fixedStepSeconds: 1 / 60,
  solverIterations: 3,
  airDampingPerFrame: 0.997,
  contactFriction: 0.72,
  floorFrictionPerFrame: 0.82,
  angularDampingPerFrame: 0.76,
  impactRestitutionMin: 0.025,
  impactRestitutionMax: 0.105,
  impactRestitutionSpeedScale: 0.000055,
  maxRotationRadians: 0.19, // About 10.9 degrees.
  maxAngularVelocity: 0.75,
  torqueFromOffCentreImpact: 0.0012,

  // Initial variation. Small deterministic differences avoid identical stacks.
  spawnHorizontalSpeed: 24,
  spawnAngularSpeed: 0.11,

  // Clear
  clearFadeMs: 190,
  clearLiftDp: 5,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

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

function getBodyExtents(body: CopyBody) {
  const cosine = Math.abs(Math.cos(body.angle));
  const sine = Math.abs(Math.sin(body.angle));
  return {
    x: (cosine * body.width + sine * body.height) / 2,
    y: (sine * body.width + cosine * body.height) / 2,
  };
}

function applyFloorContact(
  body: CopyBody,
  floorY: number,
  applyFriction: boolean,
) {
  const extents = getBodyExtents(body);
  const penetration = body.y + extents.y - floorY;
  const touchingFloor = penetration >= -1.5;
  if (!touchingFloor) return false;

  if (penetration > 0) body.y -= penetration;
  if (penetration > 0 && body.vy > 0) {
    const impactSpeed = body.vy;
    const restitution = clamp(
      COPY_MACHINE_TUNING.impactRestitutionMin +
        impactSpeed * COPY_MACHINE_TUNING.impactRestitutionSpeedScale,
      COPY_MACHINE_TUNING.impactRestitutionMin,
      COPY_MACHINE_TUNING.impactRestitutionMax,
    );
    body.vy = -impactSpeed * restitution;
  }

  if (applyFriction) {
    body.vx *= COPY_MACHINE_TUNING.floorFrictionPerFrame;
    body.angularVelocity *= COPY_MACHINE_TUNING.angularDampingPerFrame;
    if (Math.abs(body.vy) < 28) body.vy = 0;
    if (Math.abs(body.vx) < 3.5) body.vx = 0;
    if (Math.abs(body.angularVelocity) < 0.035) body.angularVelocity = 0;
  }
  return true;
}

function resolveBodyPair(a: CopyBody, b: CopyBody) {
  const aExtent = getBodyExtents(a);
  const bExtent = getBodyExtents(b);
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  const overlapX = aExtent.x + bExtent.x - Math.abs(deltaX);
  const overlapY = aExtent.y + bExtent.y - Math.abs(deltaY);
  if (overlapX <= 0 || overlapY <= 0) return false;

  const inverseMassA = a.settled ? 0 : 1 / a.mass;
  const inverseMassB = b.settled ? 0 : 1 / b.mass;
  const inverseMassTotal = inverseMassA + inverseMassB;
  if (inverseMassTotal <= 0) return true;

  // For these very wide, shallow cards, vertical contacts dominate. The
  // horizontal branch handles edge-to-edge contacts when a copy slides aside.
  if (overlapY <= overlapX) {
    // On an exact overlap, the newer body (b) is treated as the upper one.
    const normalY = deltaY > 0 ? 1 : -1;
    const moveA = overlapY * (inverseMassA / inverseMassTotal);
    const moveB = overlapY * (inverseMassB / inverseMassTotal);
    a.y -= normalY * moveA;
    b.y += normalY * moveB;

    const relativeNormalVelocity = (b.vy - a.vy) * normalY;
    if (relativeNormalVelocity < 0) {
      const pairRestitution = clamp(
        COPY_MACHINE_TUNING.impactRestitutionMin +
          Math.abs(relativeNormalVelocity) *
            COPY_MACHINE_TUNING.impactRestitutionSpeedScale,
        COPY_MACHINE_TUNING.impactRestitutionMin,
        COPY_MACHINE_TUNING.impactRestitutionMax,
      );
      const impulse =
        (-(1 + pairRestitution) * relativeNormalVelocity) / inverseMassTotal;
      if (!a.settled) a.vy -= impulse * normalY * inverseMassA;
      if (!b.settled) b.vy += impulse * normalY * inverseMassB;

      const relativeTangentVelocity = b.vx - a.vx;
      const tangentImpulse = clamp(
        (-relativeTangentVelocity * 0.14) / inverseMassTotal,
        -impulse * COPY_MACHINE_TUNING.contactFriction,
        impulse * COPY_MACHINE_TUNING.contactFriction,
      );
      if (!a.settled) a.vx -= tangentImpulse * inverseMassA;
      if (!b.settled) b.vx += tangentImpulse * inverseMassB;

      // A non-central hit adds a small turning moment, like a padded rigid bar.
      const contactOffset = clamp(a.x - b.x, -b.width * 0.42, b.width * 0.42);
      if (!b.settled) {
        b.angularVelocity +=
          (contactOffset / Math.max(1, b.width / 2)) *
          (impulse / Math.max(1, b.mass)) *
          COPY_MACHINE_TUNING.torqueFromOffCentreImpact;
      }
      if (!a.settled) {
        a.angularVelocity -=
          (contactOffset / Math.max(1, a.width / 2)) *
          (impulse / Math.max(1, a.mass)) *
          COPY_MACHINE_TUNING.torqueFromOffCentreImpact *
          0.22;
      }
    }
  } else {
    const normalX = deltaX >= 0 ? 1 : -1;
    a.x -= normalX * overlapX * (inverseMassA / inverseMassTotal);
    b.x += normalX * overlapX * (inverseMassB / inverseMassTotal);

    const relativeNormalVelocity = (b.vx - a.vx) * normalX;
    if (relativeNormalVelocity < 0) {
      const pairRestitution = clamp(
        COPY_MACHINE_TUNING.impactRestitutionMin +
          Math.abs(relativeNormalVelocity) *
            COPY_MACHINE_TUNING.impactRestitutionSpeedScale,
        COPY_MACHINE_TUNING.impactRestitutionMin,
        COPY_MACHINE_TUNING.impactRestitutionMax,
      );
      const impulse =
        (-(1 + pairRestitution) * relativeNormalVelocity) / inverseMassTotal;
      if (!a.settled) a.vx -= impulse * normalX * inverseMassA;
      if (!b.settled) b.vx += impulse * normalX * inverseMassB;
      if (!a.settled) a.vy *= 0.96;
      if (!b.settled) b.vy *= 0.96;
    }
  }

  return true;
}

function isSupported(body: CopyBody, bodies: CopyBody[], floorY: number) {
  const own = getBodyExtents(body);
  if (body.y + own.y >= floorY - 1.5) return true;

  for (const other of bodies) {
    if (other.id === body.id) continue;
    const theirs = getBodyExtents(other);
    const horizontalOverlap = own.x + theirs.x - Math.abs(body.x - other.x);
    const verticalGap = Math.abs(body.y + own.y - (other.y - theirs.y));
    if (horizontalOverlap > 8 && verticalGap < 3.5) return true;
  }
  return false;
}

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
  const [bodies, setBodies] = useState<CopyBody[]>([]);

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>(null);
  const runIdRef = useRef(0);
  const nextBodyIdRef = useRef(0);
  const bodiesRef = useRef<CopyBody[]>([]);
  const anchorRef = useRef<CopyAnchor | null>(null);
  const capacityRef = useRef(0);
  const callbacksRef = useRef<PressCallbacks>({});
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const clearAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const stopPhysics = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastFrameTimeRef.current = 0;
  }, []);

  const finishSession = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;
      stopPhysics();
      clearAnimationRef.current?.stop();
      clearAnimationRef.current = null;
      bodiesRef.current.forEach((body) => {
        body.translateX.stopAnimation();
        body.translateY.stopAnimation();
        body.rotation.stopAnimation();
        body.opacity.stopAnimation();
      });
      bodiesRef.current = [];
      anchorRef.current = null;
      activeRef.current = false;
      phaseRef.current = null;
      capacityRef.current = 0;
      setBodies([]);
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

  const schedulePhysics = useCallback(() => {
    if (rafRef.current != null || !activeRef.current) return;

    const frame = (now: number) => {
      rafRef.current = null;
      if (!activeRef.current) return;

      const currentAnchor = anchorRef.current;
      const currentBodies = bodiesRef.current;
      if (!currentAnchor || currentBodies.length === 0) return;

      const previous = lastFrameTimeRef.current || now;
      const elapsedMs = clamp(
        now - previous,
        0,
        COPY_MACHINE_TUNING.maxFrameDeltaMs,
      );
      lastFrameTimeRef.current = now;
      const elapsedSeconds = elapsedMs / 1000;
      const stepCount = Math.max(
        1,
        Math.ceil(elapsedSeconds / COPY_MACHINE_TUNING.fixedStepSeconds),
      );
      const step = elapsedSeconds / stepCount;
      const floorY =
        currentAnchor.canvasHeight - COPY_MACHINE_TUNING.floorInset;

      for (let substep = 0; substep < stepCount; substep += 1) {
        // Integrate free motion. Settled bodies are cheap static supports until
        // a moving copy collides with them.
        for (const body of currentBodies) {
          if (body.settled) continue;
          body.vy += COPY_MACHINE_TUNING.gravity * step;
          body.vx *= Math.pow(
            COPY_MACHINE_TUNING.airDampingPerFrame,
            step * 60,
          );
          body.angularVelocity *= Math.pow(
            COPY_MACHINE_TUNING.airDampingPerFrame,
            step * 60,
          );
          body.x += body.vx * step;
          body.y += body.vy * step;
          body.angle = clamp(
            body.angle + body.angularVelocity * step,
            -COPY_MACHINE_TUNING.maxRotationRadians,
            COPY_MACHINE_TUNING.maxRotationRadians,
          );
          body.angularVelocity = clamp(
            body.angularVelocity,
            -COPY_MACHINE_TUNING.maxAngularVelocity,
            COPY_MACHINE_TUNING.maxAngularVelocity,
          );
        }

        // A few inexpensive constraint passes are enough for this intentionally
        // small pile. Older copies are visited first and act as stable supports.
        for (
          let iteration = 0;
          iteration < COPY_MACHINE_TUNING.solverIterations;
          iteration += 1
        ) {
          for (let i = 0; i < currentBodies.length; i += 1) {
            for (let j = i + 1; j < currentBodies.length; j += 1) {
              resolveBodyPair(currentBodies[i], currentBodies[j]);
            }
          }
          for (const body of currentBodies) {
            applyFloorContact(
              body,
              floorY,
              iteration === COPY_MACHINE_TUNING.solverIterations - 1,
            );
          }
        }

        for (const body of currentBodies) {
          if (body.settled) continue;
          const supported = isSupported(body, currentBodies, floorY);
          if (
            supported &&
            Math.abs(body.vx) < 5.5 &&
            Math.abs(body.vy) < 17 &&
            Math.abs(body.angularVelocity) < 0.045
          ) {
            body.vx = 0;
            body.vy = 0;
            body.angularVelocity = 0;
            body.settled = true;
          }
        }
      }

      let anyMoving = false;
      for (const body of currentBodies) {
        body.translateX.setValue(body.x - body.baseCenterX);
        body.translateY.setValue(body.y - body.baseCenterY);
        body.rotation.setValue(body.angle);
        if (!body.settled) anyMoving = true;
      }

      if (anyMoving) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        lastFrameTimeRef.current = 0;
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const spawnCopy = useCallback(() => {
    const currentAnchor = anchorRef.current;
    if (!currentAnchor || !activeRef.current) return;
    const currentBodies = bodiesRef.current;
    if (currentBodies.length >= capacityRef.current) return;

    const index = nextBodyIdRef.current++;
    const scale = COPY_MACHINE_TUNING.copyScale;
    const width = currentAnchor.width * scale;
    const height = currentAnchor.height * scale;
    const baseCenterX = currentAnchor.x + currentAnchor.width / 2;
    const baseTop =
      currentAnchor.y + currentAnchor.height + COPY_MACHINE_TUNING.spawnGap;
    const baseCenterY = baseTop + currentAnchor.height / 2;
    const mass = Math.max(1, (width * height) / 9000);

    const body: CopyBody = {
      id: index,
      x: baseCenterX,
      y: baseCenterY,
      vx: Math.cos(index * 1.31) * COPY_MACHINE_TUNING.spawnHorizontalSpeed,
      vy: 0,
      angle: 0,
      angularVelocity:
        Math.sin(index * 1.73) * COPY_MACHINE_TUNING.spawnAngularSpeed,
      width,
      height,
      mass,
      settled: false,
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      rotation: new Animated.Value(0),
      opacity: new Animated.Value(1),
      baseCenterX,
      baseCenterY,
    };

    const nextBodies = [...currentBodies, body];
    bodiesRef.current = nextBodies;
    setBodies(nextBodies);
    setSpawnedCount(nextBodies.length);

    if (nextBodies.length >= capacityRef.current) setCapacityReached(true);
    schedulePhysics();
  }, [schedulePhysics]);

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

        const localRow = {
          x: rowWindowRect.x - canvasWindowRect.x,
          y: rowWindowRect.y - canvasWindowRect.y,
          width: rowWindowRect.width,
          height: rowWindowRect.height,
        };
        const measuredAnchor: CopyAnchor = {
          ...localRow,
          canvasWidth: canvasWindowRect.width,
          canvasHeight: canvasWindowRect.height,
        };
        const scale = COPY_MACHINE_TUNING.copyScale;
        const copyHeight = measuredAnchor.height * scale;
        const spawnCenterY =
          measuredAnchor.y +
          measuredAnchor.height +
          COPY_MACHINE_TUNING.spawnGap +
          measuredAnchor.height / 2;
        const floorY =
          measuredAnchor.canvasHeight - COPY_MACHINE_TUNING.floorInset;
        const fallSpace = Math.max(0, floorY - (spawnCenterY + copyHeight / 2));
        const viewportCapacity = Math.floor(fallSpace / (copyHeight * 0.86));
        capacityRef.current = clamp(
          viewportCapacity,
          1,
          COPY_MACHINE_TUNING.maxCopiesHardLimit,
        );

        anchorRef.current = measuredAnchor;
        setAnchor(measuredAnchor);
        phaseRef.current = "active";
        spawnCopy();
      } catch (error) {
        console.warn("[Copy Machine] Failed to prepare the pile.", error);
        finishSession(runId);
      }
    },
    [finishSession, spawnCopy],
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
        // Every accepted press creates one copy immediately; taps are not queued.
        if (bodiesRef.current.length < capacityRef.current) spawnCopy();
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
      nextBodyIdRef.current = 0;
      bodiesRef.current = [];
      setBodies([]);

      try {
        callbacks.onFirstPress?.();
      } catch (error) {
        console.warn("[Copy Machine] First-press callback failed.", error);
        finishSession(runId);
        return;
      }

      void beginMeasurement(rowRef, canvasRef, runId);
    },
    [beginMeasurement, finishSession, spawnCopy],
  );

  const clear = useCallback(() => {
    if (!activeRef.current || phaseRef.current !== "active") return;
    phaseRef.current = "clearing";
    stopPhysics();
    const runId = runIdRef.current;
    const currentBodies = bodiesRef.current;
    if (currentBodies.length === 0) {
      finishSession(runId);
      return;
    }

    const animations = currentBodies.map((body) =>
      Animated.parallel([
        Animated.timing(body.opacity, {
          toValue: 0,
          duration: COPY_MACHINE_TUNING.clearFadeMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(body.translateY, {
          toValue: body.y - body.baseCenterY + COPY_MACHINE_TUNING.clearLiftDp,
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
      bodiesRef.current.forEach((body) => {
        body.translateX.stopAnimation();
        body.translateY.stopAnimation();
        body.rotation.stopAnimation();
        body.opacity.stopAnimation();
      });
      bodiesRef.current = [];
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
        bodies.map((body) => {
          const rotation = body.rotation.interpolate({
            inputRange: [-Math.PI, Math.PI],
            outputRange: ["-180deg", "180deg"],
          });
          return (
            <Animated.View
              key={body.id}
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: "absolute",
                left: anchor.x,
                top: baseTop,
                width: anchor.width,
                height: anchor.height,
                opacity: body.opacity,
                transform: [
                  { translateX: body.translateX },
                  { translateY: body.translateY },
                  { rotate: rotation },
                  { scale: COPY_MACHINE_TUNING.copyScale },
                ],
              }}
            >
              <GlobalSearchEasterEggRow
                result={result}
                activationEnabled={true}
                onPress={() => undefined}
              />
            </Animated.View>
          );
        })}

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
