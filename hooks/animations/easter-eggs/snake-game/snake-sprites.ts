// Pixel art for the Snake easter egg. "X" = lit LCD pixel.
// Sprite shapes follow the reference screen: a dotted body of separate
// squares, a diamond for the food and a little bug for the timed bonus.
// A cell is 4x4 LCD pixels: a 3x3 block plus a 1px gap, so neighbouring
// segments read as the classic dotted line.

export const SNAKE_BODY = ["XXX.", "XXX.", "XXX.", "...."];

// Closed head has a "hollow" centre (the eye) so the head is easy to spot.
export const SNAKE_HEAD_CLOSED = ["XXX.", "X.X.", "XXX.", "...."];

// Open mouth (shown when food is 1-2 cells ahead), indexed by direction.
export const SNAKE_HEAD_OPEN: Record<0 | 1 | 2 | 3, string[]> = {
  0: ["X.X.", "XXX.", "XXX.", "...."], // up
  1: ["XXX.", "XX..", "XXX.", "...."], // right
  2: ["XXX.", "XXX.", "X.X.", "...."], // down
  3: ["XXX.", ".XX.", "XXX.", "...."], // left
};

export const SNAKE_FOOD = [".X..", "XXX.", ".X..", "...."];

// Timed bonus (2x2 cells = 8x8 LCD pixels).
export const SNAKE_BONUS = [
  "........",
  "X..XX..X",
  ".X.XX.X.",
  "..XXXX..",
  ".XXXXXX.",
  "X.XXXX.X",
  "..X..X..",
  "........",
];

// 3x5 pixel font for the HUD and messages.
export const FONT: Record<string, string[]> = {
  "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
  "1": [".X.", "XX.", ".X.", ".X.", "XXX"],
  "2": ["XX.", "..X", ".X.", "X..", "XXX"],
  "3": ["XX.", "..X", ".X.", "..X", "XX."],
  "4": ["X.X", "X.X", "XXX", "..X", "..X"],
  "5": ["XXX", "X..", "XX.", "..X", "XX."],
  "6": [".XX", "X..", "XXX", "X.X", "XXX"],
  "7": ["XXX", "..X", ".X.", ".X.", ".X."],
  "8": ["XXX", "X.X", "XXX", "X.X", "XXX"],
  "9": ["XXX", "X.X", "XXX", "..X", "XX."],
  A: [".X.", "X.X", "XXX", "X.X", "X.X"],
  B: ["XX.", "X.X", "XX.", "X.X", "XX."],
  C: [".XX", "X..", "X..", "X..", ".XX"],
  D: ["XX.", "X.X", "X.X", "X.X", "XX."],
  E: ["XXX", "X..", "XX.", "X..", "XXX"],
  F: ["XXX", "X..", "XX.", "X..", "X.."],
  G: [".XX", "X..", "X.X", "X.X", ".XX"],
  H: ["X.X", "X.X", "XXX", "X.X", "X.X"],
  I: ["XXX", ".X.", ".X.", ".X.", "XXX"],
  J: ["..X", "..X", "..X", "X.X", ".X."],
  K: ["X.X", "X.X", "XX.", "X.X", "X.X"],
  L: ["X..", "X..", "X..", "X..", "XXX"],
  M: ["X.X", "XXX", "XXX", "X.X", "X.X"],
  N: ["XX.", "X.X", "X.X", "X.X", "X.X"],
  O: [".X.", "X.X", "X.X", "X.X", ".X."],
  P: ["XX.", "X.X", "XX.", "X..", "X.."],
  Q: [".X.", "X.X", "X.X", "XX.", ".XX"],
  R: ["XX.", "X.X", "XX.", "X.X", "X.X"],
  S: [".XX", "X..", ".X.", "..X", "XX."],
  T: ["XXX", ".X.", ".X.", ".X.", ".X."],
  U: ["X.X", "X.X", "X.X", "X.X", "XXX"],
  V: ["X.X", "X.X", "X.X", "X.X", ".X."],
  W: ["X.X", "X.X", "XXX", "XXX", "X.X"],
  X: ["X.X", "X.X", ".X.", "X.X", "X.X"],
  Y: ["X.X", "X.X", ".X.", ".X.", ".X."],
  Z: ["XXX", "..X", ".X.", "X..", "XXX"],
  "-": ["...", "...", "XXX", "...", "..."],
  ".": ["...", "...", "...", "...", ".X."],
  "!": [".X.", ".X.", ".X.", "...", ".X."],
  "%": ["X.X", "..X", ".X.", "X..", "X.X"],
  " ": ["...", "...", "...", "...", "..."],
};
