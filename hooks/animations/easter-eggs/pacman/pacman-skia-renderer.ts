// Skia renderer for the Pac-Man easter egg.
//
// The whole playfield is drawn into ONE SkPicture per frame (immediate mode),
// and handed to a <Picture> via a Reanimated shared value. React never
// re-renders during play and there is exactly one native view for the world.
//
// Expensive layers are cached as SkPictures and only rebuilt when they change:
//   * every sprite (per colour)
//   * the maze walls for each stage
//   * the static dots layer (rebuilt only when a dot is eaten)

import {
  Skia,
  matchFont,
  type SkFont,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import {
  CELL_DOT,
  CELL_GATE,
  CELL_POWER,
  CELL_WALL,
  COLS,
  GROUND_Y,
  MAZE_Y,
  ROWS,
  TILE,
  WORLD_H,
  WORLD_W,
  getCell,
  type Dir,
  type Game,
  type Ghost,
} from "./pacman-engine";
import { BITMAPS, getAtlas, type SpriteKey } from "./pacman-sprites";
import { PM_COLORS, PM_FONT } from "./pacman-theme";

type Canvas = ReturnType<ReturnType<typeof Skia.PictureRecorder>["beginRecording"]>;
type ColorName =
  | "white"
  | "yellow"
  | "wall"
  | "wallStage2"
  | "gate"
  | "pellet"
  | "blinky"
  | "pinky"
  | "inky"
  | "clyde"
  | "frightened"
  | "eyeBlue"
  | "cherry"
  | "green"
  | "dim"
  | "black"
  | "veil";

const COLOR_HEX: Record<ColorName, string> = {
  white: PM_COLORS.white,
  yellow: PM_COLORS.yellow,
  wall: PM_COLORS.wall,
  wallStage2: PM_COLORS.wallStage2,
  gate: PM_COLORS.gate,
  pellet: PM_COLORS.pellet,
  blinky: PM_COLORS.blinky,
  pinky: PM_COLORS.pinky,
  inky: PM_COLORS.inky,
  clyde: PM_COLORS.clyde,
  frightened: PM_COLORS.frightened,
  eyeBlue: PM_COLORS.eyeBlue,
  cherry: PM_COLORS.cherry,
  green: PM_COLORS.green,
  dim: PM_COLORS.dim,
  black: "#000000",
  veil: "rgba(0,0,0,0.88)",
};

const SPRITE_COLORS: ColorName[] = [
  "white",
  "yellow",
  "blinky",
  "pinky",
  "inky",
  "clyde",
  "frightened",
  "eyeBlue",
  "cherry",
  "green",
  "pellet",
];
const FONT_SIZES = [7, 8, 10, 14, 16];

// ---- Shared resources (built once, reused by every renderer) ---------------
let paints: Record<ColorName, SkPaint> | null = null;
const spriteCache = new Map<string, SkPicture>();
const fontCache = new Map<number, SkFont>();
const widthCache = new Map<string, number>();

function getPaints(): Record<ColorName, SkPaint> {
  if (!paints) {
    const built = {} as Record<ColorName, SkPaint>;
    (Object.keys(COLOR_HEX) as ColorName[]).forEach((name) => {
      const p = Skia.Paint();
      p.setColor(Skia.Color(COLOR_HEX[name]));
      p.setAntiAlias(false); // crisp arcade pixels
      built[name] = p;
    });
    paints = built;
  }
  return paints;
}

function getFont(size: number): SkFont {
  let font = fontCache.get(size);
  if (!font) {
    font = matchFont({ fontFamily: PM_FONT, fontSize: size, fontWeight: "bold" });
    fontCache.set(size, font);
  }
  return font;
}

function measure(font: SkFont, size: number, s: string): number {
  const key = `${size}:${s}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    const f = font as unknown as { getTextWidth?: (t: string) => number };
    w = f.getTextWidth ? f.getTextWidth(s) : font.measureText(s).width;
    if (widthCache.size > 400) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}

function getSprite(key: SpriteKey, color: ColorName): SkPicture {
  const id = `${key}:${color}`;
  let pic = spriteCache.get(id);
  if (!pic) {
    const sprite = getAtlas()[key];
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, sprite.w, sprite.h));
    const paint = getPaints()[color];
    for (const r of sprite.rects) {
      c.drawRect(Skia.XYWHRect(r.x, r.y, r.w, r.h), paint);
    }
    pic = rec.finishRecordingAsPicture();
    spriteCache.set(id, pic);
  }
  return pic;
}

/** Pre-builds every paint, font and sprite picture. Call from the loading screen. */
export function prepareSkiaAssets() {
  getPaints();
  for (const size of FONT_SIZES) getFont(size);
  for (const key of Object.keys(BITMAPS) as SpriteKey[]) {
    for (const color of SPRITE_COLORS) getSprite(key, color);
  }
}

// ---- Drawing helpers -------------------------------------------------------
function sprite(c: Canvas, key: SpriteKey, color: ColorName, x: number, y: number) {
  c.save();
  c.translate(Math.round(x), Math.round(y));
  c.drawPicture(getSprite(key, color));
  c.restore();
}

function rect(c: Canvas, x: number, y: number, w: number, h: number, color: ColorName) {
  c.drawRect(Skia.XYWHRect(x, y, w, h), getPaints()[color]);
}

function text(
  c: Canvas,
  s: string,
  x: number,
  y: number,
  w: number,
  size: number,
  color: ColorName,
  align: "left" | "center" | "right" = "left",
) {
  const font = getFont(size);
  let dx = x;
  if (align !== "left") {
    const tw = measure(font, size, s);
    dx = align === "center" ? x + (w - tw) / 2 : x + w - tw;
  }
  c.drawText(s, dx, y + size * 0.9, getPaints()[color], font);
}

function border(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  color: ColorName,
) {
  rect(c, x, y, w, t, color);
  rect(c, x, y + h - t, w, t, color);
  rect(c, x, y, t, h, color);
  rect(c, x + w - t, y, t, h, color);
}

const pad = (n: number) => String(n).padStart(5, "0");

function getPacSprite(g: Game): SpriteKey {
  if (g.phase === "playerDying") {
    const p = g.phaseTime / 1.4;
    if (p < 0.25) return "pacDie1";
    if (p < 0.5) return "pacDie2";
    if (p < 0.75) return "pacDie3";
    return "pacDie4";
  }
  if (g.mouthAngle < 0.22) return "pacClosed";
  const wide = g.mouthAngle > 0.62;
  switch (g.pacDir) {
    case "left":
      return wide ? "pacLeftB" : "pacLeftA";
    case "up":
      return wide ? "pacUpB" : "pacUpA";
    case "down":
      return wide ? "pacDownB" : "pacDownA";
    case "right":
    default:
      return wide ? "pacRightB" : "pacRightA";
  }
}

function getEyeSprites(dir: Dir): { eyes: SpriteKey; pupils: SpriteKey } {
  switch (dir) {
    case "left":
      return { eyes: "eyesLeft", pupils: "pupilsLeft" };
    case "up":
      return { eyes: "eyesUp", pupils: "pupilsUp" };
    case "down":
      return { eyes: "eyesDown", pupils: "pupilsDown" };
    case "right":
    default:
      return { eyes: "eyesRight", pupils: "pupilsRight" };
  }
}

function drawGhost(c: Canvas, g: Game, gh: Ghost) {
  const gx = gh.x - 6;
  const gy = MAZE_Y + gh.y - 6;
  const skirt: SpriteKey = Math.floor(g.time * 8) % 2 === 0 ? "ghostBodyA" : "ghostBodyB";

  if (gh.mode === "eaten") {
    const { eyes, pupils } = getEyeSprites(gh.dir);
    sprite(c, eyes, "white", gx, gy);
    sprite(c, pupils, "eyeBlue", gx, gy);
    return;
  }

  if (gh.mode === "frightened") {
    const flashing = gh.frightenedTimer < 2.0 && Math.floor(gh.frightenedTimer * 7) % 2 === 0;
    const bodyCol: ColorName = flashing ? "white" : "frightened";
    const faceCol: ColorName = flashing ? "blinky" : "pellet";
    sprite(c, skirt, bodyCol, gx, gy);
    sprite(c, "frightenedFace", faceCol, gx, gy);
    return;
  }

  sprite(c, skirt, gh.id, gx, gy);
  const { eyes, pupils } = getEyeSprites(gh.dir);
  sprite(c, eyes, "white", gx, gy);
  sprite(c, pupils, "eyeBlue", gx, gy);
}

// ---- Renderer --------------------------------------------------------------
export interface SkiaRenderer {
  render(g: Game, scale: number, blink: boolean, canRestart: boolean): SkPicture;
}

export function createSkiaRenderer(): SkiaRenderer {
  const recorder = Skia.PictureRecorder();
  const cacheRecorder = Skia.PictureRecorder();

  let mazeWallKey = "";
  let mazeWallPic: SkPicture | null = null;
  let dotsKey = -1;
  let dotsPic: SkPicture | null = null;

  const buildMazeWalls = (g: Game, wallColor: ColorName) => {
    const c = cacheRecorder.beginRecording(Skia.XYWHRect(0, 0, WORLD_W, WORLD_H));
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const cell = getCell(g, col, r);
        const x = col * TILE;
        const y = MAZE_Y + r * TILE;
        if (cell === CELL_WALL) {
          // Crisp hollow arcade wall block with inner dark core and connected edges
          rect(c, x, y, TILE, TILE, wallColor);
          const up = getCell(g, col, r - 1) === CELL_WALL;
          const down = getCell(g, col, r + 1) === CELL_WALL;
          const left = getCell(g, col - 1, r) === CELL_WALL;
          const right = getCell(g, col + 1, r) === CELL_WALL;
          const ix = left ? x : x + 1.5;
          const iy = up ? y : y + 1.5;
          const iw = TILE - (left ? 0 : 1.5) - (right ? 0 : 1.5);
          const ih = TILE - (up ? 0 : 1.5) - (down ? 0 : 1.5);
          if (iw > 0 && ih > 0) {
            rect(c, ix, iy, iw, ih, "black");
          }
        } else if (cell === CELL_GATE) {
          rect(c, x, y + 3, TILE, 2, "gate");
        }
      }
    }
    return cacheRecorder.finishRecordingAsPicture();
  };

  const buildDots = (g: Game) => {
    const c = cacheRecorder.beginRecording(Skia.XYWHRect(0, 0, WORLD_W, WORLD_H));
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        if (getCell(g, col, r) === CELL_DOT) {
          rect(c, col * TILE + 3, MAZE_Y + r * TILE + 3, 2, 2, "pellet");
        }
      }
    }
    return cacheRecorder.finishRecordingAsPicture();
  };

  return {
    render(g, scale, blink, canRestart) {
      const c = recorder.beginRecording(
        Skia.XYWHRect(0, 0, WORLD_W * scale, WORLD_H * scale),
      );
      c.scale(scale, scale);
      rect(c, 0, 0, WORLD_W, WORLD_H, "black");

      // Top HUD
      text(c, "1UP", 8, 3, 64, 8, "white");
      text(c, pad(g.score), 8, 13, 64, 8, "yellow");
      text(c, "HI-SCORE", 80, 3, 64, 8, "white", "center");
      text(c, pad(g.hi), 80, 13, 64, 8, "blinky", "center");
      text(c, `STAGE ${g.level}`, 152, 3, 64, 8, "white", "right");
      text(
        c,
        g.level === 1 ? "CLASSIC" : "TURBO",
        152,
        13,
        64,
        8,
        g.level === 1 ? "inky" : "pinky",
        "right",
      );

      // Cached Maze Walls (flashes white during stage clear)
      const wallCol: ColorName =
        g.phase === "stageClear" && Math.floor(g.phaseTime * 6) % 2 === 1
          ? "white"
          : g.level === 1
            ? "wall"
            : "wallStage2";
      const wKey = `${g.level}:${wallCol}`;
      if (wKey !== mazeWallKey || !mazeWallPic) {
        mazeWallKey = wKey;
        mazeWallPic = buildMazeWalls(g, wallCol);
      }
      c.drawPicture(mazeWallPic);

      // Cached Regular Dots
      const dKey = g.runId * 100000 + g.pelletVersion;
      if (dKey !== dotsKey || !dotsPic) {
        dotsKey = dKey;
        dotsPic = buildDots(g);
      }
      c.drawPicture(dotsPic);

      // Pulsing Power Pellets
      if (blink || g.phase === "ready") {
        for (let r = 0; r < ROWS; r++) {
          for (let col = 0; col < COLS; col++) {
            if (getCell(g, col, r) === CELL_POWER) {
              const px = col * TILE + 1;
              const py = MAZE_Y + r * TILE + 1;
              rect(c, px + 1, py, 4, 6, "pellet");
              rect(c, px, py + 1, 6, 4, "pellet");
            }
          }
        }
      }

      // Bonus Fruit
      if (g.fruit.active) {
        const fx = 14 * TILE - 6;
        const fy = MAZE_Y + 15 * TILE + TILE / 2 - 6;
        sprite(c, "cherryStem", "green", fx, fy);
        sprite(c, "cherryBody", "cherry", fx, fy);
      }

      // Pac-Man (hidden during brief ghost-eat score freeze)
      if (g.phase !== "eatFreeze" && (g.phase !== "gameOver" || g.endReason !== "caught")) {
        sprite(c, getPacSprite(g), "yellow", g.pacX - 6, MAZE_Y + g.pacY - 6);
      }

      // Ghosts (hidden during death animation)
      if (g.phase !== "playerDying" && g.phase !== "stageClear") {
        for (const gh of g.ghosts) {
          drawGhost(c, g, gh);
        }
      }

      // Floating Score Popups (200 / 400 / 800 / 1600 / 500)
      for (const p of g.popups) {
        const col: ColorName =
          p.color === "cyan" ? "inky" : p.color === "green" ? "green" : "white";
        text(c, p.text, p.x - 16, MAZE_Y + p.y - 4, 32, 7, col, "center");
      }

      // Bottom Status Bar + Lives + Fruit Badge
      rect(c, 0, GROUND_Y, WORLD_W, 1, "wall");
      text(c, String(g.lives), 8, GROUND_Y + 6, 12, 8, "white");
      for (let i = 0; i < Math.max(0, g.lives - 1); i++) {
        sprite(c, "lifeIcon", "yellow", 22 + i * 12, GROUND_Y + 6);
      }
      // Stage cherries in bottom right
      for (let i = 0; i < g.level; i++) {
        const cx = WORLD_W - 22 - i * 14;
        const cy = GROUND_Y + 4;
        sprite(c, "cherryStem", "green", cx, cy);
        sprite(c, "cherryBody", "cherry", cx, cy);
      }

      // Banners
      if (g.phase === "ready") {
        text(c, "READY!", 0, MAZE_Y + 15 * TILE, WORLD_W, 9, "yellow", "center");
      } else if (g.phase === "stageClear") {
        rect(c, 36, 106, 152, 34, "veil");
        border(c, 36, 106, 152, 34, 1.5, "yellow");
        text(c, "STAGE CLEARED!", 36, 117, 152, 11, "yellow", "center");
      }

      // End card
      if (g.phase === "gameOver" || g.phase === "victory") {
        const win = g.phase === "victory";
        rect(c, 16, 74, 192, 108, "veil");
        border(c, 16, 74, 192, 108, 1.5, win ? "yellow" : "blinky");
        text(
          c,
          win ? "YOU WIN!" : "GAME OVER",
          17,
          82,
          190,
          16,
          win ? "yellow" : "blinky",
          "center",
        );
        text(
          c,
          win ? "MAZE MASTERED!" : "CAUGHT BY THE GHOSTS",
          17,
          104,
          190,
          8,
          "dim",
          "center",
        );
        text(c, `SCORE ${pad(g.score)}`, 17, 120, 190, 10, "white", "center");
        text(c, `HI-SCORE ${pad(g.hi)}`, 17, 134, 190, 10, "blinky", "center");
        if (g.newRecord) {
          text(c, "NEW HIGH SCORE!", 17, 150, 190, 8, blink ? "yellow" : "white", "center");
        }
        if (canRestart) {
          text(c, "TAP TO PLAY AGAIN", 17, 166, 190, 8, blink ? "white" : "dim", "center");
        }
      }

      return recorder.finishRecordingAsPicture();
    },
  };
}
