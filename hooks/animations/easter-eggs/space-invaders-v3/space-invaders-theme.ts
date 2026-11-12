import { Platform } from "react-native";

export const SI_COLORS = {
  bg: "#000000",
  white: "#f4f4f4",
  green: "#3dff5a",
  red: "#ff3a3a",
  orange: "#ff8a1f",
  dim: "#8a8a8a",
};

export const SI_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;
