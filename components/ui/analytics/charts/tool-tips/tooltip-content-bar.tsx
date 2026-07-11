import { SharedValue, useDerivedValue } from "react-native-reanimated";
import { Text as SkiaText } from "@shopify/react-native-skia";

interface Props {
  cardX: SharedValue<number>;
  cardY: SharedValue<number>;
  dateLabel: SharedValue<string>;
  completed: SharedValue<number>;
  missed: SharedValue<number>;
  abandoned: SharedValue<number>;
  valueFont: any;
  labelFont: any;
  theme: any;
}

export function BarTooltipContent({
  cardX,
  cardY,
  dateLabel,
  completed,
  missed,
  abandoned,
  valueFont,
  labelFont,
  theme,
}: Props) {
  const textX = useDerivedValue(() => cardX.value + 12);
  const dateText = useDerivedValue(() =>
    new Date(dateLabel.value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );
  const completedText = useDerivedValue(
    () => `Completed: ${completed.value.toFixed(0)}`,
  );
  const missedText = useDerivedValue(
    () => `Missed: ${missed.value.toFixed(0)}`,
  );
  const abandonedText = useDerivedValue(
    () => `Abandoned: ${abandoned.value.toFixed(0)}`,
  );

  return (
    <>
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 16)}
        text={dateText}
        font={labelFont}
        color={theme.text + "99"}
      />
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 32)}
        text={completedText}
        font={labelFont}
        color={theme.success ?? "#22C55E"}
      />
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 48)}
        text={missedText}
        font={labelFont}
        color={theme.error ?? "#EF4444"}
      />
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 64)}
        text={abandonedText}
        font={labelFont}
        color={theme.text + "88"}
      />
    </>
  );
}
