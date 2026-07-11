import { Text as SkiaText, SkFont } from "@shopify/react-native-skia";
import { SharedValue, useDerivedValue } from "react-native-reanimated";

export function SingleSeriesTooltipContent({
  cardX,
  cardY,
  value,
  dateLabel,
  theme,
  valueFont,
  labelFont,
}: {
  cardX: SharedValue<number>;
  cardY: SharedValue<number>;
  value: SharedValue<number>;
  dateLabel: SharedValue<string>;
  theme: any;
  valueFont: SkFont;
  labelFont: SkFont;
}) {
  const valueText = useDerivedValue(() => value.value.toFixed(1));
  const textX = useDerivedValue(() => cardX.value + 12);
  const dateText = useDerivedValue(() => {
    const d = new Date(dateLabel.value);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  return (
    <>
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 18)}
        text={valueText}
        font={valueFont}
        color={theme.text}
      />
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 34)}
        text={dateText}
        font={labelFont}
        color={theme.text + "99"}
      />
    </>
  );
}
