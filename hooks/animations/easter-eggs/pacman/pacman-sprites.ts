// Pixel art for the Pac-Man easter egg.
// "X" = lit pixel, "." = empty. Rows are padded to the widest row.

export type Rect = { x: number; y: number; w: number; h: number };
export interface Bitmap {
  w: number;
  h: number;
  rows: string[];
}
export interface AtlasSprite {
  w: number;
  h: number;
  rects: Rect[];
}

export function makeBitmap(rows: string[]): Bitmap {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, ".")) };
}

function flipH(rows: string[]): string[] {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => r.padEnd(w, ".").split("").reverse().join(""));
}

function transpose(rows: string[]): string[] {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const padded = rows.map((r) => r.padEnd(w, "."));
  const out: string[] = [];
  for (let x = 0; x < w; x++) {
    let row = "";
    for (let y = 0; y < h; y++) row += padded[y][x];
    out.push(row);
  }
  return out;
}

function flipV(rows: string[]): string[] {
  return [...rows].reverse();
}

/**
 * Collapses a bitmap into the fewest rectangles (horizontal runs, merged
 * vertically when identical). Keeps the native view and Skia rect count tiny.
 */
export function bitmapToRects(bm: Bitmap): Rect[] {
  const done: Rect[] = [];
  let open = new Map<string, Rect>();

  for (let y = 0; y < bm.h; y++) {
    const row = bm.rows[y];
    const next = new Map<string, Rect>();
    let x = 0;
    while (x < bm.w) {
      if (row[x] === "X") {
        const start = x;
        while (x < bm.w && row[x] === "X") x++;
        const key = `${start}:${x - start}`;
        const prev = open.get(key);
        if (prev && prev.y + prev.h === y) {
          prev.h += 1;
          next.set(key, prev);
        } else {
          const rect: Rect = { x: start, y, w: x - start, h: 1 };
          done.push(rect);
          next.set(key, rect);
        }
      } else {
        x++;
      }
    }
    open = next;
  }
  return done;
}

// Base 12x12 Pac-Man facing right
const PAC_CLOSED_ROWS = [
  "....XXXX....",
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  ".XXXXXXXXXX.",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
  "....XXXX....",
];

const PAC_RIGHT_A_ROWS = [
  "....XXXX....",
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  ".XXXXXXXX...",
  "XXXXXX......",
  "XXXX........",
  "XXXX........",
  "XXXXXX......",
  ".XXXXXXXX...",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
  "....XXXX....",
];

const PAC_RIGHT_B_ROWS = [
  "....XXXX....",
  "..XXXXXXX...",
  ".XXXXXXX....",
  ".XXXXX......",
  "XXXX........",
  "XX..........",
  "XX..........",
  "XXXX........",
  ".XXXXX......",
  ".XXXXXXX....",
  "..XXXXXXX...",
  "....XXXX....",
];

export const BITMAPS = {
  // Pac-Man directional frames (12 x 12)
  pacClosed: makeBitmap(PAC_CLOSED_ROWS),
  pacRightA: makeBitmap(PAC_RIGHT_A_ROWS),
  pacRightB: makeBitmap(PAC_RIGHT_B_ROWS),
  pacLeftA: makeBitmap(flipH(PAC_RIGHT_A_ROWS)),
  pacLeftB: makeBitmap(flipH(PAC_RIGHT_B_ROWS)),
  pacUpA: makeBitmap(transpose(PAC_RIGHT_A_ROWS)),
  pacUpB: makeBitmap(transpose(PAC_RIGHT_B_ROWS)),
  pacDownA: makeBitmap(flipV(transpose(PAC_RIGHT_A_ROWS))),
  pacDownB: makeBitmap(flipV(transpose(PAC_RIGHT_B_ROWS))),

  // Pac-Man death frames (12 x 12)
  pacDie1: makeBitmap([
    "............",
    ".XX......XX.",
    ".XXX....XXX.",
    "XXXXX..XXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "....XXXX....",
    "............",
  ]),
  pacDie2: makeBitmap([
    "............",
    "............",
    "............",
    "X..........X",
    "XXX......XXX",
    "XXXXX..XXXXX",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    "............",
  ]),
  pacDie3: makeBitmap([
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "X..........X",
    ".XX......XX.",
    "..XXXXXXXX..",
    "...XXXXXX...",
    "....XXXX....",
    ".....XX.....",
  ]),
  pacDie4: makeBitmap([
    ".X........X.",
    "..X..XX..X..",
    "...X.XX.X...",
    "....XXXX....",
    ".XXX.XX.XXX.",
    "....XXXX....",
    "...X.XX.X...",
    "..X..XX..X..",
    ".X........X.",
    "............",
    "............",
    "............",
  ]),

  // Ghost body frames (12 x 12)
  ghostBodyA: makeBitmap([
    "....XXXX....",
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XX.XXXXXX.XX",
    "X...XX.XX..X",
  ]),
  ghostBodyB: makeBitmap([
    "....XXXX....",
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXXXXXXXXXXX",
    "XXX.XXXX.XXX",
    ".X..X..X..X.",
  ]),

  // Ghost eyes (white sclera, 12 x 12 overlay)
  eyesRight: makeBitmap([
    "............",
    "............",
    "...XX...XX..",
    "..XXXX.XXXX.",
    "..XXXX.XXXX.",
    "...XX...XX..",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  eyesLeft: makeBitmap([
    "............",
    "............",
    "..XX...XX...",
    ".XXXX.XXXX..",
    ".XXXX.XXXX..",
    "..XX...XX...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  eyesUp: makeBitmap([
    "............",
    "..XX...XX...",
    ".XXXX.XXXX..",
    ".XXXX.XXXX..",
    "..XX...XX...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  eyesDown: makeBitmap([
    "............",
    "............",
    "............",
    "..XX...XX...",
    ".XXXX.XXXX..",
    ".XXXX.XXXX..",
    "..XX...XX...",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),

  // Ghost pupils (blue pupils, 12 x 12 overlay)
  pupilsRight: makeBitmap([
    "............",
    "............",
    "............",
    "....XX...XX.",
    "....XX...XX.",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  pupilsLeft: makeBitmap([
    "............",
    "............",
    "............",
    ".XX...XX....",
    ".XX...XX....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  pupilsUp: makeBitmap([
    "............",
    "..XX...XX...",
    "..XX...XX...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),
  pupilsDown: makeBitmap([
    "............",
    "............",
    "............",
    "............",
    "............",
    "..XX...XX...",
    "..XX...XX...",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),

  // Frightened ghost face overlay (12 x 12)
  frightenedFace: makeBitmap([
    "............",
    "............",
    "............",
    "...XX..XX...",
    "...XX..XX...",
    "............",
    "............",
    "..XX.XX.XX..",
    ".X..X..X..X.",
    "............",
    "............",
    "............",
  ]),

  // Bonus fruit: cherry (12 x 12)
  cherryBody: makeBitmap([
    "............",
    "............",
    "............",
    "............",
    "............",
    "..XXX.......",
    ".XXXXX.XXX..",
    ".XXXXX.XXXXX",
    "..XXX..XXXXX",
    "........XXX.",
    "............",
    "............",
  ]),
  cherryStem: makeBitmap([
    "........XX..",
    ".......XX...",
    ".....XX.X...",
    "....X...X...",
    "...X....X...",
    "........X...",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
  ]),

  // Small life counter icon (8 x 8)
  lifeIcon: makeBitmap([
    "..XXXX..",
    ".XXXXXX.",
    "XXXXX...",
    "XXX.....",
    "XXX.....",
    "XXXXX...",
    ".XXXXXX.",
    "..XXXX..",
  ]),
};

export type SpriteKey = keyof typeof BITMAPS;

let atlasCache: Record<SpriteKey, AtlasSprite> | null = null;

/** Pre-merged rectangle lists for every sprite (built once, cached). */
export function getAtlas(): Record<SpriteKey, AtlasSprite> {
  if (!atlasCache) {
    const built = {} as Record<SpriteKey, AtlasSprite>;
    (Object.keys(BITMAPS) as SpriteKey[]).forEach((key) => {
      const bm = BITMAPS[key];
      built[key] = { w: bm.w, h: bm.h, rects: bitmapToRects(bm) };
    });
    atlasCache = built;
  }
  return atlasCache;
}
