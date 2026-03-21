import { StyleSheet, Text, View } from "react-native";

const DAY_LABELS: Record<number, string> = {
  0: "Su",
  1: "M",
  2: "T",
  3: "W",
  4: "Th",
  5: "F",
  6: "Sa",
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const TargetDaysRow = ({
  targetDays,
  activeColor,
  inactiveColor,
}: {
  targetDays: number[];
  activeColor: string;
  inactiveColor: string;
}) => {
  return (
    <View style={styles.row}>
      {DAY_ORDER.map((day) => {
        const active = targetDays.includes(day);
        return (
          <Text
            key={day}
            style={[
              styles.label,
              {
                color: active ? activeColor : inactiveColor,
                fontWeight: active ? "bold" : "400",
              },
            ]}
          >
            {DAY_LABELS[day]}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginTop: 6,
    gap: 6,
  },
  label: {
    fontSize: 12,
    textShadowColor: "black",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
