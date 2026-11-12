import { Platform } from "react-native";

export const PM_COLORS = {
  bg: "#000000",
  white: "#f4f4f4",
  yellow: "#ffe600",
  wall: "#2121ff",
  wallStage2: "#00b8ff",
  gate: "#ffb8ff",
  pellet: "#ffb8ae",
  blinky: "#ff2a2a",
  pinky: "#ffb8ff",
  inky: "#00ffff",
  clyde: "#ffb852",
  frightened: "#2121ff",
  eyeBlue: "#2121ff",
  cherry: "#ff2a2a",
  green: "#3dff5a",
  dim: "#8a8a8a",
};

export const PM_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;
