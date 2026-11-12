// Pure layout maths shared by the loading step (which has to size the maze
// before the game view mounts) and the game view itself.
//
// Everything the renderer draws lives in "LCD pixels" (world units). One snake
// cell = CELL x CELL LCD pixels. `p` converts LCD pixels to device-independent
// pixels and is snapped to whole device pixels so the grid stays crisp.

import { PixelRatio } from "react-native";

export const CELL = 4;
export const PAD = 3; // LCD px of margin left/right/bottom of the maze
export const HUD_H = 16; // LCD px reserved for the score strip
export const FIELD_TOP = 19; // LCD px from the top of the screen to the maze

export const HEADER_H = 46;
export const SIDE = 12; // phone-body margin left/right of the screen bezel
export const BEZEL = 9; // outer bezel + inner shadow ring
export const PANEL_GAP = 10; // gap between the screen and the keypad
const TARGET_COLS = 20;

export interface SnakeLayout {
  p: number;
  worldW: number;
  worldH: number;
  cols: number;
  rows: number;
  fieldX: number;
  fieldY: number;
  panelW: number;
  panelH: number;
  lcdW: number;
  lcdH: number;
  canvasW: number;
  canvasH: number;
  controlsH: number;
}

export function getControlsHeight(height: number): number {
  return Math.round(Math.min(Math.max(height * 0.3, 206), 252));
}

export function computeSnakeLayout(width: number, height: number): SnakeLayout {
  const ratio = PixelRatio.get();
  const controlsH = getControlsHeight(height);
  const panelW = Math.max(width - SIDE * 2, 200);
  const panelH = Math.max(height - HEADER_H - controlsH - PANEL_GAP, 200);
  const lcdW = panelW - BEZEL * 2;
  const lcdH = panelH - BEZEL * 2;

  const raw = lcdW / (TARGET_COLS * CELL + PAD * 2);
  const p = Math.min(Math.max(Math.floor(raw * ratio) / ratio, 2), 6);

  const worldW = Math.floor(lcdW / p);
  const worldH = Math.floor(lcdH / p);
  const cols = Math.max(10, Math.floor((worldW - PAD * 2) / CELL));
  const rows = Math.max(10, Math.floor((worldH - FIELD_TOP - PAD) / CELL));
  const fieldX = Math.floor((worldW - cols * CELL) / 2);
  const fieldY = FIELD_TOP;

  return {
    p,
    worldW,
    worldH,
    cols,
    rows,
    fieldX,
    fieldY,
    panelW,
    panelH,
    lcdW,
    lcdH,
    canvasW: worldW * p,
    canvasH: worldH * p,
    controlsH,
  };
}
