import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import {
  BlurMask,
  Canvas,
  makeImageFromView,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  usePathValue,
  type SkImage,
} from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
  useDerivedValue,
  type SharedValue,
} from "react-native-reanimated";
import type { RefObject } from "react";

type Rect = { x: number; y: number; width: number; height: number };
type ViewRef = RefObject<View | null>;

export type RowFireHandle = {
  start: (
    rowRef: ViewRef,
    canvasRef: ViewRef,
    onOriginalHidden: (hidden: boolean) => void,
  ) => Promise<boolean>;
  cancel: () => void;
};

type Scene = {
  image: SkImage;
  x: number;
  y: number;
  width: number;
  height: number;
  impactX: number;
  impactY: number;
};

function measure(node: View | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

function clamp01(value: number) {
  "worklet";
  return Math.max(0, Math.min(1, value));
}

const DURATION_MS = 1750;

const RowFireOverlay = memo(function RowFireOverlay({
  scene,
  progress,
}: {
  scene: Scene;
  progress: SharedValue<number>;
}) {
  const { width, height, impactX, impactY } = scene;

  // The original pixels remain visible on both sides of the advancing fire.
  // The two jagged boundaries travel from the centre toward the row edges.
  const remainingClip = usePathValue((path) => {
    "worklet";
    path.setIsVolatile(true);
    const p = clamp01(progress.value);
    const travel = (width * 0.5 + 12) * p;
    const leftFront = impactX - travel;
    const rightFront = impactX + travel;
    const wave = (x: number, side: number) => {
      const n =
        Math.sin(x * 0.17 + p * 11 + side) * 3.2 +
        Math.sin(x * 0.43 - p * 17 + side * 2.1) * 1.35 +
        Math.sin(x * 0.91 + p * 23) * 0.65;
      return n * (0.35 + p * 0.65);
    };

    path.moveTo(0, impactY);
    path.lineTo(Math.max(0, leftFront), impactY);
    for (let i = 0; i <= 16; i++) {
      const y = impactY + (height * i) / 16;
      path.lineTo(Math.max(0, leftFront + wave(y - impactY, 1)), y);
    }
    path.lineTo(0, impactY + height);
    path.close();

    path.moveTo(Math.min(width, rightFront), impactY);
    path.lineTo(width, impactY);
    path.lineTo(width, impactY + height);
    path.lineTo(Math.min(width, rightFront), impactY + height);
    for (let i = 16; i >= 0; i--) {
      const y = impactY + (height * i) / 16;
      path.lineTo(Math.min(width, rightFront + wave(y - impactY, 4)), y);
    }
    path.close();
  }, Skia.Path.Make());

  const burnedRegion = usePathValue((path) => {
    "worklet";
    path.setIsVolatile(true);
    const p = clamp01(progress.value);
    const travel = (width * 0.5 + 12) * p;
    const leftFront = impactX - travel;
    const rightFront = impactX + travel;
    path.moveTo(leftFront, impactY);
    path.lineTo(rightFront, impactY);
    for (let i = 16; i >= 0; i--) {
      const y = impactY + (height * i) / 16;
      const noise =
        Math.sin((y - impactY) * 0.17 + p * 11) * 3.2 +
        Math.sin((y - impactY) * 0.43 - p * 17) * 1.35;
      path.lineTo(rightFront + noise, y);
    }
    for (let i = 0; i <= 16; i++) {
      const y = impactY + (height * i) / 16;
      const noise =
        Math.sin((y - impactY) * 0.17 + p * 12 + 1) * 3.2 +
        Math.sin((y - impactY) * 0.43 - p * 16 + 2) * 1.35;
      path.lineTo(leftFront + noise, y);
    }
    path.close();
  }, Skia.Path.Make());

  const boltOpacity = useDerivedValue(() => 1 - clamp01(progress.value * 7));

  const frontPath = usePathValue((path) => {
    "worklet";
    path.setIsVolatile(true);
    const p = clamp01(progress.value);
    const travel = (width * 0.5 + 12) * p;
    const leftFront = impactX - travel;
    const rightFront = impactX + travel;
    const wave = (y: number, side: number) =>
      (Math.sin(y * 0.17 + p * 11 + side) * 3.2 +
        Math.sin(y * 0.43 - p * 17 + side * 2.1) * 1.35 +
        Math.sin(y * 0.91 + p * 23) * 0.65) *
      (0.35 + p * 0.65);

    for (let i = 0; i <= 16; i++) {
      const y = impactY + (height * i) / 16;
      const x = leftFront + wave(y - impactY, 1);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    for (let i = 0; i <= 16; i++) {
      const y = impactY + (height * i) / 16;
      const x = rightFront + wave(y - impactY, 4);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
  }, Skia.Path.Make());

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* A short, direct bolt terminates at the ignition point on the row. */}
      <Path
        path={
          Skia.Path.MakeFromSVGString(
            `M ${impactX} 6 L ${impactX - 8} 25 L ${impactX + 3} 33 L ${impactX - 5} 49 L ${impactX} ${impactY}`,
          )!
        }
        style="stroke"
        color="#75cfff"
        strokeWidth={5}
        strokeCap="round"
        strokeJoin="round"
        opacity={boltOpacity}
      >
        <BlurMask blur={9} style="normal" />
      </Path>
      <Path
        path={
          Skia.Path.MakeFromSVGString(
            `M ${impactX} 6 L ${impactX - 8} 25 L ${impactX + 3} 33 L ${impactX - 5} 49 L ${impactX} ${impactY}`,
          )!
        }
        style="stroke"
        color="#f4fcff"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
        opacity={boltOpacity}
      />

      {/* Exact captured row pixels, clipped to the portions not yet consumed. */}
      <Group clip={remainingClip}>
        <SkiaImage
          image={scene.image}
          x={0}
          y={impactY}
          width={width}
          height={height}
          fit="fill"
        />
      </Group>

      {/* The consumed centre remains visibly scorched behind the moving front. */}
      <Path path={burnedRegion} color="#1a0b07" opacity={0.88} />
      <Path
        path={burnedRegion}
        style="stroke"
        color="#6b210d"
        strokeWidth={5}
        opacity={0.72}
      >
        <BlurMask blur={5} style="normal" />
      </Path>

      {/* Hot outer aura, orange body and white-yellow leading edge. */}
      <Path
        path={frontPath}
        style="stroke"
        color="#ff3b08"
        strokeWidth={15}
        strokeCap="round"
        strokeJoin="round"
        opacity={0.72}
      >
        <BlurMask blur={12} style="normal" />
      </Path>
      <Path
        path={frontPath}
        style="stroke"
        color="#ff7a12"
        strokeWidth={8}
        strokeCap="round"
        strokeJoin="round"
        opacity={0.95}
      >
        <BlurMask blur={4.5} style="normal" />
      </Path>
      <Path
        path={frontPath}
        style="stroke"
        color="#ffd45a"
        strokeWidth={3.2}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={frontPath}
        style="stroke"
        color="#fff6d8"
        strokeWidth={1.15}
        strokeCap="round"
        strokeJoin="round"
      />
    </Canvas>
  );
});

export const RowFireOverlayHost = memo(
  forwardRef<RowFireHandle, { canvasRef: ViewRef }>(function RowFireOverlayHost(
    { canvasRef },
    ref,
  ) {
    const [scene, setScene] = useState<Scene | null>(null);
    const progress = useSharedValue(0);
    const activeRef = useRef(false);
    const runIdRef = useRef(0);
    const hiddenCallbackRef = useRef<((hidden: boolean) => void) | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    console.log(scene);
    const release = useCallback(() => {
      hiddenCallbackRef.current?.(false);
      hiddenCallbackRef.current = null;
      sceneRef.current?.image.dispose();
      sceneRef.current = null;
      setScene(null);
      activeRef.current = false;
    }, []);

    const cancel = useCallback(() => {
      runIdRef.current += 1;
      cancelAnimation(progress);
      if (activeRef.current || sceneRef.current) release();
    }, [progress, release]);

    const start = useCallback(
      async (
        rowRef: ViewRef,
        targetCanvasRef: ViewRef,
        onOriginalHidden: (hidden: boolean) => void,
      ) => {
        if (activeRef.current) return false;
        activeRef.current = true;
        const runId = ++runIdRef.current;
        console.log("fire runid", runId);
        hiddenCallbackRef.current = onOriginalHidden;

        try {
          const rowNode = rowRef.current;
          const canvasNode = targetCanvasRef.current ?? canvasRef.current;
          if (!rowNode || !canvasNode) {
            activeRef.current = false;
            hiddenCallbackRef.current = null;
            return false;
          }

          // Capture while the live row is still visible; only hide it after the
          // exact native pixels and geometry are both available.
          const [rowRect, canvasRect] = await Promise.all([
            measure(rowNode),
            measure(canvasNode),
          ]);
          if (!rowRect || !canvasRect || runId !== runIdRef.current) {
            activeRef.current = false;
            hiddenCallbackRef.current = null;
            return false;
          }
          const image = await makeImageFromView(rowRef as RefObject<View>);
          if (!image || runId !== runIdRef.current) {
            image?.dispose();
            activeRef.current = false;
            hiddenCallbackRef.current = null;
            return false;
          }

          const nextScene: Scene = {
            image,
            x: rowRect.x - canvasRect.x,
            y: rowRect.y - canvasRect.y,
            width: rowRect.width,
            height: rowRect.height,
            impactX: rowRect.width * 0.5,
            impactY: 64,
          };
          sceneRef.current = nextScene;
          setScene(nextScene);
          onOriginalHidden(true);

          // Let the captured image mount before revealing the first frame.
          await new Promise((resolve) =>
            requestAnimationFrame(() => resolve(null)),
          );
          if (runId !== runIdRef.current) return false;

          progress.value = 0;
          await new Promise<boolean>((resolve) => {
            progress.value = withTiming(
              1,
              { duration: DURATION_MS, easing: Easing.inOut(Easing.cubic) },
              (finished) => runOnJS(resolve)(!!finished),
            );
          });
          if (runId !== runIdRef.current) return false;

          release();
          return true;
        } catch (error) {
          console.warn(
            "[Row Fire] Could not capture or animate the Easter egg row.",
            error,
          );
          if (runId === runIdRef.current) release();
          return false;
        }
      },
      [canvasRef, progress, release],
    );

    useImperativeHandle(ref, () => ({ start, cancel }), [start, cancel]);

    if (!scene) return null;
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { overflow: "visible" }]}
      >
        <View
          style={{
            position: "absolute",
            left: scene.x,
            top: scene.y - 64,
            width: scene.width,
            height: scene.height + 64,
          }}
        >
          <RowFireOverlay scene={scene} progress={progress} />
        </View>
      </View>
    );
  }),
);
