import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Picture } from "@shopify/react-native-skia";

import {
  createFractureModel,
  extendFractureModel,
  type FractureModel,
} from "./fracture-engine";
import { createFracturePicture } from "./fracture-skia-renderer";

type RowRef = React.RefObject<View | null>;
type CanvasRef = React.RefObject<View | null>;
type Rect = { x: number; y: number; width: number; height: number };
type CanvasSize = { width: number; height: number };

function measureRowInCanvas(
  rowRef: RowRef,
  canvasRef: CanvasRef,
): Promise<Rect | null> {
  return new Promise((resolve) => {
    const row = rowRef.current as
      | (View & {
          measureLayout?: (
            relativeTo: View,
            onSuccess: (
              x: number,
              y: number,
              width: number,
              height: number,
            ) => void,
            onFail: () => void,
          ) => void;
        })
      | null;
    const canvas = canvasRef.current;

    if (!row || !canvas || typeof row.measureLayout !== "function") {
      resolve(null);
      return;
    }

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = (rect: Rect | null) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(rect);
    };
    timeout = setTimeout(() => finish(null), 450);

    try {
      row.measureLayout(
        canvas,
        (x, y, width, height) => finish({ x, y, width, height }),
        () => finish(null),
      );
    } catch {
      finish(null);
    }
  });
}

export interface BreakingPointPressOptions {
  /** Called once, on the first accepted impact in the sequence. */
  onFirstAccepted?: () => void;
}

export interface BreakingPointEasterEggController {
  /** Adds one cumulative impact at the horizontal point touched on the row. */
  press: (
    rowRef: RowRef,
    canvasRef: CanvasRef,
    normalizedX: number,
    options?: BreakingPointPressOptions,
  ) => Promise<boolean>;
  /** Clears this test sequence. Call when the search modal is dismissed. */
  cancel: () => void;
  /** Full-screen, pointer-transparent crack layer. */
  overlayLayer: React.ReactNode;
  stage: number;
}

/**
 * Iteration 1 is deliberately focused on the real cumulative crack renderer.
 * The final 13-shard capture/reverse sequence is a separate implementation step.
 */
export function useBreakingPointEasterEgg(): BreakingPointEasterEggController {
  const [model, setModel] = useState<FractureModel | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0,
  });
  const canvasSizeRef = useRef<CanvasSize>({ width: 0, height: 0 });
  const modelRef = useRef<FractureModel | null>(null);
  const stageRef = useRef(0);
  const busyRef = useRef(false);
  const runIdRef = useRef(0);

  const handleCanvasLayout = useCallback((width: number, height: number) => {
    const next = { width, height };
    canvasSizeRef.current = next;
    setCanvasSize((previous) =>
      previous.width === width && previous.height === height ? previous : next,
    );
  }, []);

  const press = useCallback(
    async (
      rowRef: RowRef,
      canvasRef: CanvasRef,
      normalizedX: number,
      options?: BreakingPointPressOptions,
    ) => {
      if (busyRef.current || stageRef.current >= 3) return false;

      busyRef.current = true;
      const runId = runIdRef.current;
      try {
        const rowRect = await measureRowInCanvas(rowRef, canvasRef);
        if (runId !== runIdRef.current) return false;

        const size = canvasSizeRef.current;
        if (!rowRect || size.width <= 0 || size.height <= 0) {
          console.warn(
            "[Breaking Point] Could not measure the search row or animation canvas.",
          );
          return false;
        }

        const nextStage = stageRef.current + 1;
        const anchor = {
          x: rowRect.x + rowRect.width * Math.max(0, Math.min(1, normalizedX)),
          y: rowRect.y + rowRect.height * 0.5,
        };

        const nextModel = modelRef.current
          ? extendFractureModel(modelRef.current, anchor)
          : createFractureModel(size.width, size.height, anchor);

        if (runId !== runIdRef.current) return false;

        modelRef.current = nextModel;
        stageRef.current = nextStage;
        setModel(nextModel);

        if (nextStage === 1) options?.onFirstAccepted?.();
        return true;
      } finally {
        if (runId === runIdRef.current) busyRef.current = false;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    runIdRef.current++;
    busyRef.current = false;
    stageRef.current = 0;
    modelRef.current = null;
    setModel(null);
  }, []);

  const picture = useMemo(
    () => (model ? createFracturePicture(model) : null),
    [model],
  );

  const overlayLayer = (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 100,
          elevation: 100,
        },
      ]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        handleCanvasLayout(width, height);
      }}
    >
      {picture && canvasSize.width > 0 && canvasSize.height > 0 && (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      )}
    </View>
  );

  return { press, cancel, overlayLayer, stage: model?.stage ?? 0 };
}
