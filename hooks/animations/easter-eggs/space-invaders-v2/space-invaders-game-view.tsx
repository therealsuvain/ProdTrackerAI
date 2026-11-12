import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { PixelRatio, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import {
  END_INPUT_DELAY,
  PLAYER_Y,
  UFO_Y,
  WORLD_H,
  WORLD_W,
  createReadyGame,
  isEndPhase,
  updateGame,
  type AlienBullet,
  type Game,
  type GameEventName,
  type GameInput,
  type Invader,
  type Phase,
  type Shield,
} from "./space-invaders-engine";
import {
  bitmapToRects,
  getAtlas,
  makeBitmap,
  type SpriteKey,
} from "./space-invaders-sprites";
import { saveHighScore } from "./space-invaders-storage";
import { SI_COLORS, SI_FONT } from "./space-invaders-theme";
import { Sprite, SpriteBody } from "./space-invaders-sprite-view";

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
const FORM_WIDTHS = { squid: 8, crab: 11, octopus: 12 } as const;

type Touches = ReadonlyArray<{ locationX: number }>;
type TouchEvt = { nativeEvent: { touches: Touches } };

// ---- Memoised world pieces -------------------------------------------------
// Each invader is rendered once per animation frame (A / B) and never touched
// again until it dies. Stepping the formation only flips two layers and moves
// one container, instead of re-rendering 55 sprites.
const InvaderBody = React.memo(function InvaderBody({
  kind,
  variant,
  x,
  y,
  scale,
}: {
  kind: Invader["kind"];
  variant: "A" | "B";
  x: number;
  y: number;
  scale: number;
}) {
  const sprite = getAtlas()[`${kind}${variant}` as SpriteKey];
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: x * scale, top: y * scale }}
    >
      <SpriteBody sprite={sprite} color={SI_COLORS.white} scale={scale} />
    </View>
  );
});

const Formation = React.memo(function Formation({
  invaders,
  formX,
  formY,
  frame,
  killVersion,
  scale,
}: {
  invaders: Invader[];
  formX: number;
  formY: number;
  frame: 0 | 1;
  killVersion: number; // invalidates the cells when an invader dies
  scale: number;
}) {
  const cells = useMemo(() => {
    const build = (variant: "A" | "B") =>
      invaders.map((inv) =>
        inv.alive ? (
          <InvaderBody
            key={`${inv.row}-${inv.col}`}
            kind={inv.kind}
            variant={variant}
            x={inv.col * 16 + ((16 - FORM_WIDTHS[inv.kind]) >> 1)}
            y={inv.row * 16}
            scale={scale}
          />
        ) : null,
      );
    return { a: build("A"), b: build("B") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killVersion, scale, invaders]);

  const layerSize = { width: 176 * scale, height: 80 * scale };

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        ...layerSize,
        transform: [{ translateX: formX * scale }, { translateY: formY * scale }],
      }}
    >
      <View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.layer,
          layerSize,
          { display: frame === 0 ? "flex" : "none" },
        ]}
      >
        {cells.a}
      </View>
      <View
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
        style={[
          styles.layer,
          layerSize,
          { display: frame === 1 ? "flex" : "none" },
        ]}
      >
        {cells.b}
      </View>
    </View>
  );
});

const ShieldView = React.memo(function ShieldView({
  shield,
  version,
  scale,
}: {
  shield: Shield;
  version: number;
  scale: number;
}) {
  const rects = useMemo(() => {
    const rows: string[] = [];
    for (let y = 0; y < 16; y++) {
      let row = "";
      for (let x = 0; x < 22; x++) row += shield.px[y * 22 + x] ? "X" : ".";
      rows.push(row);
    }
    return bitmapToRects(makeBitmap(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shield, version]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: shield.x * scale,
        top: shield.y * scale,
        width: 22 * scale,
        height: 16 * scale,
      }}
    >
      {rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: r.x * scale,
            top: r.y * scale,
            width: r.w * scale,
            height: r.h * scale,
            backgroundColor: SI_COLORS.green,
          }}
        />
      ))}
    </View>
  );
});

const WText = React.memo(function WText({
  x,
  y,
  w,
  size,
  scale,
  color = SI_COLORS.white,
  align = "left",
  children,
}: {
  x: number;
  y: number;
  w: number;
  size: number;
  scale: number;
  color?: string;
  align?: "left" | "center" | "right";
  children: string | number;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={{
        position: "absolute",
        left: x * scale,
        top: y * scale,
        width: w * scale,
        textAlign: align,
        color,
        fontFamily: SI_FONT,
        fontWeight: "700",
        fontSize: size * scale,
        lineHeight: (size + 2) * scale,
        includeFontPadding: false,
      }}
    >
      {children}
    </Text>
  );
});

function bulletSprite(b: AlienBullet): SpriteKey {
  switch (b.kind) {
    case "plunger":
      return "plunger";
    case "rolling":
      return b.frame === 0 ? "rollA" : "rollB";
    case "squiggly":
      return b.frame === 0 ? "squigA" : "squigB";
    default:
      return "orb";
  }
}

const pad = (n: number) => String(n).padStart(5, "0");

// ---- Memoised HUD / overlays: only re-render when their own values change ---
const Hud = React.memo(function Hud({
  score,
  hi,
  level,
  scale,
}: {
  score: number;
  hi: number;
  level: 1 | 2;
  scale: number;
}) {
  return (
    <>
      <WText x={8} y={3} w={64} size={8} scale={scale}>
        SCORE
      </WText>
      <WText x={8} y={13} w={64} size={8} scale={scale} color={SI_COLORS.green}>
        {pad(score)}
      </WText>
      <WText x={80} y={3} w={64} size={8} scale={scale} align="center">
        HI-SCORE
      </WText>
      <WText
        x={80}
        y={13}
        w={64}
        size={8}
        scale={scale}
        align="center"
        color={SI_COLORS.red}
      >
        {pad(hi)}
      </WText>
      <WText x={152} y={3} w={64} size={8} scale={scale} align="right">
        {level === 1 ? "WAVE 1" : "FINAL"}
      </WText>
      <WText
        x={152}
        y={13}
        w={64}
        size={8}
        scale={scale}
        align="right"
        color={level === 1 ? SI_COLORS.green : SI_COLORS.red}
      >
        {level === 1 ? "INVADERS" : "BOSS"}
      </WText>
    </>
  );
});

const Footer = React.memo(function Footer({
  lives,
  scale,
}: {
  lives: number;
  scale: number;
}) {
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 239 * scale,
          width: WORLD_W * scale,
          height: Math.max(scale, 1),
          backgroundColor: SI_COLORS.green,
        }}
      />
      <WText x={8} y={243} w={12} size={8} scale={scale}>
        {lives}
      </WText>
      {Array.from({ length: Math.max(0, lives - 1) }).map((_, i) => (
        <Sprite
          key={i}
          name="player"
          x={22 + i * 16}
          y={244}
          color={SI_COLORS.green}
          scale={scale}
        />
      ))}
      <WText x={136} y={243} w={80} size={8} scale={scale} align="right">
        CREDIT 01
      </WText>
    </>
  );
});

const BossBar = React.memo(function BossBar({
  hp,
  maxHp,
  color,
  scale,
  borderW,
}: {
  hp: number;
  maxHp: number;
  color: string;
  scale: number;
  borderW: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 24 * scale,
        top: 25 * scale,
        width: 176 * scale,
        height: 4 * scale,
        borderWidth: borderW,
        borderColor: SI_COLORS.red,
      }}
    >
      <View
        style={{
          width: `${(hp / maxHp) * 100}%`,
          height: "100%",
          backgroundColor: color,
        }}
      />
    </View>
  );
});

const Banners = React.memo(function Banners({
  phase,
  blink,
  scale,
}: {
  phase: Phase;
  blink: boolean;
  scale: number;
}) {
  if (phase === "ready") {
    return (
      <>
        <WText x={0} y={118} w={WORLD_W} size={14} scale={scale} align="center">
          READY!
        </WText>
        <WText
          x={0} y={138} w={WORLD_W} size={8} scale={scale} align="center"
          color={SI_COLORS.green}
        >
          WAVE 1
        </WText>
      </>
    );
  }
  if (phase === "waveClear") {
    return (
      <>
        <WText
          x={0} y={112} w={WORLD_W} size={14} scale={scale} align="center"
          color={SI_COLORS.green}
        >
          WAVE CLEARED
        </WText>
        <WText x={0} y={132} w={WORLD_W} size={8} scale={scale} align="center">
          SOMETHING IS COMING...
        </WText>
      </>
    );
  }
  if (phase === "bossIntro") {
    return (
      <>
        <WText
          x={0} y={112} w={WORLD_W} size={16} scale={scale} align="center"
          color={blink ? SI_COLORS.red : SI_COLORS.white}
        >
          WARNING!
        </WText>
        <WText
          x={0} y={134} w={WORLD_W} size={8} scale={scale} align="center"
          color={SI_COLORS.red}
        >
          FINAL BOSS APPROACHING
        </WText>
      </>
    );
  }
  if (phase === "bossDying") {
    return (
      <WText
        x={0} y={118} w={WORLD_W} size={14} scale={scale} align="center"
        color={blink ? SI_COLORS.white : SI_COLORS.red}
      >
        BOSS DOWN!
      </WText>
    );
  }
  return null;
});

const EndCard = React.memo(function EndCard({
  victory,
  reason,
  score,
  hi,
  newRecord,
  blink,
  canRestart,
  scale,
  borderW,
}: {
  victory: boolean;
  reason: Game["endReason"];
  score: number;
  hi: number;
  newRecord: boolean;
  blink: boolean;
  canRestart: boolean;
  scale: number;
  borderW: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16 * scale,
        top: 74 * scale,
        width: 192 * scale,
        height: 108 * scale,
        backgroundColor: "rgba(0,0,0,0.88)",
        borderWidth: borderW,
        borderColor: victory ? SI_COLORS.green : SI_COLORS.red,
      }}
    >
      <WText
        x={0} y={8} w={190} size={16} scale={scale} align="center"
        color={victory ? SI_COLORS.green : SI_COLORS.red}
      >
        {victory ? "YOU WIN!" : "GAME OVER"}
      </WText>
      <WText x={0} y={30} w={190} size={8} scale={scale} align="center" color={SI_COLORS.dim}>
        {victory
          ? "EARTH IS SAFE"
          : reason === "invaded"
            ? "THE INVADERS LANDED"
            : "YOU WERE SHOT DOWN"}
      </WText>
      <WText x={0} y={46} w={190} size={10} scale={scale} align="center">
        {`SCORE ${pad(score)}`}
      </WText>
      <WText
        x={0} y={60} w={190} size={10} scale={scale} align="center"
        color={SI_COLORS.red}
      >
        {`HI-SCORE ${pad(hi)}`}
      </WText>
      {newRecord && (
        <WText
          x={0} y={76} w={190} size={8} scale={scale} align="center"
          color={blink ? SI_COLORS.green : SI_COLORS.white}
        >
          NEW HIGH SCORE!
        </WText>
      )}
      {canRestart && (
        <WText
          x={0} y={92} w={190} size={8} scale={scale} align="center"
          color={blink ? SI_COLORS.white : SI_COLORS.dim}
        >
          TAP TO PLAY AGAIN
        </WText>
      )}
    </View>
  );
});

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

// The icon-heavy controls only re-render when a button is pressed/released.
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

  const [runKey, setRunKey] = useState(0);
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [pressed, setPressed] = useState({ left: false, right: false, fire: false });

  const restart = useCallback(() => {
    const prev = gameRef.current;
    gameRef.current = createReadyGame(Math.max(prev.hi, prev.score));
    inputRef.current = { ...IDLE_INPUT };
    savedRunRef.current = null;
    setPressed({ left: false, right: false, fire: false });
    setRunKey((k) => k + 1);
  }, []);

  // Main loop
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

      force();
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running]);

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
      const g = gameRef.current;
      if (isEndPhase(g) && g.phaseTime > END_INPUT_DELAY) {
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

  const g = gameRef.current;

  const ratio = PixelRatio.get();
  const availW = width - 12;
  const availH = height - HEADER_H - CONTROLS_H - 8;
  const raw = Math.min(availW / WORLD_W, availH / WORLD_H);
  const scale = Math.max(Math.floor(raw * ratio) / ratio, 0.5);
  const borderW = Math.max(1 / ratio, 0.5);

  const ended = isEndPhase(g);
  const canRestart = ended && g.phaseTime > END_INPUT_DELAY;
  const blink = Math.floor(g.time * 2.4) % 2 === 0;

  // Player sprite choice
  const playerDying = g.phase === "playerDying";
  const playerWrecked = g.phase === "gameOver" && g.endReason === "shot";
  const deathFrame = Math.floor(g.phaseTime / 0.12) % 2 === 0 ? "playerBoomA" : "playerBoomB";

  // Boss colour
  const boss = g.boss;
  const bossColor = !boss
    ? SI_COLORS.red
    : boss.flash > 0
      ? SI_COLORS.white
      : boss.stage === 3
        ? SI_COLORS.orange
        : SI_COLORS.red;
  const bossVisible =
    !!boss && (g.phase !== "bossDying" || Math.floor(g.phaseTime * 14) % 2 === 0);

  return (
    <View style={styles.root}>
      <Header onExit={onExit} />

      {/* Playfield */}
      <View style={styles.worldWrap}>
        <Pressable
          disabled={!canRestart}
          onPress={restart}
          style={{ width: WORLD_W * scale, height: WORLD_H * scale }}
        >
          <View
            key={runKey}
            style={{
              width: WORLD_W * scale,
              height: WORLD_H * scale,
              backgroundColor: SI_COLORS.bg,
              overflow: "hidden",
            }}
          >
            <Hud score={g.score} hi={g.hi} level={g.level} scale={scale} />

            {boss && g.level === 2 && (
              <BossBar
                hp={boss.hp}
                maxHp={boss.maxHp}
                color={bossColor}
                scale={scale}
                borderW={borderW}
              />
            )}

            {g.ufo.active && (
              <Sprite name="ufo" x={g.ufo.x} y={UFO_Y} color={SI_COLORS.red} scale={scale} />
            )}

            <Formation
              invaders={g.invaders}
              formX={g.formX}
              formY={g.formY}
              frame={g.formFrame}
              killVersion={g.killVersion}
              scale={scale}
            />
            {g.shields.map((s, i) => (
              <ShieldView key={i} shield={s} version={s.version} scale={scale} />
            ))}

            {boss && bossVisible && (
              <Sprite
                name="boss"
                x={boss.x}
                y={boss.y}
                color={bossColor}
                scale={scale}
              />
            )}

            {playerDying || playerWrecked ? (
              <Sprite
                name={playerWrecked ? "playerBoomB" : deathFrame}
                x={g.playerX - 1}
                y={PLAYER_Y}
                color={SI_COLORS.green}
                scale={scale}
              />
            ) : (
              <Sprite
                name="player"
                x={g.playerX}
                y={PLAYER_Y}
                color={SI_COLORS.green}
                scale={scale}
              />
            )}

            {g.playerBullet && (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: scale,
                  height: 4 * scale,
                  backgroundColor: SI_COLORS.white,
                  transform: [
                    { translateX: Math.round(g.playerBullet.x) * scale },
                    { translateY: Math.round(g.playerBullet.y) * scale },
                  ],
                }}
              />
            )}

            {g.alienBullets.map((b) => (
              <Sprite
                key={b.id}
                name={bulletSprite(b)}
                x={b.x}
                y={b.y}
                color={b.kind === "orb" ? bossColor : SI_COLORS.white}
                scale={scale}
              />
            ))}

            {g.explosions.map((e) => {
              if (e.kind === "ufoBoom") {
                return e.age < 0.3 ? (
                  <Sprite
                    key={e.id}
                    name="ufoBoom"
                    x={e.x}
                    y={e.y}
                    color={SI_COLORS.red}
                    scale={scale}
                  />
                ) : (
                  <WText
                    key={e.id}
                    x={e.x - 8}
                    y={e.y}
                    w={32}
                    size={8}
                    scale={scale}
                    align="center"
                    color={SI_COLORS.red}
                  >
                    {e.label ?? ""}
                  </WText>
                );
              }
              const color =
                e.kind === "invaderBoom"
                  ? SI_COLORS.white
                  : e.kind === "topBoom"
                    ? SI_COLORS.red
                    : SI_COLORS.green;
              return (
                <Sprite key={e.id} name={e.kind} x={e.x} y={e.y} color={color} scale={scale} />
              );
            })}

            <Footer lives={g.lives} scale={scale} />

            <Banners phase={g.phase} blink={blink} scale={scale} />

            {ended && (
              <EndCard
                victory={g.phase === "victory"}
                reason={g.endReason}
                score={g.score}
                hi={g.hi}
                newRecord={g.newRecord}
                blink={blink}
                canRestart={canRestart}
                scale={scale}
                borderW={borderW * 2}
              />
            )}
          </View>
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
  layer: {
    position: "absolute",
    left: 0,
    top: 0,
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
