import { ThemeContext } from "@/context/ThemeContext";
import React, { useState, useEffect, useRef, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";

interface DaySelectorProps {
  visible: boolean; // Controls visibility based on frequency
  selectedDays?: number[];
  onDaysChange?: (
    field:
      | "title"
      | "frequency"
      | "reminder"
      | "reminderDate"
      | "targetDays"
      | "goal"
      | "errors",
    value: any
  ) => void;
}

export default function DaySelector({
  visible,
  selectedDays = [],
  onDaysChange,
}: DaySelectorProps) {
  const { theme } = useContext(ThemeContext);
  const [selected, setSelected] = useState<number[]>(selectedDays);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(-10)).current;

  const days = [
    { label: "S", value: 0 },
    { label: "M", value: 1 },
    { label: "T", value: 2 },
    { label: "W", value: 3 },
    { label: "T", value: 4 },
    { label: "F", value: 5 },
    { label: "S", value: 6 },
  ];

  useEffect(() => {
    if (visible) {
      // Slide in and expand
      slideAnim.setValue(0);
      heightAnim.setValue(-10);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heightAnim, {
          toValue: 0, // Height of the day selector
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const toggleDay = (dayValue: number) => {
    const newSelected = selected.includes(dayValue)
      ? selected.filter((d) => d !== dayValue)
      : [...selected, dayValue];

    setSelected(newSelected);
    onDaysChange?.("targetDays", newSelected);
  };

  if (!visible) {
    return null;
  }
  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY: heightAnim }],
          opacity: slideAnim,
        },
      ]}
    >
      <View style={styles.container}>
        {days.map((day) => {
          const isSelected = selected.includes(day.value);
          return (
            <TouchableOpacity
              key={day.value}
              style={[
                styles.dayCircle,
                { borderColor: theme.habitDarkSecondary },
                isSelected && {
                  backgroundColor: theme.habitDarkSecondary,
                  borderColor: theme.habitBase,
                },
              ]}
              onPress={() => toggleDay(day.value)}
            >
              <Text
                style={[
                  styles.dayText,
                  { color: theme.whiteBase },
                  isSelected && { color: theme.habitBase },
                ]}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    marginVertical: 8,
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },

  dayText: {
    fontSize: 18,
    fontWeight: "400",
  },
});
