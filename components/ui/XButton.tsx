import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

type XButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

export default function XButton({ icon, onPress }: XButtonProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: pressed ? "#7957b3ff" : "#673AB7",
            transform: [{ scale: pressed ? 0.9 : 1 }],
          },
        ]}
        onPress={onPress}
      >
        <Ionicons size={24} name={icon}></Ionicons>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#673AB7",
    marginHorizontal: 2.5,
  },
  button: {
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  Ionicons: { fontSize: 32 },
});
