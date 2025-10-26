import { Text, StyleSheet, View } from "react-native";

interface TimerDisplayProps {
  time: number;
}

export default function TimerDisplay({ time }: TimerDisplayProps) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return (
    <View style={styles.container}>
      <Text style={styles.time}>
        {`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  time: {
    color: "white",
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
  },

  container: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: "#05ce9cff",
    justifyContent: "center",
    alignItems: "center",
  },
});
