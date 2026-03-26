import { ThemeContext } from "@/context/ThemeContext";
import { TimerMode } from "@/context/TimerContext";
import { useContext, useRef, useEffect, useState } from "react";
import { Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import CountdownPickerModal from "@/components/ui/timer-logs/countdown-picker-modal";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE = 250;
const RADIUS = 125;
const STROKE = 6;
const CIRCLE_R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
const FLIP_DURATION = 580;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const withAlpha = (hex: string, alpha: string): string =>
  `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

const pad = (n: number) => n.toString().padStart(2, "0");

const toTimeStr = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimerDisplayProps {
  time: number;
  mode: TimerMode;
  countdownTarget: number;
  isRunning: boolean;
  onToggleMode: () => void;
  onCountdownTargetChange: (seconds: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimerDisplay({
  time,
  mode,
  countdownTarget,
  isRunning,
  onToggleMode,
  onCountdownTargetChange,
}: TimerDisplayProps) {
  const { theme } = useContext(ThemeContext);

  // ── Flip ──────────────────────────────────────────────────────────────────
  // useState so re-render fires after each flip, recalculating outputRange
  const [showingFront, setShowingFront] = useState(true);
  const showingFrontRef = useRef(true); // ref copy for use inside callback
  const countDownRef = useRef(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const isFlipping = useRef(false);

  // Sync face when mode changes externally (e.g. resetState() in context)
  useEffect(() => {
    const shouldShowFront = mode === "stopwatch";
    if (shouldShowFront !== showingFrontRef.current && !isFlipping.current) {
      showingFrontRef.current = shouldShowFront;
      setShowingFront(shouldShowFront);
      flipAnim.setValue(0);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "stopwatch") countDownRef.current = false;
    if (isRunning && mode === "countdown") countDownRef.current = true;
  }, [mode, isRunning]);

  // ── Picker modal ──────────────────────────────────────────────────────────
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleTap = () => {
    if (mode === "countdown" && !isRunning) setPickerVisible(true);
  };

  const handleLongPress = () => {
    if (isRunning || isFlipping.current) return;
    isFlipping.current = true;
    onToggleMode();
    flipAnim.setValue(0);
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start(() => {
      const next = !showingFrontRef.current;
      showingFrontRef.current = next;
      setShowingFront(next);
      isFlipping.current = false;
      flipAnim.setValue(0);
    });
  };

  // Recomputed every render because showingFront is state — this is correct
  const aRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: showingFront
      ? ["0deg", "90deg", "90deg"]
      : ["-90deg", "-90deg", "0deg"],
  });
  const bRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: showingFront
      ? ["-90deg", "-90deg", "0deg"]
      : ["0deg", "90deg", "90deg"],
  });

  // ── Pulse ─────────────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevSecond = useRef(-1);
  useEffect(() => {
    if (mode !== "stopwatch" || !isRunning) return;
    const s = Math.floor(time);
    if (s !== prevSecond.current) {
      prevSecond.current = s;
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [time, mode, isRunning]);

  // ── SVG drain ring ────────────────────────────────────────────────────────
  const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
  const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
  const ringColor =
    mode === "countdown" && time <= 10 && time > 0
      ? "#ef4444"
      : theme.timerBase;

  // ── Face content ──────────────────────────────────────────────────────────
  // Reverted to the last working version — no mode-isolation logic.
  // Face A: elapsed stopwatch time
  // Face B: remaining time when running, target when idle
  const faceAText = toTimeStr(time);
  const faceBText = toTimeStr(isRunning || countDownRef.current ? time : countdownTarget);

  const renderFace = (
    rotateY: Animated.AnimatedInterpolation<string>,
    isAbsolute: boolean,
    text: string,
  ) => (
    <Animated.View
      style={[
        styles.face,
        isAbsolute && styles.absoluteFace,
        { borderColor: withAlpha(theme.timerBase, "44") },
        {
          transform: [{ perspective: 800 }, { rotateY }],
          backfaceVisibility: "hidden",
        },
      ]}
    >
      <Text style={[styles.time, { color: theme.timerBase }]}>{text}</Text>
    </Animated.View>
  );

  //  console.log("showingFrontState:", showingFront);
  //  console.log("showingFrontRef:", showingFrontRef.current);
  //  console.log("mode:",mode)
  //  console.log("isRunning:",isRunning)
  //  console.log("isFlipping:",isFlipping.current)
  //  console.log("TIME:", time)
  //  console.log("Stopwatch face text:", faceAText);
  //  console.log("Countdown face text:", faceBText);
  return (
    <>
      <TouchableOpacity
        onPress={handleTap}
        onLongPress={handleLongPress}
        delayLongPress={350}
        activeOpacity={isRunning ? 1 : 0.85}
      >
        <Animated.View
          style={[styles.outer, { transform: [{ scale: pulseAnim }] }]}
        >
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={CIRCLE_R}
              stroke={withAlpha(theme.timerBase, "22")}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={CIRCLE_R}
              stroke={ringColor}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>

          {renderFace(aRotate, false, faceAText)}
          {renderFace(bRotate, true, faceBText)}
        </Animated.View>
      </TouchableOpacity>

      <CountdownPickerModal
        visible={pickerVisible}
        countdownTarget={countdownTarget}
        onChange={onCountdownTargetChange}
        onClose={() => setPickerVisible(false)}
        color={theme.timerBase}
        darkBg={theme.timerDarkPrimary}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  absoluteFace: { position: "absolute" },
  time: {
    fontSize: 40,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 2,
  },
});
