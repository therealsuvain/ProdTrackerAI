import { ThemeContext } from "@/context/ThemeContext";
import { useContext } from "react";
import { Text, StyleSheet, View } from "react-native";

interface TimerDisplayProps {
  time: number;
}

export default function TimerDisplay({ time }: TimerDisplayProps) {
  const { theme } = useContext(ThemeContext)
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return (
    <View style={[styles.container,{borderColor:theme.timerBase}]}>
      <Text style={[styles.time,{color:theme.timerBase}]}>
        {`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  time: {
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
  },

  container: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
