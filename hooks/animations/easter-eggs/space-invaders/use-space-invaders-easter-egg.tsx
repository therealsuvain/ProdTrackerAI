import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import {
  buildShields,
  createGame,
  primeBoss,
  spawnFormation,
  warmUpEngine,
  type Game,
} from "./space-invaders-engine";
import { getAtlas, type Rect } from "./space-invaders-sprites";
import { loadHighScore } from "./space-invaders-storage";
import { SpaceInvadersLoadingScreen } from "./space-invaders-loading-screen";
import {
  SpaceInvadersGameView,
  type SpaceInvadersSoundHandler,
} from "./space-invaders-game-view";
import { SI_COLORS } from "./space-invaders-theme";

export type { SpaceInvadersSoundHandler } from "./space-invaders-game-view";

type RowRef = React.RefObject<View | null>;

export interface SpaceInvadersStartOptions {
  onFinished?: () => void;
}

const MIN_STEP_MS = 260;

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

// ---- Overlay: row-expand transition -> loading bar -> game -----------------
function SpaceInvadersOverlay({
  origin,
  onExit,
  onSound,
}: {
  origin: Rect | null;
  onExit: () => void;
  onSound: SpaceInvadersSoundHandler;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [running, setRunning] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState("Initializing");
  const [hi, setHi] = useState(0);

  const expand = useRef(new Animated.Value(0)).current;
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

  // 1) Grow from the tapped row to full screen.
  useEffect(() => {
    if (!size) return;
    Animated.timing(expand, {
      toValue: 1,
      duration: origin ? 420 : 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && aliveRef.current) setExpanded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // 2) Loading screen does the real setup + mounting.
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    (async () => {
      let storedHi = 0;
      let g: Game | null = null;

      const steps: { label: string; run: () => void | Promise<void> }[] = [
        { label: "Mounting render surface", run: () => nextFrame() },
        { label: "Compiling sprite atlas", run: () => void getAtlas() },
        {
          label: "Reading high score",
          run: async () => {
            storedHi = await loadHighScore();
            if (!cancelled) setHi(storedHi);
          },
        },
        {
          label: "Spawning invader formation",
          run: () => {
            g = createGame(storedHi);
            spawnFormation(g);
          },
        },
        {
          label: "Raising defence shields",
          run: () => {
            if (g) buildShields(g);
          },
        },
        {
          label: "Arming final boss",
          run: () => {
            if (g) primeBoss(g);
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

  const geo = useMemo(() => {
    if (!size) return null;
    const o: Rect = origin ?? {
      x: size.w / 2 - 80,
      y: size.h / 2 - 30,
      w: 160,
      h: 60,
    };
    const lerp = (a: number, b: number) =>
      expand.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
    const left = lerp(o.x, 0);
    const top = lerp(o.y, 0);
    return {
      left,
      top,
      width: lerp(o.w, size.w),
      height: lerp(o.h, size.h),
      radius: lerp(14, 0),
      negLeft: Animated.multiply(left, -1),
      negTop: Animated.multiply(top, -1),
      contentOpacity: expand.interpolate({
        inputRange: [0, 0.45, 1],
        outputRange: [0, 0, 1],
      }),
    };
  }, [size, origin, expand]);

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
      {size && geo && (
        <Animated.View
          style={{
            position: "absolute",
            overflow: "hidden",
            backgroundColor: SI_COLORS.bg,
            left: geo.left,
            top: geo.top,
            width: geo.width,
            height: geo.height,
            borderRadius: geo.radius,
            borderWidth: 1,
            borderColor: "rgba(61,255,90,0.55)",
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: geo.negLeft,
              top: geo.negTop,
              width: size.w,
              height: size.h,
              opacity: geo.contentOpacity,
            }}
          >
            {game && (
              <SpaceInvadersGameView
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
                <SpaceInvadersLoadingScreen
                  progress={progress}
                  label={label}
                  width={size.w}
                  hi={hi}
                />
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ---- Hook (same shape as the other easter-egg animation hooks) -------------
export interface UseSpaceInvadersOptions {
  /** Optional hook-in point for sound effects. Fired with engine event names. */
  onSound?: SpaceInvadersSoundHandler;
}

export function useSpaceInvadersEasterEgg(options: UseSpaceInvadersOptions = {}) {
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
   * cancelled (e.g. search closed) or could not start.
   */
  const start = useCallback(
    async (
      rowRef: RowRef,
      canvasRef: RowRef,
      opts?: SpaceInvadersStartOptions,
    ): Promise<boolean> => {
      if (activeRef.current) return false;
      activeRef.current = true;
      onFinishedRef.current = opts?.onFinished;

      const origin = await measureRowInCanvas(rowRef, canvasRef);
      if (!activeRef.current) return false; // cancelled while measuring

      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setSession({ id: ++idRef.current, origin });
      });
    },
    [],
  );

  const cancel = useCallback(() => finish(false), [finish]);
  const handleExit = useCallback(() => finish(true), [finish]);
  const handleSound = useCallback<SpaceInvadersSoundHandler>(
    (name, n) => onSoundRef.current?.(name, n),
    [],
  );

  const overlayLayer = session ? (
    <SpaceInvadersOverlay
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
