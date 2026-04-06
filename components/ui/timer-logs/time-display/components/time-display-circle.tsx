import { Animated, TouchableOpacity, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { getTimerDimensions, toTimeStr } from "../time-display.utils";
import { TimerDisplayProps } from "../time-display";
import { useTimerDisplayAnimation } from "../use-time-display.animations";
import { useHaptics } from "@/hooks/use-haptics";

interface TimerDisplayCircleProps {
  timeDisplayProps: TimerDisplayProps;
  styles: any;
  Size: number;
  onCirclePress: () => void;
}
export const TimerDisplayCircle = ({
  timeDisplayProps,
  styles,
  Size,
  onCirclePress,
}: TimerDisplayCircleProps) => {
  const { STROKE, CIRCLE_R, CIRCUMFERENCE } = getTimerDimensions(Size);
  const { aRotate, bRotate, pulseAnim, handleLongPress } = useTimerDisplayAnimation(timeDisplayProps);
  const { triggerHaptic } = useHaptics();
  const drainRatio =
    timeDisplayProps.countdownTarget > 0
      ? timeDisplayProps.time / timeDisplayProps.countdownTarget
      : 1;
  const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
  const ringColor =
    timeDisplayProps.mode === "countdown" &&
    timeDisplayProps.time <= 10 &&
    timeDisplayProps.time > 0
      ? "#ef4444"
      :styles.base;

  // ── Face content ──────────────────────────────────────────────────────────
  // Reverted to the last working version — no mode-isolation logic.
  // Face A: elapsed stopwatch time
  // Face B: remaining time when running, target when idle
  const faceAText = toTimeStr(timeDisplayProps.time);
  const faceBText = toTimeStr(
    timeDisplayProps.isRunning
      ? timeDisplayProps.time
      : timeDisplayProps.countdownTarget,
  );

  const renderFace = (
    rotateY: Animated.AnimatedInterpolation<string>,
    isAbsolute: boolean,
    text: string,
  ) => (
    <Animated.View
      style={[
        styles.face,
        isAbsolute && styles.absoluteFace,
        {
          transform: [{ perspective: 800 }, { rotateY }],
          backfaceVisibility: "hidden",
        },
      ]}
    >
      <Text style={[styles.time]}>{text}</Text>
    </Animated.View>
  );

  return (
    <TouchableOpacity
      onPress={onCirclePress}
      onLongPress={()=>{triggerHaptic();handleLongPress()}}
      delayLongPress={350}
      activeOpacity={timeDisplayProps.isRunning ? 1 : 0.85}
    >
      <Animated.View
        style={[styles.outer, { transform: [{ scale: pulseAnim }] }]}
      >
        <Svg width={Size} height={Size} style={StyleSheet.absoluteFill}>
          <Circle
            cx={Size / 2}
            cy={Size / 2}
            r={CIRCLE_R}
            stroke={styles.circleStroke}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={Size / 2}
            cy={Size / 2}
            r={CIRCLE_R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${Size / 2}, ${Size / 2}`}
          />
        </Svg>

        {renderFace(aRotate, false, faceAText)}
        {renderFace(bRotate, true, faceBText)}
      </Animated.View>
    </TouchableOpacity>
  );
};
