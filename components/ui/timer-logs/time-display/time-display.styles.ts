import { StyleSheet } from "react-native";
import { withAlpha } from "@/utils/common-utils";

export const createStyles = (theme: any, isdarkmode: boolean,size: number) => {
  const radius = size / 2;

  const styles = StyleSheet.create({
    base: isdarkmode ? theme.timerBase: theme.timerBaseLightModeOnly,
    error : theme.error,
    circleStroke : withAlpha(theme.timerBase, "22") as any,
    outer: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    },
    face: {
      width: size,
      height: size,
      borderRadius: radius,
      borderWidth: 2,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
      backgroundColor: "transparent",
      borderColor: withAlpha(isdarkmode ? theme.timerBase: theme.timerBaseLightModeOnly, "44"),
    },
    absoluteFace: {
      position: "absolute",
    },
    time: {
      fontSize: size * 0.16, // 🔥 scalable font
      fontWeight: "bold",
      textAlign: "center",
      letterSpacing: 2,
      color: isdarkmode ? theme.timerBase: theme.timerBaseLightModeOnly,
    },
  });

  return styles
};