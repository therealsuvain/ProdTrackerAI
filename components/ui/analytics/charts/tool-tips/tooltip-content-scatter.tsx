import { SharedValue, useDerivedValue } from "react-native-reanimated";
import { Text as SkiaText } from "@shopify/react-native-skia";

interface Props {
  cardX: SharedValue<number>;
  cardY: SharedValue<number>;
  hour: SharedValue<number>;
  frictionScore: SharedValue<number>;
  valueFont: any;
  labelFont: any;
  theme: any;
}

export function ScatterTooltipContent({
  cardX,
  cardY,
  hour,
  frictionScore,
  valueFont,
  labelFont,
  theme,
}: Props) {
  const textX = useDerivedValue(() => cardX.value + 12);
  const hourText = useDerivedValue(() => `${hour.value}:00`);
  const scoreText = useDerivedValue(
    () => `Friction: ${frictionScore.value.toFixed(1)}`,
  );

  return (
    <>
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 18)}
        text={hourText}
        font={valueFont}
        color={theme.text}
      />
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 34)}
        text={scoreText}
        font={labelFont}
        color={theme.text + "99"}
      />
    </>
  );
}
