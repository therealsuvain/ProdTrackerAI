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
  buildMaze,
  createGame,
  spawnActors,
  warmUpEngine,
  type Game,
} from "./pacman-engine";
import { getAtlas, type Rect } from "./pacman-sprites";
import { prepareSkiaAssets } from "./pacman-skia-renderer";
import { loadHighScore } from "./pacman-storage";
import { PacManLoadingScreen } from "./pacman-loading-screen";
import { PacManGameView, type PacManSoundHandler } from "./pacman-game-view";
import { PM_COLORS } from "./pacman-theme";

export type { PacManSoundHandler } from "./pacman-game-view";

type RowRef = React.RefObject<View | null>;

export interface PacManStartOptions {
  onFinished?: () => void;
}

const MIN_STEP_MS = 240;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => r()));

function measureRowInCanvas(
  rowRef?: RowRef | null,
  canvasRef?: RowRef | null,
): Promise<Rect | null> {
  return new Promise((resolve) => {
    const row = rowRef?.current as any;
    const canvas = canvasRef?.current as any;
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

// ---- Overlay: row-expand transition -> loading bar -> game -----------------
function PacManOverlay({
  origin,
  onExit,
  onSound,
}: {
  origin: Rect | null;
  onExit: () => void;
  onSound: PacManSoundHandler;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [running, setRunning] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Initializing");
  const [hi, setHi] = useState(0);

  // The button/row -> fullscreen grow runs on the UI thread (Reanimated).
  const expand = useSharedValue(0);
  const fade = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const aliveRef = useRef(true);

  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    [],
  );

  // Smooth integer progress for the bar.
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setProgress(Math.min(100, Math.round(value)));
    });
    return () => progressAnim.removeListener(id);
  }, [progressAnim]);

  const onExpanded = useCallback(() => {
    if (aliveRef.current) setExpanded(true);
  }, []);

  // 1) Grow from the tapped button/row to full screen.
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

  // 2) Loading screen does the real setup + mounting.
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    (async () => {
      let storedHi = 0;
      let g: Game | null = null;

      const steps: { label: string; run: () => void | Promise<void> }[] = [
        { label: "Mounting render surface", run: () => nextFrame() },
        {
          label: "Compiling sprite atlas",
          run: () => {
            getAtlas();
            prepareSkiaAssets();
          },
        },
        {
          label: "Reading high score",
          run: async () => {
            storedHi = await loadHighScore();
            if (!cancelled) setHi(storedHi);
          },
        },
        {
          label: "Carving maze corridors",
          run: () => {
            g = createGame(storedHi);
            buildMaze(g);
          },
        },
        {
          label: "Waking Blinky, Pinky, Inky & Clyde",
          run: () => {
            if (g) spawnActors(g);
          },
        },
        {
          label: "Mounting playfield",
          run: async () => {
            if (g && !cancelled) setGame(g);
            await nextFrame();
            await nextFrame();
          },
        },
        { label: "Warming up engine", run: () => warmUpEngine() },
        { label: "Ready", run: () => nextFrame() },
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

      await sleep(420);
      if (cancelled || !aliveRef.current) return;

      // 3) Reveal the game; READY! begins as the loader fades.
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

  // Counter-offsets the content so it stays fixed to the screen while the
  // shell grows around it.
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
              backgroundColor: PM_COLORS.bg,
              borderWidth: 1,
              borderColor: "rgba(255,230,0,0.55)",
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
              <PacManGameView
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
                <PacManLoadingScreen
                  progress={progress}
                  label={label}
                  width={size.w}
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

// ---- Hook (same shape as useSpaceInvadersEasterEgg) ------------------------
export interface UsePacManOptions {
  /** Optional hook-in point for sound effects. Fired with engine event names. */
  onSound?: PacManSoundHandler;
}

export function usePacManEasterEgg(options: UsePacManOptions = {}) {
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

  /**
   * Resolves `true` once the player quits the game, `false` if it was
   * cancelled or could not start. `rowRef` and `canvasRef` are optional if
   * you want to launch from the screen center directly on a button press.
   */
  const start = useCallback(
    async (
      rowRef?: RowRef | null,
      canvasRef?: RowRef | null,
      opts?: PacManStartOptions,
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
  const handleSound = useCallback<PacManSoundHandler>(
    (name, n) => onSoundRef.current?.(name, n),
    [],
  );

  const overlayLayer = session ? (
    <PacManOverlay
      key={session.id}
      origin={session.origin}
      onExit={handleExit}
      onSound={handleSound}
    />
  ) : null;

  return {
    start,
    cancel,
    active: session !== null,
    overlayLayer,
  };
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
