/**
 * LoadingBubble — "The Oracle"
 *
 * Deps:
 *   react-native-reanimated   (already installed)
 *   @shopify/react-native-skia  >= 1.0  (install + rebuild)
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  SharedValue,
} from "react-native-reanimated";
import {
  Canvas,
  Circle,
  BlurMask,
  Group,
  RoundedRect,
  LinearGradient,
  RadialGradient,
  vec,
  Skia,
  Path,
} from "@shopify/react-native-skia";

// ─── Dimensions ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BUBBLE_W = Math.min(SCREEN_WIDTH * 0.78, 320);
const BUBBLE_H = 64;
const PAD = 20;

// Waveform lives on the right inside the bubble
const WAVE_RIGHT_PAD = 14;
const BAR_COUNT = 9;
const BAR_W = 2.5;
const BAR_GAP = 3.5;
const WAVEFORM_W = BAR_COUNT * (BAR_W + BAR_GAP) - BAR_GAP;
const MAX_BAR_H = 22; // short bars — inline with text

// ─── Palette ──────────────────────────────────────────────────────────────────
const ORB_COLORS = [
  [139, 92, 246],
  [59, 130, 246],
  [20, 184, 166],
  [236, 72, 153],
] as const;

// ─── Clock: driven by withRepeat so it lives on UI thread ────────────────────
// We use a 0→100000 ramp repeating — gives ~100s of unique time before looping,
// more than enough. All math is mod-safe.
const CLOCK_DURATION = 100_000;

// ─── Mesh orb ─────────────────────────────────────────────────────────────────
interface OrbProps {
  baseCx: number;
  baseCy: number;
  r: number;
  color: readonly [number, number, number];
  phaseX: number;
  phaseY: number;
  speed: number;
  clock: SharedValue<number>;
  boost: SharedValue<number>;
}

const MeshOrb: React.FC<OrbProps> = ({
  baseCx,
  baseCy,
  r,
  color,
  phaseX,
  phaseY,
  speed,
  clock,
  boost,
}) => {
  const cx = useDerivedValue(() => {
    const t = clock.value / 1000;
    const spd = speed * (1 + boost.value * 0.6);
    return baseCx + Math.sin(t * spd + phaseX) * (BUBBLE_W * 0.26);
  });
  const cy = useDerivedValue(() => {
    const t = clock.value / 1000;
    const spd = speed * (1 + boost.value * 0.6);
    return baseCy + Math.cos(t * spd * 0.7 + phaseY) * (BUBBLE_H * 0.45);
  });
  const [r0, g0, b0] = color;
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient
        c={vec(0, 0)}
        r={r}
        colors={[`rgba(${r0},${g0},${b0},0.78)`, `rgba(${r0},${g0},${b0},0)`]}
      />
      <BlurMask blur={14} style="normal" />
    </Circle>
  );
};

// ─── Halo ring ────────────────────────────────────────────────────────────────
const HaloRing: React.FC<{
  clock: SharedValue<number>;
  glowPulse: SharedValue<number>;
}> = ({ clock, glowPulse }) => {
  const W = BUBBLE_W + PAD * 2;
  const H = BUBBLE_H + PAD * 2;
  const cy = H / 2;

  const ringPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addRRect({
      rect: { x: PAD, y: PAD, width: BUBBLE_W, height: BUBBLE_H },
      rx: 26,
      ry: 26,
    });
    return p;
  }, []);

  const hue = useDerivedValue(() => (clock.value / 40) % 360);
  const alpha = useDerivedValue(() =>
    Math.min(
      1,
      0.45 + 0.25 * Math.sin(clock.value / 1200) + glowPulse.value * 0.5,
    ),
  );
  const colors = useDerivedValue(() => [
    `hsla(${hue.value},80%,65%,${alpha.value})`,
    `hsla(${(hue.value + 90) % 360},90%,70%,${alpha.value})`,
    `hsla(${(hue.value + 180) % 360},85%,60%,${alpha.value})`,
    `hsla(${(hue.value + 270) % 360},80%,65%,${alpha.value})`,
  ]);

  return (
    <Path path={ringPath} style="stroke" strokeWidth={2}>
      <LinearGradient start={vec(0, cy)} end={vec(W, cy)} colors={colors} />
      <BlurMask blur={2.5} style="solid" />
    </Path>
  );
};

// ─── Waveform bars (no BlurMask — big perf win) ───────────────────────────────
const WaveBar: React.FC<{
  index: number;
  barX: number;
  baseY: number;
  clock: SharedValue<number>;
  spike: SharedValue<number>;
}> = ({ index, barX, baseY, clock, spike }) => {
  const phase = (index / BAR_COUNT) * Math.PI * 2;
  const freq = 1.3 + index * 0.13;

  const height = useDerivedValue(() => {
    const t = clock.value / 900;
    const sinVal = Math.abs(Math.sin(t * freq + phase));
    return Math.max(
      3,
      (0.18 + sinVal * 0.82) * MAX_BAR_H * (1 + spike.value * 1.6),
    );
  });
  const y = useDerivedValue(() => baseY - height.value / 2);

  return (
    <RoundedRect x={barX} y={y} width={BAR_W} height={height} r={BAR_W / 2}>
      <LinearGradient
        start={vec(barX, baseY - MAX_BAR_H / 2)}
        end={vec(barX, baseY + MAX_BAR_H / 2)}
        colors={["rgba(167,139,250,0.95)", "rgba(59,130,246,0.85)"]}
      />
    </RoundedRect>
  );
};

const WaveformBars: React.FC<{
  clock: SharedValue<number>;
  spike: SharedValue<number>;
}> = ({ clock, spike }) => {
  const W = BUBBLE_W + PAD * 2;
  const H = BUBBLE_H + PAD * 2;
  // Right-aligned inside bubble
  const startX = PAD + BUBBLE_W - WAVE_RIGHT_PAD - WAVEFORM_W;
  const baseY = H / 2;

  return (
    <>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveBar
          key={i}
          index={i}
          barX={startX + i * (BAR_W + BAR_GAP)}
          baseY={baseY}
          clock={clock}
          spike={spike}
        />
      ))}
    </>
  );
};

// ─── Text layer — single animated wrapper, no per-char shared values ─────────
const EXIT_MS = 200;
const ENTER_MS = 260;

const TextLayer: React.FC<{
  text: string;
  entering: boolean;
  onExitDone?: () => void;
}> = ({ text, entering, onExitDone }) => {
  const translateY = useSharedValue(entering ? -10 : 0);
  const opacity = useSharedValue(entering ? 0 : 1);

  useEffect(() => {
    if (entering) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
      opacity.value = withTiming(1, { duration: ENTER_MS });
    } else {
      translateY.value = withTiming(10, {
        duration: EXIT_MS,
        easing: Easing.in(Easing.quad),
      });
      opacity.value = withTiming(0, {
        duration: EXIT_MS,
        easing: Easing.in(Easing.quad),
      });
      if (onExitDone) {
        const t = setTimeout(onExitDone, EXIT_MS + 20);
        return () => clearTimeout(t);
      }
    }
  }, [entering]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.char, style]} numberOfLines={2}>
      {text}
    </Animated.Text>
  );
};

// ─── Oracle GPU canvas ────────────────────────────────────────────────────────
const OracleCanvas: React.FC<{
  clock: SharedValue<number>;
  boost: SharedValue<number>;
  glowPulse: SharedValue<number>;
  spike: SharedValue<number>;
}> = ({ clock, boost, glowPulse, spike }) => {
  const W = BUBBLE_W + PAD * 2;
  const H = BUBBLE_H + PAD * 2;
  const cx = W / 2;
  const cy = H / 2;

  return (
    <Canvas style={{ width: W, height: H }}>
      {/* Dark glass base */}
      <RoundedRect x={PAD} y={PAD} width={BUBBLE_W} height={BUBBLE_H} r={26}>
        <LinearGradient
          start={vec(PAD, PAD)}
          end={vec(PAD + BUBBLE_W, PAD + BUBBLE_H)}
          colors={["rgba(12,8,32,0.94)", "rgba(8,18,42,0.94)"]}
        />
      </RoundedRect>

      {/* Mesh orbs — clipped */}
      <Group clip={{ x: PAD, y: PAD, width: BUBBLE_W, height: BUBBLE_H }}>
        <MeshOrb
          baseCx={W * 0.2}
          baseCy={cy}
          r={50}
          color={ORB_COLORS[0]}
          phaseX={0}
          phaseY={0.5}
          speed={0.38}
          clock={clock}
          boost={boost}
        />
        <MeshOrb
          baseCx={W * 0.5}
          baseCy={cy}
          r={44}
          color={ORB_COLORS[1]}
          phaseX={1.2}
          phaseY={2.1}
          speed={0.45}
          clock={clock}
          boost={boost}
        />
        <MeshOrb
          baseCx={W * 0.78}
          baseCy={cy}
          r={46}
          color={ORB_COLORS[2]}
          phaseX={2.4}
          phaseY={0.9}
          speed={0.33}
          clock={clock}
          boost={boost}
        />
        <MeshOrb
          baseCx={W * 0.5}
          baseCy={cy}
          r={38}
          color={ORB_COLORS[3]}
          phaseX={3.6}
          phaseY={1.7}
          speed={0.52}
          clock={clock}
          boost={boost}
        />
      </Group>

      {/* Frosted glass overlay */}
      <RoundedRect x={PAD} y={PAD} width={BUBBLE_W} height={BUBBLE_H} r={26}>
        <LinearGradient
          start={vec(PAD, PAD)}
          end={vec(PAD + BUBBLE_W, PAD + BUBBLE_H)}
          colors={["rgba(0,0,0,0.26)", "rgba(0,0,0,0.12)"]}
        />
      </RoundedRect>

      {/* Waveform — right side */}
      <WaveformBars clock={clock} spike={spike} />

      {/* Halo ring */}
      <HaloRing clock={clock} glowPulse={glowPulse} />
    </Canvas>
  );
};

// ─── Main LoadingBubble ───────────────────────────────────────────────────────
interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

export const LoadingBubble: React.FC<Props> = ({ isUser, agentProgress }) => {
  // ── Dots (isUser) ──────────────────────────────────────────────────────────
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    if (!isUser) return;
    const go = (d: SharedValue<number>, delay: number) => {
      d.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.3, {
              duration: 400,
              easing: Easing.inOut(Easing.sin),
            }),
          ),
          -1,
          false,
        ),
      );
    };
    go(dot1, 0);
    go(dot2, 200);
    go(dot3, 400);
  }, [isUser]);

  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  // ── Skia shared values ─────────────────────────────────────────────────────
  const clock = useSharedValue(0);
  const boost = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const spike = useSharedValue(0);

  // Clock runs entirely on UI thread — no RAF, no JS involvement
  useEffect(() => {
    if (isUser) return;
    clock.value = withRepeat(
      withTiming(CLOCK_DURATION, {
        duration: CLOCK_DURATION,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [isUser]);

  // ── Bubble breathe ─────────────────────────────────────────────────────────
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (isUser) return;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.016, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.984, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [isUser]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  // ── Text state machine ─────────────────────────────────────────────────────
  // All guards in refs so effects never close over stale state
  const [displayed, setDisplayed] = useState(agentProgress ?? "");
  const [incoming, setIncoming] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const displayedRef = useRef(agentProgress ?? "");
  const exitingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const incomingRef = useRef<string | null>(null);

  const setDisplayedSync = useCallback((v: string) => {
    displayedRef.current = v;
    setDisplayed(v);
  }, []);

  const fireFx = useCallback(() => {
    boost.value = 1;
    boost.value = withTiming(0, { duration: 900 });
    glowPulse.value = 1;
    glowPulse.value = withTiming(0, { duration: 600 });
    spike.value = 1;
    spike.value = withTiming(0, { duration: 700 });
  }, []);

  const startTransition = useCallback(
    (newText: string) => {
      fireFx();
      exitingRef.current = true;
      incomingRef.current = newText;
      setExiting(true);
      setIncoming(newText);
    },
    [fireFx],
  );

  useEffect(() => {
    if (!agentProgress || agentProgress === displayedRef.current) return;
    if (exitingRef.current) {
      pendingRef.current = agentProgress;
      return;
    }
    startTransition(agentProgress);
  }, [agentProgress]);

  const onExitDone = useCallback(() => {
    const next = pendingRef.current;
    setDisplayedSync(incomingRef.current ?? "");
    setIncoming(null);
    setExiting(false);
    exitingRef.current = false;
    if (next) {
      pendingRef.current = null;
      setTimeout(() => startTransition(next), 40);
    }
  }, [startTransition, setDisplayedSync]);

  // ── isUser render ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <View style={[styles.plainBubble, { alignSelf: "flex-end" }]}>
        <Animated.View style={[styles.plainDot, dot1Style]} />
        <Animated.View style={[styles.plainDot, dot2Style]} />
        <Animated.View style={[styles.plainDot, dot3Style]} />
      </View>
    );
  }

  // ── Oracle render ──────────────────────────────────────────────────────────
  const W = BUBBLE_W + PAD * 2;
  const H = BUBBLE_H + PAD * 2;

  return (
    <Animated.View
      style={[styles.wrapper, breatheStyle, { alignSelf: "flex-start" }]}
    >
      {/* GPU canvas */}
      <View
        style={{
          position: "absolute",
          top: -PAD,
          left: -PAD,
          width: W,
          height: H,
        }}
        pointerEvents="none"
      >
        <OracleCanvas
          clock={clock}
          boost={boost}
          glowPulse={glowPulse}
          spike={spike}
        />
      </View>

      {/* Text overlay — paddingRight clears the waveform on the right */}
      <View style={styles.textContainer} pointerEvents="none">
        {exiting && displayed ? (
          <TextLayer
            text={displayed}
            entering={false}
            onExitDone={onExitDone}
          />
        ) : null}
        {incoming != null ? (
          <TextLayer text={incoming} entering={true} />
        ) : !exiting && displayed ? (
          <TextLayer text={displayed} entering={true} />
        ) : null}
      </View>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    width: BUBBLE_W,
    height: BUBBLE_H,
    marginLeft: 10,
    marginVertical: 4,
  },
  textContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    // paddingRight reserves space for the waveform (right-aligned in canvas)
    right: WAVEFORM_W + WAVE_RIGHT_PAD + 10,
    bottom: 0,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 14,
  },
  char: {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(230,220,255,0.95)",
    letterSpacing: 0.2,
    textShadowColor: "rgba(167,139,250,0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  plainBubble: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    flexDirection: "row",
    marginRight: 10,
    alignItems: "center",
  },
  plainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
