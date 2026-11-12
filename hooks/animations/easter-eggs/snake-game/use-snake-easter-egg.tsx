import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Reanimated, {
  Easing as REasing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  createGame,
  warmUpEngine,
  type Game,
} from "./snake-engine";
import { computeSnakeLayout } from "./snake-layout";
import { prepareSnakeAssets } from "./snake-skia-renderer";
import { loadSnakeHighScore } from "./snake-storage";
import { SnakeLoadingScreen } from "./snake-loading-screen";
import { SnakeGameView, type SnakeSoundHandler } from "./snake-game-view";
import { SNAKE_COLORS } from "./snake-theme";

export type { SnakeSoundHandler } from "./snake-game-view";

type RowRef = React.RefObject<View | null>;
type Rect = { x: number; y: number; w: number; h: number };

export interface SnakeStartOptions {
  onFinished?: () => void;
}

const MIN_STEP_MS = 220;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()));

function measureRowInCanvas(rowRef: RowRef, canvasRef: RowRef): Promise<Rect | null> {
  return new Promise((resolve) => {
    const row = rowRef.current as any;
    const canvas = canvasRef.current as any;
    if (!row || !canvas || typeof row.measureLayout !== "function") {
      resolve(null);
      return;
    }
    let done = false;
    const settle = (rect: Rect | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(rect);
    };
    const timer = setTimeout(() => settle(null), 400);
    try {
      row.measureLayout(
        canvas,
        (x: number, y: number, w: number, h: number) => settle({ x, y, w, h }),
        () => settle(null),
      );
    } catch {
      settle(null);
    }
  });
}

// ---- Overlay: row-expand transition -> LCD loading screen -> game ----------
function SnakeOverlay({
  origin,
  onExit,
  onSound,
}: {
  origin: Rect | null;
  onExit: () => void;
  onSound: SnakeSoundHandler;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [running, setRunning] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Warming up the LCD");
  const [hi, setHi] = useState(0);

  const expand = useSharedValue(0);
  const fade = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const aliveRef = useRef(true);
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  sizeRef.current = size;

  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setProgress(Math.min(100, Math.round(value)));
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  const onExpanded = useCallback(() => {
    if (aliveRef.current) setExpanded(true);
  }, []);

  // 1) Grow from the tapped row to full screen (UI thread).
  const hasSize = size !== null;
  useEffect(() => {
    if (!hasSize) return;
    expand.value = withTiming(
      1,
      { duration: origin ? 420 : 300, easing: REasing.out(REasing.cubic) },
      (finished) => {
        if (finished) runOnJS(onExpanded)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSize]);

  // 2) Loading screen does the real setup.
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    (async () => {
      let storedHi = 0;
      let g: Game | null = null;
      const s = sizeRef.current;
      if (!s) return;
      const layout = computeSnakeLayout(s.w, s.h);

      const steps: { label: string; run: () => void | Promise<void> }[] = [
        {
          label: "Warming up the LCD",
          run: async () => {
            await nextFrame();
            prepareSnakeAssets(layout);
          },
        },
        {
          label: "Reading hi-score",
          run: async () => {
            storedHi = await loadSnakeHighScore();
            if (!cancelled) setHi(storedHi);
          },
        },
        {
          label: "Carving the maze",
          run: () => {
            g = createGame(layout.cols, layout.rows, storedHi);
          },
        },
        { label: "Wrapping the edges", run: () => warmUpEngine() },
        {
          label: "Waking the snake",
          run: async () => {
            if (g && !cancelled) setGame(g);
            await nextFrame();
            await nextFrame();
          },
        },
        { label: "Ready!", run: () => nextFrame() },
      ];

      for (let i = 0; i < steps.length; i++) {
        if (cancelled || !aliveRef.current) return;
        const started = Date.now();
        setLabel(steps[i].label);
        await nextFrame();
        await steps[i].run();
        const elapsed = Date.now() - started;
        await sleep(Math.max(0, MIN_STEP_MS - elapsed));
        Animated.timing(progressAnim, {
          toValue: ((i + 1) / steps.length) * 100,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      }

      await sleep(380);
      if (cancelled || !aliveRef.current) return;

      // 3) Reveal the game; the loader fades out.
      setRunning(true);
      Animated.timing(fade, {
        toValue: 0,
        duration: 340,
        useNativeDriver: true,
      }).start(() => {
        if (aliveRef.current) setShowLoading(false);
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const sw = size?.w ?? 0;
  const sh = size?.h ?? 0;
  const o = useMemo<Rect>(
    () => origin ?? { x: sw / 2 - 80, y: sh / 2 - 30, w: 160, h: 60 },
    [origin, sw, sh],
  );

  const shellStyle = useAnimatedStyle(
    () => ({
      left: interpolate(expand.value, [0, 1], [o.x, 0]),
      top: interpolate(expand.value, [0, 1], [o.y, 0]),
      width: interpolate(expand.value, [0, 1], [o.w, sw]),
      height: interpolate(expand.value, [0, 1], [o.h, sh]),
      borderRadius: interpolate(expand.value, [0, 1], [14, 0]),
    }),
    [o, sw, sh],
  );

  const contentStyle = useAnimatedStyle(
    () => ({
      left: -interpolate(expand.value, [0, 1], [o.x, 0]),
      top: -interpolate(expand.value, [0, 1], [o.y, 0]),
      opacity: interpolate(expand.value, [0, 0.45, 1], [0, 0, 1]),
    }),
    [o],
  );

  return (
    <View
      style={styles.root}
      pointerEvents="box-none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) =>
          prev && prev.w === width && prev.h === height
            ? prev
            : { w: width, h: height },
        );
      }}
    >
      {size && (
        <Reanimated.View
          style={[
            {
              position: "absolute",
              overflow: "hidden",
              backgroundColor: SNAKE_COLORS.body,
              borderWidth: 1,
              borderColor: "rgba(163,179,143,0.6)",
            },
            shellStyle,
          ]}
        >
          <Reanimated.View
            style={[
              { position: "absolute", width: size.w, height: size.h },
              contentStyle,
            ]}
          >
            {game && (
              <SnakeGameView
                game={game}
                width={size.w}
                height={size.h}
                running={running}
                onExit={onExit}
                onSound={onSound}
              />
            )}
            {showLoading && (
              <Animated.View
                style={[StyleSheet.absoluteFill, { opacity: fade }]}
                pointerEvents={running ? "none" : "auto"}
              >
                <SnakeLoadingScreen
                  progress={progress}
                  label={label}
                  width={size.w}
                  height={size.h}
                  hi={hi}
                />
              </Animated.View>
            )}
          </Reanimated.View>
        </Reanimated.View>
      )}
    </View>
  );
}

// ---- Hook (same shape as the other easter-egg animation hooks) -------------
export interface UseSnakeOptions {
  /** Optional hook-in point for sound effects. Fired with engine event names. */
  onSound?: SnakeSoundHandler;
}

export function useSnakeEasterEgg(options: UseSnakeOptions = {}) {
  const [session, setSession] = useState<{ id: number; origin: Rect | null } | null>(
    null,
  );
  const activeRef = useRef(false);
  const idRef = useRef(0);
  const resolveRef = useRef<((completed: boolean) => void) | null>(null);
  const onFinishedRef = useRef<(() => void) | undefined>(undefined);
  const onSoundRef = useRef(options.onSound);
  onSoundRef.current = options.onSound;

  const finish = useCallback((completed: boolean) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setSession(null);
    const resolve = resolveRef.current;
    const onFinished = onFinishedRef.current;
    resolveRef.current = null;
    onFinishedRef.current = undefined;
    onFinished?.();
    resolve?.(completed);
  }, []);

  /** Resolves `true` once the player quits, `false` if cancelled / not started. */
  const start = useCallback(
    async (
      rowRef: RowRef,
      canvasRef: RowRef,
      opts?: SnakeStartOptions,
    ): Promise<boolean> => {
      if (activeRef.current) return false;
      activeRef.current = true;
      onFinishedRef.current = opts?.onFinished;

      const origin = await measureRowInCanvas(rowRef, canvasRef);
      if (!activeRef.current) return false;

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setSession({ id: ++idRef.current, origin });
      });
    },
    [],
  );

  const cancel = useCallback(() => finish(false), [finish]);
  const handleExit = useCallback(() => finish(true), [finish]);
  const handleSound = useCallback<SnakeSoundHandler>(
    (name, n) => onSoundRef.current?.(name, n),
    [],
  );

  const overlayLayer = session ? (
    <SnakeOverlay
      key={session.id}
      origin={session.origin}
      onExit={handleExit}
      onSound={handleSound}
    />
  ) : null;

  return { start, cancel, active: session !== null, overlayLayer };
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
