import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

type XButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  mode?: string;
  size?: string;
};

export default function XButton({ icon, onPress, mode, size }: XButtonProps) {
  const light = () => {
    if (mode === "timer") {
      return "#6ac9b1ff";
    } else if(mode === "habit"){
      return "#f1b71879"
    }else if(mode === "calendar"){
      return "#f4433677"
    }else {
      return "#7957b3ff";
    }
  };

  
  const dark = () => {
    if (mode === "timer") {
      return "#05ce9cff";
    } else if(mode === "habit"){
      return "#f1b718ff"
    }else if(mode === "calendar"){
      return "#F44336"
    }else {
      return "#673AB7";
    }
  };
  const pressedFunc = ({ pressed }: { pressed: boolean }) => [
    size === "big" ? styles.biggerButton : styles.button,
    {
      backgroundColor: pressed ? light() : dark(),
      transform: [{ scale: pressed ? 0.9 : 1 }],
    },
  ];

  return (
    <View style={size === "big" ? styles.biggerContainer : styles.container}>
      <Pressable style={pressedFunc} onPress={onPress}>
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
    marginHorizontal: 2.5,
  },
  button: {
    height: 40,
    width: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  biggerContainer: {
    height: 80,
    width: 80,
    borderRadius: 40,
    marginHorizontal: 2.5,
  },
  biggerButton: {
    height: 80,
    width: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  Ionicons: { fontSize: 32 },
});
