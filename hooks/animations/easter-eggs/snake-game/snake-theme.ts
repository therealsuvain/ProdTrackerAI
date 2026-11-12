import { Platform } from "react-native";

// Palette sampled from the two references:
//  - LCD base/vignette: the greyish-green Nokia screen (image 1)
//  - ink: the near-black pixels of the snake sprites (image 2)
export const SNAKE_COLORS = {
  // phone body
  body: "#232a31",
  bodyEdge: "#10151a",
  bezelOuter: "#8a9096",
  bezelInner: "#1b2016",
  title: "#cdd6c0",
  // LCD
  lcdLight: "#b6c4a2",
  lcdMid: "#a3b38f",
  lcdDark: "#8a9b77",
  ink: "#1b2315",
  inkGhost: "rgba(27,35,21,0.17)",
  grid: "rgba(30,45,22,0.10)",
  // keys
  keyFace: "#c6cad0",
  keyEdge: "#8d939a",
  keyLabel: "#262b32",
  keySub: "#4b525a",
  keyHint: "#3b6ea5",
  navFace: "#a8b0b8",
  blue: "#2b8ae6",
  rocker: "#8b9096",
};

export const SNAKE_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;
