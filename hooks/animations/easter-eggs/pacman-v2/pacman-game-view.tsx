import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PixelRatio, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";

import {
  END_INPUT_DELAY,
  WORLD_H,
  WORLD_W,
  createReadyGame,
  isEndPhase,
  updateGame,
  type Dir,
  type Game,
  type GameEventName,
  type GameInput,
} from "./pacman-engine";
import { createSkiaRenderer } from "./pacman-skia-renderer";
import { saveHighScore } from "./pacman-storage";
import { PM_COLORS, PM_FONT } from "./pacman-theme";

export type PacManSoundHandler = (name: GameEventName, n?: number) => void;

interface Props {
  game: Game;
  width: number;
  height: number;
  running: boolean;
  onExit: () => void;
  onSound?: PacManSoundHandler;
}

const HEADER_H = 46;
const CONTROLS_H = 112;
const IDLE_INPUT: GameInput = { dir: "none" };

type Touches = ReadonlyArray<{
  locationX: number;
  locationY: number;
  pageX: number;
  pageY: number;
}>;
type TouchEvt = { nativeEvent: { touches: Touches; changedTouches?: Touches } };

const Header = React.memo(function Header({ onExit }: { onExit: () => void }) {
  return (
    <View style={[styles.header, { height: HEADER_H }]}>
      <Text style={styles.headerTitle}>PAC-MAN</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quit Pac-Man"
        onPress={onExit}
        hitSlop={10}
        style={styles.closeButton}
      >
        <MaterialCommunityIcons
          name="close"
          size={22}
          color={PM_COLORS.white}
        />
      </Pressable>
    </View>
  );
});

const Controls = React.memo(function Controls({
  activeDir,
  canRestart,
  onLayoutRect,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  activeDir: Dir;
  canRestart: boolean;
  onLayoutRect: (w: number, h: number) => void;
  onTouchStart: (e: TouchEvt) => void;
  onTouchMove: (e: TouchEvt) => void;
  onTouchEnd: () => void;
}) {
  return (
    <View
      style={[styles.controls, { height: CONTROLS_H }]}
      onLayout={(e) =>
        onLayoutRect(e.nativeEvent.layout.width, e.nativeEvent.layout.height)
      }
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Left button */}
      <View pointerEvents="none" style={styles.zone}>
        <View style={[styles.button, activeDir === "left" && styles.buttonOn]}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={40}
            color={PM_COLORS.yellow}
          />
        </View>
      </View>

      {/* Stacked Up / Down buttons */}
      <View pointerEvents="none" style={[styles.zone, styles.vertStack]}>
        <View style={[styles.button, activeDir === "up" && styles.buttonOn]}>
          <MaterialCommunityIcons
            name="chevron-up"
            size={34}
            color={PM_COLORS.yellow}
          />
        </View>
        <View style={[styles.button, activeDir === "down" && styles.buttonOn]}>
          <MaterialCommunityIcons
            name="chevron-down"
            size={34}
            color={PM_COLORS.yellow}
          />
        </View>
      </View>

      {/* Right button */}
      <View pointerEvents="none" style={styles.zone}>
        <View style={[styles.button, activeDir === "right" && styles.buttonOn]}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={40}
            color={PM_COLORS.yellow}
          />
        </View>
      </View>

      {canRestart && (
        <View pointerEvents="none" style={styles.restartBanner}>
          <Text style={styles.restartText}>TAP TO PLAY AGAIN</Text>
        </View>
      )}
    </View>
  );
});

// ---- Game view -------------------------------------------------------------
export function PacManGameView({
  game,
  width,
  height,
  running,
  onExit,
  onSound,
}: Props) {
  const gameRef = useRef<Game>(game);
  const inputRef = useRef<GameInput>({ ...IDLE_INPUT });
  const onSoundRef = useRef(onSound);
  onSoundRef.current = onSound;
  const savedRunRef = useRef<number | null>(null);
  const ctrlSizeRef = useRef({ w: 1, h: 1 });
  const canRestartRef = useRef(false);
  const swipeOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [runKey, setRunKey] = useState(0);
  const [canRestart, setCanRestart] = useState(false);
  const [activeDir, setActiveDir] = useState<Dir>("none");

  // Pixel-perfect integer scale (whole device pixels per arcade pixel).
  /* const ratio = PixelRatio.get();
  const availW = width - 12;
  const availH = height - HEADER_H - CONTROLS_H - 8;
  const raw = Math.min(availW / WORLD_W, availH / WORLD_H);
  const scale = Math.max(Math.floor(raw * ratio) / ratio, 0.5);
  const scaleRef = useRef(scale);
  scaleRef.current = scale; */
  // Continuous scale so the 208 x 352 portrait world fills the space between Header and Controls.
  const availW = width - 16;
  const availH = height - HEADER_H - CONTROLS_H - 4;
  const scale = Math.max(Math.min(availW / WORLD_W, availH / WORLD_H), 0.5);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // One recorder, one shared value. The loop below writes a fresh SkPicture
  // into it every frame; Skia draws it on the UI thread without any React work.
  const renderer = useMemo(() => createSkiaRenderer(), []);
  const picture = useSharedValue(
    useMemo(() => renderer.render(game, scale, true, false), []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Redraw immediately on resize / restart.
  useEffect(() => {
    picture.value = renderer.render(gameRef.current, scale, true, false);
  }, [scale, runKey, renderer, picture]);

  const setDirection = useCallback((dir: Dir) => {
    inputRef.current = { dir };
    setActiveDir((prev) => (prev === dir ? prev : dir));
  }, []);

  const restart = useCallback(() => {
    const prev = gameRef.current;
    gameRef.current = createReadyGame(Math.max(prev.hi, prev.score));
    inputRef.current = { ...IDLE_INPUT };
    savedRunRef.current = null;
    canRestartRef.current = false;
    setCanRestart(false);
    setActiveDir("none");
    setRunKey((k) => k + 1);
  }, []);

  // Main loop: simulate -> record picture -> hand to Skia.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    let alive = true;

    const loop = (now: number) => {
      if (!alive) return;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;

      const g = gameRef.current;
      updateGame(g, inputRef.current, dt);

      if (g.events.length > 0) {
        const handler = onSoundRef.current;
        if (handler) for (const e of g.events) handler(e.name, e.n);
        g.events.length = 0;
      }

      if (g.runEnded && savedRunRef.current !== g.runId) {
        savedRunRef.current = g.runId;
        void saveHighScore(g.score);
      }

      const restartable = isEndPhase(g) && g.phaseTime > END_INPUT_DELAY;
      if (restartable !== canRestartRef.current) {
        canRestartRef.current = restartable;
        setCanRestart(restartable);
      }

      const blink = Math.floor(g.time * 3.2) % 2 === 0;
      picture.value = renderer.render(g, scaleRef.current, blink, restartable);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running, renderer, picture]);

  // Persist a mid-run score if the player exits early.
  useEffect(
    () => () => {
      const g = gameRef.current;
      if (g.score > 0 && savedRunRef.current !== g.runId) {
        void saveHighScore(g.score);
      }
    },
    [],
  );

  // Control pad touch zones: left third = LEFT, middle third = UP/DOWN, right third = RIGHT
  const applyControlTouches = useCallback(
    (touches: Touches) => {
      if (touches.length === 0) {
        setActiveDir("none");
        return;
      }
      const { w, h } = ctrlSizeRef.current;
      const t = touches[touches.length - 1];
      const fx = t.locationX / (w || 1);
      const fy = t.locationY / (h || 1);
      let dir: Dir;
      if (fx < 0.333) dir = "left";
      else if (fx > 0.666) dir = "right";
      else dir = fy < 0.5 ? "up" : "down";
      setDirection(dir);
    },
    [setDirection],
  );

  const handleControlTouchStart = useCallback(
    (e: TouchEvt) => {
      if (canRestartRef.current) {
        restart();
        return;
      }
      applyControlTouches(e.nativeEvent.touches);
    },
    [applyControlTouches, restart],
  );

  const handleControlTouchMove = useCallback(
    (e: TouchEvt) => applyControlTouches(e.nativeEvent.touches),
    [applyControlTouches],
  );

  const handleControlTouchEnd = useCallback(() => {
    setActiveDir("none");
  }, []);

  const handleLayoutRect = useCallback((w: number, h: number) => {
    ctrlSizeRef.current = { w, h };
  }, []);

  // Swipe support directly on the playfield
  const handleWorldTouchStart = useCallback(
    (e: TouchEvt) => {
      if (canRestartRef.current) {
        restart();
        return;
      }
      const t = e.nativeEvent.touches[0];
      if (t) swipeOriginRef.current = { x: t.pageX, y: t.pageY };
    },
    [restart],
  );

  const handleWorldTouchMove = useCallback(
    (e: TouchEvt) => {
      const origin = swipeOriginRef.current;
      const t = e.nativeEvent.touches[0];
      if (!origin || !t) return;
      const dx = t.pageX - origin.x;
      const dy = t.pageY - origin.y;
      if (Math.hypot(dx, dy) < 12) return;
      const dir: Dir =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";
      setDirection(dir);
      swipeOriginRef.current = { x: t.pageX, y: t.pageY };
    },
    [setDirection],
  );

  const handleWorldTouchEnd = useCallback(() => {
    swipeOriginRef.current = null;
    setActiveDir("none");
  }, []);

  return (
    <View style={styles.root}>
      <Header onExit={onExit} />

      <View
        style={styles.worldWrap}
        onTouchStart={handleWorldTouchStart}
        onTouchMove={handleWorldTouchMove}
        onTouchEnd={handleWorldTouchEnd}
        onTouchCancel={handleWorldTouchEnd}
      >
        <Pressable
          disabled={!canRestart}
          onPress={restart}
          style={{ width: WORLD_W * scale, height: WORLD_H * scale }}
        >
          <Canvas
            pointerEvents="none"
            style={{ width: WORLD_W * scale, height: WORLD_H * scale }}
          >
            <Picture picture={picture} />
          </Canvas>
        </Pressable>
      </View>

      <Controls
        activeDir={activeDir}
        canRestart={canRestart}
        onLayoutRect={handleLayoutRect}
        onTouchStart={handleControlTouchStart}
        onTouchMove={handleControlTouchMove}
        onTouchEnd={handleControlTouchEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PM_COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 6,
  },
  headerTitle: {
    color: PM_COLORS.yellow,
    fontFamily: PM_FONT,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 3,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  worldWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  zone: {
    flex: 1,
    padding: 4,
  },
  vertStack: {
    gap: 6,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 14,
    borderColor: "rgba(33,33,255,0.7)",
    backgroundColor: "rgba(33,33,255,0.12)",
  },
  buttonOn: {
    backgroundColor: "rgba(255,230,0,0.24)",
    borderColor: PM_COLORS.yellow,
  },
  restartBanner: {
    ...StyleSheet.absoluteFillObject,
    marginHorizontal: 12,
    marginBottom: 14,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PM_COLORS.yellow,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  restartText: {
    color: PM_COLORS.yellow,
    fontFamily: PM_FONT,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 3,
  },
});
