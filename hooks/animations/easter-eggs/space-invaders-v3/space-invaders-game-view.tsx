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
  type Game,
  type GameEventName,
  type GameInput,
} from "./space-invaders-engine";
import { createSkiaRenderer } from "./space-invaders-skia-renderer";
import { saveHighScore } from "./space-invaders-storage";
import { SI_COLORS, SI_FONT } from "./space-invaders-theme";

export type SpaceInvadersSoundHandler = (name: GameEventName, n?: number) => void;

interface Props {
  game: Game;
  width: number;
  height: number;
  running: boolean;
  onExit: () => void;
  onSound?: SpaceInvadersSoundHandler;
}

const HEADER_H = 46;
const CONTROLS_H = 104;
const IDLE_INPUT: GameInput = { left: false, right: false, fire: false };

type Touches = ReadonlyArray<{ locationX: number }>;
type TouchEvt = { nativeEvent: { touches: Touches } };

const Header = React.memo(function Header({ onExit }: { onExit: () => void }) {
  return (
    <View style={[styles.header, { height: HEADER_H }]}>
      <Text style={styles.headerTitle}>SPACE INVADERS</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quit Space Invaders"
        onPress={onExit}
        hitSlop={10}
        style={styles.closeButton}
      >
        <MaterialCommunityIcons name="close" size={22} color={SI_COLORS.white} />
      </Pressable>
    </View>
  );
});

// Only re-renders when a button is pressed / released.
const Controls = React.memo(function Controls({
  pressed,
  canRestart,
  onLayoutWidth,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  pressed: { left: boolean; right: boolean; fire: boolean };
  canRestart: boolean;
  onLayoutWidth: (w: number) => void;
  onTouchStart: (e: TouchEvt) => void;
  onTouchMove: (e: TouchEvt) => void;
  onTouchEnd: (e: TouchEvt) => void;
}) {
  return (
    <View
      style={[styles.controls, { height: CONTROLS_H }]}
      onLayout={(e) => onLayoutWidth(e.nativeEvent.layout.width)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <View pointerEvents="none" style={styles.zone}>
        <View style={[styles.button, pressed.left && styles.buttonOn]}>
          <MaterialCommunityIcons name="chevron-left" size={44} color={SI_COLORS.green} />
        </View>
      </View>
      <View pointerEvents="none" style={styles.zone}>
        <View style={[styles.button, pressed.right && styles.buttonOn]}>
          <MaterialCommunityIcons name="chevron-right" size={44} color={SI_COLORS.green} />
        </View>
      </View>
      <View pointerEvents="none" style={[styles.zone, { flex: 2 }]}>
        <View style={[styles.button, styles.fire, pressed.fire && styles.fireOn]}>
          <MaterialCommunityIcons name="rocket-launch" size={30} color={SI_COLORS.red} />
          <Text style={styles.fireText}>{canRestart ? "PLAY AGAIN" : "FIRE"}</Text>
        </View>
      </View>
    </View>
  );
});

// ---- Game view -------------------------------------------------------------
export function SpaceInvadersGameView({
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
  const ctrlWidthRef = useRef(1);
  const canRestartRef = useRef(false);

  const [runKey, setRunKey] = useState(0);
  const [canRestart, setCanRestart] = useState(false);
  const [pressed, setPressed] = useState({ left: false, right: false, fire: false });

  // Pixel-perfect integer scale (whole device pixels per arcade pixel).
  const ratio = PixelRatio.get();
  const availW = width - 12;
  const availH = height - HEADER_H - CONTROLS_H - 8;
  const raw = Math.min(availW / WORLD_W, availH / WORLD_H);
  const scale = Math.max(Math.floor(raw * ratio) / ratio, 0.5);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // One recorder, one shared value. The loop below writes a fresh SkPicture
  // into it every frame; Skia draws it on the UI thread without any React work.
  const renderer = useMemo(() => createSkiaRenderer(), []);
  const picture = useSharedValue(
    useMemo(() => renderer.render(game, scale, true, false), []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Redraw immediately on resize / restart (also what shows READY! while loading).
  useEffect(() => {
    picture.value = renderer.render(gameRef.current, scale, true, false);
  }, [scale, runKey, renderer, picture]);

  const restart = useCallback(() => {
    const prev = gameRef.current;
    gameRef.current = createReadyGame(Math.max(prev.hi, prev.score));
    inputRef.current = { ...IDLE_INPUT };
    savedRunRef.current = null;
    canRestartRef.current = false;
    setCanRestart(false);
    setPressed({ left: false, right: false, fire: false });
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
        setCanRestart(restartable); // the only React update during play
      }

      const blink = Math.floor(g.time * 2.4) % 2 === 0;
      picture.value = renderer.render(g, scaleRef.current, blink, restartable);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running, renderer, picture]);

  // Persist a mid-run score if the player bails out.
  useEffect(
    () => () => {
      const g = gameRef.current;
      if (g.score > 0 && savedRunRef.current !== g.runId) {
        void saveHighScore(g.score);
      }
    },
    [],
  );

  // Touch controls: raw touches so left/right and fire work together.
  const applyTouches = useCallback((touches: Touches) => {
    const w = ctrlWidthRef.current || 1;
    let left = false;
    let right = false;
    let fire = false;
    for (let i = 0; i < touches.length; i++) {
      const f = touches[i].locationX / w;
      if (f < 0.25) left = true;
      else if (f < 0.5) right = true;
      else fire = true;
    }
    inputRef.current = { left, right, fire };
    setPressed((p) =>
      p.left === left && p.right === right && p.fire === fire
        ? p
        : { left, right, fire },
    );
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvt) => {
      if (canRestartRef.current) {
        restart();
        return;
      }
      applyTouches(e.nativeEvent.touches);
    },
    [applyTouches, restart],
  );
  const handleTouchMove = useCallback(
    (e: TouchEvt) => applyTouches(e.nativeEvent.touches),
    [applyTouches],
  );
  const handleLayoutWidth = useCallback((w: number) => {
    ctrlWidthRef.current = w;
  }, []);

  return (
    <View style={styles.root}>
      <Header onExit={onExit} />

      <View style={styles.worldWrap}>
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
        pressed={pressed}
        canRestart={canRestart}
        onLayoutWidth={handleLayoutWidth}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchMove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SI_COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 6,
  },
  headerTitle: {
    color: SI_COLORS.green,
    fontFamily: SI_FONT,
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
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderRadius: 14,
    borderColor: "rgba(61,255,90,0.45)",
    backgroundColor: "rgba(61,255,90,0.06)",
  },
  buttonOn: {
    backgroundColor: "rgba(61,255,90,0.28)",
    borderColor: SI_COLORS.green,
  },
  fire: {
    borderColor: "rgba(255,58,58,0.5)",
    backgroundColor: "rgba(255,58,58,0.07)",
    gap: 2,
  },
  fireOn: {
    backgroundColor: "rgba(255,58,58,0.3)",
    borderColor: SI_COLORS.red,
  },
  fireText: {
    color: SI_COLORS.red,
    fontFamily: SI_FONT,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 3,
  },
});
