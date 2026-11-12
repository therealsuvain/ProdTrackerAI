import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Canvas, Picture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";

import {
  END_INPUT_DELAY,
  createGame,
  isEndPhase,
  restartGame,
  setDirection,
  togglePause,
  updateGame,
  type Dir,
  type Game,
  type GameEventName,
} from "./snake-engine";
import {
  BEZEL,
  HEADER_H,
  PANEL_GAP,
  SIDE,
  computeSnakeLayout,
} from "./snake-layout";
import { createSnakeRenderer } from "./snake-skia-renderer";
import { saveSnakeHighScore } from "./snake-storage";
import { SNAKE_COLORS as C, SNAKE_FONT } from "./snake-theme";

export type SnakeSoundHandler = (name: GameEventName, n?: number) => void;

interface Props {
  game: Game;
  width: number;
  height: number;
  running: boolean;
  onExit: () => void;
  onSound?: SnakeSoundHandler;
}

const SWIPE_PX = 20;

// ---- Header ----------------------------------------------------------------
const Header = React.memo(function Header({ onExit }: { onExit: () => void }) {
  return (
    <View style={[styles.header, { height: HEADER_H }]}>
      <Text style={styles.headerTitle}>SNAKE</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quit Snake"
        onPress={onExit}
        hitSlop={10}
        style={styles.closeButton}
      >
        <MaterialCommunityIcons name="close" size={22} color={C.title} />
      </Pressable>
    </View>
  );
});

// ---- Old-phone keypad ------------------------------------------------------
type ArrowName = "arrow-up" | "arrow-down" | "arrow-left" | "arrow-right";

const NumKey = React.memo(function NumKey({
  digit,
  sub,
  arrow,
  label,
  onPressIn,
}: {
  digit: string;
  sub: string;
  arrow?: ArrowName;
  label: string;
  onPressIn: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onPressIn}
      style={({ pressed }) => [styles.numKey, pressed && styles.numKeyDown]}
    >
      <Text style={styles.keyDigit}>{digit}</Text>
      <Text style={styles.keySub}>{sub}</Text>
      {arrow && (
        <MaterialCommunityIcons
          name={arrow}
          size={11}
          color={C.keyHint}
          style={styles.keyArrow}
        />
      )}
    </Pressable>
  );
});

const Controls = React.memo(function Controls({
  height,
  onDir,
  onAny,
  onPause,
  onNew,
}: {
  height: number;
  onDir: (d: Dir) => void;
  onAny: () => void;
  onPause: () => void;
  onNew: () => void;
}) {
  const rows: {
    digit: string;
    sub: string;
    dir?: Dir;
    arrow?: ArrowName;
    label: string;
  }[][] = [
    [
      { digit: "1", sub: "oo", label: "Key 1" },
      { digit: "2", sub: "abc", dir: 0, arrow: "arrow-up", label: "Up" },
      { digit: "3", sub: "def", label: "Key 3" },
    ],
    [
      { digit: "4", sub: "ghi", dir: 3, arrow: "arrow-left", label: "Left" },
      { digit: "5", sub: "jkl", label: "Pause" },
      { digit: "6", sub: "mno", dir: 1, arrow: "arrow-right", label: "Right" },
    ],
    [
      { digit: "7", sub: "pqrs", label: "Key 7" },
      { digit: "8", sub: "tuv", dir: 2, arrow: "arrow-down", label: "Down" },
      { digit: "9", sub: "wxyz", label: "Key 9" },
    ],
  ];

  return (
    <View style={[styles.controls, { height }]}>
      <View style={styles.navRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New game"
          onPressIn={onNew}
          style={({ pressed }) => [styles.cKey, pressed && styles.numKeyDown]}
        >
          <Text style={styles.cKeyText}>C</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause or resume"
          onPressIn={onPause}
          style={({ pressed }) => [styles.navKey, pressed && styles.numKeyDown]}
        >
          <View style={styles.navLine} />
        </Pressable>

        <View style={styles.rocker}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Up"
            onPressIn={() => onDir(0)}
            style={({ pressed }) => [styles.rockerHalf, pressed && styles.rockerDown]}
          >
            <MaterialCommunityIcons name="chevron-up" size={24} color="#1d2228" />
          </Pressable>
          <View style={styles.rockerSplit} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Down"
            onPressIn={() => onDir(2)}
            style={({ pressed }) => [styles.rockerHalf, pressed && styles.rockerDown]}
          >
            <MaterialCommunityIcons name="chevron-down" size={24} color="#1d2228" />
          </Pressable>
        </View>
      </View>

      <View style={styles.keypad}>
        {rows.map((row, i) => (
          <View key={i} style={styles.keyRow}>
            {row.map((k) => (
              <NumKey
                key={k.digit}
                digit={k.digit}
                sub={k.sub}
                arrow={k.arrow}
                label={k.label}
                onPressIn={
                  k.dir !== undefined
                    ? () => onDir(k.dir as Dir)
                    : k.digit === "5"
                      ? onPause
                      : onAny
                }
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

// ---- Game view -------------------------------------------------------------
export function SnakeGameView({ game, width, height, running, onExit, onSound }: Props) {
  const layout = useMemo(() => computeSnakeLayout(width, height), [width, height]);

  // The loading step sizes the maze with the same maths; if the screen size
  // changed since (rotation etc.) rebuild a matching game.
  const gameRef = useRef<Game>(
    game.cols === layout.cols && game.rows === layout.rows
      ? game
      : createGame(layout.cols, layout.rows, game.hi),
  );
  const onSoundRef = useRef(onSound);
  onSoundRef.current = onSound;
  const savedRunRef = useRef<number | null>(null);
  const canRestartRef = useRef(false);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [runKey, setRunKey] = useState(0);

  const renderer = useMemo(() => createSnakeRenderer(layout), [layout]);
  const picture = useSharedValue(
    useMemo(
      () => renderer.render(gameRef.current, true, false),
      [], // eslint-disable-line react-hooks/exhaustive-deps
    ),
  );

  useEffect(() => {
    gameRef.current.dirty = true;
    picture.value = renderer.render(gameRef.current, true, false);
  }, [renderer, runKey, picture]);

  const restart = useCallback(() => {
    gameRef.current = restartGame(gameRef.current);
    savedRunRef.current = null;
    canRestartRef.current = false;
    setRunKey((k) => k + 1);
  }, []);

  // Main loop: step the engine, re-record only when something changed.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = 0;
    let alive = true;
    let lastBlink: boolean | null = null;

    const loop = (now: number) => {
      if (!alive) return;
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;

      const g = gameRef.current;
      updateGame(g, dt);

      if (g.events.length > 0) {
        const handler = onSoundRef.current;
        if (handler) for (const e of g.events) handler(e.name, e.n);
        g.events.length = 0;
      }

      if (g.runEnded && savedRunRef.current !== g.runId) {
        savedRunRef.current = g.runId;
        void saveSnakeHighScore(g.score);
      }

      const restartable = isEndPhase(g) && g.phaseTime > END_INPUT_DELAY;
      const blink = Math.floor(g.time * 2.4) % 2 === 0;
      const needsBlink = g.phase === "ready" || restartable;
      const blinkChanged = needsBlink && blink !== lastBlink;
      if (restartable !== canRestartRef.current) {
        canRestartRef.current = restartable;
        g.dirty = true;
      }

      if (g.dirty || blinkChanged) {
        g.dirty = false;
        lastBlink = blink;
        picture.value = renderer.render(g, blink, restartable);
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running, renderer, picture, runKey]);

  // Persist a mid-run score if the player bails out.
  useEffect(
    () => () => {
      const g = gameRef.current;
      if (g.score > 0 && savedRunRef.current !== g.runId) {
        void saveSnakeHighScore(g.score);
      }
    },
    [],
  );

  // ---- input ----
  const onAny = useCallback(() => {
    const g = gameRef.current;
    if (canRestartRef.current) restart();
    else if (g.phase === "ready") togglePause(g);
  }, [restart]);

  const onDir = useCallback(
    (d: Dir) => {
      if (canRestartRef.current) return restart();
      setDirection(gameRef.current, d);
    },
    [restart],
  );

  const onPause = useCallback(() => {
    if (canRestartRef.current) return restart();
    togglePause(gameRef.current);
  }, [restart]);

  // "C": always starts a fresh game.
  const onNew = useCallback(() => restart(), [restart]);

  // Swipe anywhere on the screen to steer; a tap starts / restarts.
  const handleScreenStart = useCallback((e: any) => {
    swipeRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  }, []);
  const handleScreenMove = useCallback(
    (e: any) => {
      const s = swipeRef.current;
      if (!s) return;
      const dx = e.nativeEvent.pageX - s.x;
      const dy = e.nativeEvent.pageY - s.y;
      if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return;
      swipeRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      onDir(
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0,
      );
    },
    [onDir],
  );
  const handleScreenEnd = useCallback(() => {
    const had = swipeRef.current;
    swipeRef.current = null;
    if (had) onAny(); // a tap (no swipe consumed) acts like "any key"
  }, [onAny]);

  return (
    <View style={styles.root}>
      <Header onExit={onExit} />

      <View
        style={[
          styles.bezel,
          { width: layout.panelW, height: layout.panelH, marginBottom: PANEL_GAP },
        ]}
      >
        <View style={styles.bezelInner}>
          <View
            style={styles.lcd}
            onTouchStart={handleScreenStart}
            onTouchMove={handleScreenMove}
            onTouchEnd={handleScreenEnd}
            onTouchCancel={handleScreenEnd}
          >
            <Canvas
              pointerEvents="none"
              style={{ width: layout.canvasW, height: layout.canvasH }}
            >
              <Picture picture={picture} />
            </Canvas>
          </View>
        </View>
      </View>

      <Controls
        height={layout.controlsH}
        onDir={onDir}
        onAny={onAny}
        onPause={onPause}
        onNew={onNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.body,
    alignItems: "center",
  },
  header: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 18,
    paddingRight: 6,
  },
  headerTitle: {
    color: C.title,
    fontFamily: SNAKE_FONT,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 5,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  // screen bezel (outer silver ring, inner dark ring, LCD)
  bezel: {
    backgroundColor: C.bezelOuter,
    borderRadius: 26,
    padding: BEZEL - 3,
    borderWidth: 1,
    borderColor: C.bodyEdge,
  },
  bezelInner: {
    flex: 1,
    backgroundColor: C.bezelInner,
    borderRadius: 20,
    padding: 3,
  },
  lcd: {
    flex: 1,
    backgroundColor: C.lcdMid,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // keypad
  controls: {
    alignSelf: "stretch",
    paddingHorizontal: SIDE + 6,
    paddingBottom: 12,
  },
  navRow: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cKey: {
    width: 54,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.keyFace,
    borderWidth: 1,
    borderColor: C.keyEdge,
    borderBottomWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cKeyText: {
    color: C.keyLabel,
    fontWeight: "700",
    fontSize: 16,
    fontFamily: SNAKE_FONT,
  },
  navKey: {
    width: 104,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.navFace,
    borderWidth: 1,
    borderColor: C.keyEdge,
    borderBottomWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  navLine: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.blue,
  },
  rocker: {
    width: 64,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.rocker,
    borderWidth: 1,
    borderColor: C.keyEdge,
    overflow: "hidden",
    flexDirection: "row",
  },
  rockerHalf: { flex: 1, alignItems: "center", justifyContent: "center" },
  rockerDown: { backgroundColor: "rgba(0,0,0,0.22)" },
  rockerSplit: { width: 1, backgroundColor: C.keyEdge },
  keypad: { flex: 1, justifyContent: "space-between" },
  keyRow: { flex: 1, flexDirection: "row", gap: 12, marginVertical: 3 },
  numKey: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 18,
    backgroundColor: C.keyFace,
    borderWidth: 1,
    borderColor: C.keyEdge,
    borderBottomWidth: 4,
  },
  numKeyDown: {
    borderBottomWidth: 1,
    transform: [{ translateY: 2 }],
    backgroundColor: "#b4b9c0",
  },
  keyDigit: {
    color: C.keyLabel,
    fontWeight: "800",
    fontSize: 20,
    fontFamily: SNAKE_FONT,
  },
  keySub: { color: C.keySub, fontSize: 9, fontFamily: SNAKE_FONT },
  keyArrow: { position: "absolute", top: 4, right: 8 },
});
