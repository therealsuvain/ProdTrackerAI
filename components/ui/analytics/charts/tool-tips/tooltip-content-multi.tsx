import { SharedValue, useDerivedValue } from "react-native-reanimated";
import { Text as SkiaText } from "@shopify/react-native-skia";

interface SeriesEntry {
  value: SharedValue<number>;
  label: string;
  color: string;
}

interface Props {
  cardX: SharedValue<number>;
  cardY: SharedValue<number>;
  dateLabel: SharedValue<string>;
  series: SeriesEntry[];
  valueFont: any;
  labelFont: any;
  theme: any;
}

export function MultiSeriesTooltipContent({
  cardX,
  cardY,
  dateLabel,
  series,
  valueFont,
  labelFont,
  theme,
}: Props) {
  const textX = useDerivedValue(() => cardX.value + 12);
  const dateText = useDerivedValue(() => {
    const d = new Date(dateLabel.value);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  return (
    <>
      <SkiaText
        x={textX}
        y={useDerivedValue(() => cardY.value + 16)}
        text={dateText}
        font={labelFont}
        color={theme.text + "99"}
      />
      {series.map((s, i) => (
        <SeriesRow
          key={s.label}
          textX={textX}
          cardY={cardY}
          rowIndex={i}
          entry={s}
          valueFont={valueFont}
          labelFont={labelFont}
          theme={theme}
        />
      ))}
    </>
  );
}

function SeriesRow({
  textX,
  cardY,
  rowIndex,
  entry,
  valueFont,
  labelFont,
  theme,
}: {
  textX: SharedValue<number>;
  cardY: SharedValue<number>;
  rowIndex: number;
  entry: SeriesEntry;
  valueFont: any;
  labelFont: any;
  theme: any;
}) {
  const rowText = useDerivedValue(
    () => `${entry.label}: ${entry.value.value.toFixed(0)}`,
  );
  const rowY = useDerivedValue(() => cardY.value + 32 + rowIndex * 16);
  return (
    <SkiaText
      x={textX}
      y={rowY}
      text={rowText}
      font={labelFont}
      color={entry.color}
    />
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
