import { useContext, useMemo } from "react";
import {Dimensions } from "react-native";

import CountdownPickerModal from "@/components/ui/timer-logs/time-display/components/countdown-picker-modal/countdown-picker-modal";
import { ThemeContext } from "@/context/ThemeContext";
import { TimerMode } from "@/context/TimerContext";

import { createStyles } from "./time-display.styles";
import { useTimerDisplayBusiness } from "./use-time-display.business";
import { TimerDisplayCircle } from "./components/time-display-circle";

const { width } = Dimensions.get("window");
console.log("SCREEN WIDTH", width);
const SIZE = Math.min(width * 0.5, 250);

export interface TimerDisplayProps {
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
  const { theme , isDarkMode} = useContext(ThemeContext);
  console.log("isDarkMode", isDarkMode);
  const styles = useMemo(() => createStyles(theme, isDarkMode, SIZE), [theme]);

  const { pickerVisible, setPickerVisible, handleTap } =
    useTimerDisplayBusiness({
      time,
      mode,
      countdownTarget,
      isRunning,
      onToggleMode,
      onCountdownTargetChange,
    });

  return (
    <>
       <TimerDisplayCircle
        timeDisplayProps={{
          time,
          mode,
          countdownTarget,
          isRunning,
          onToggleMode,
          onCountdownTargetChange,
        }}
        styles={styles}
        Size={SIZE}
        onCirclePress = {handleTap}

      /> 
      <CountdownPickerModal
        visible={pickerVisible}
        countdownTarget={countdownTarget}
        onChange={onCountdownTargetChange}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

