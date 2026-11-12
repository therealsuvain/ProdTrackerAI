// Pixel art for the Space Invaders easter egg.
// Invader / player / UFO / shield bitmaps follow the 1978 originals.
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

function mirror(half: string[]): string[] {
  const w = half.reduce((m, r) => Math.max(m, r.length), 0);
  return half.map((r) => {
    const p = r.padEnd(w, ".");
    return p + p.split("").reverse().join("");
  });
}

/**
 * Collapses a bitmap into the fewest rectangles (horizontal runs, merged
 * vertically when identical). Keeps the native view count tiny.
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

// ---- Shield (22 x 16) ------------------------------------------------------
const solid = (inset: number) =>
  ".".repeat(inset) + "X".repeat(22 - inset * 2) + ".".repeat(inset);
const shieldRows: string[] = [];
for (let i = 0; i < 4; i++) shieldRows.push(solid(4 - i));
for (let i = 0; i < 8; i++) shieldRows.push(solid(0));
for (let i = 0; i < 3; i++)
  shieldRows.push("X".repeat(8) + ".".repeat(6) + "X".repeat(8));
shieldRows.push("X".repeat(6) + ".".repeat(10) + "X".repeat(6));

export const BITMAPS = {
  // Squid (30 pts)
  squidA: makeBitmap([
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XX.XX.XX",
    "XXXXXXXX",
    "..X..X..",
    ".X.XX.X.",
    "X.X..X.X",
  ]),
  squidB: makeBitmap([
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
    "XX.XX.XX",
    "XXXXXXXX",
    ".X.XX.X.",
    "X......X",
    ".X....X.",
  ]),
  // Crab (20 pts)
  crabA: makeBitmap([
    "..X.....X..",
    "...X...X...",
    "..XXXXXXX..",
    ".XX.XXX.XX.",
    "XXXXXXXXXXX",
    "X.XXXXXXX.X",
    "X.X.....X.X",
    "...XX.XX...",
  ]),
  crabB: makeBitmap([
    "..X.....X..",
    "X..X...X..X",
    "X.XXXXXXX.X",
    "XXX.XXX.XXX",
    "XXXXXXXXXXX",
    ".XXXXXXXXX.",
    "..X.....X..",
    ".X.......X.",
  ]),
  // Octopus (10 pts)
  octopusA: makeBitmap([
    "....XXXX....",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
    "XXX..XX..XXX",
    "XXXXXXXXXXXX",
    "...XX..XX...",
    "..XX.XX.XX..",
    "XX........XX",
  ]),
  octopusB: makeBitmap([
    "....XXXX....",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXXX",
    "XXX..XX..XXX",
    "XXXXXXXXXXXX",
    "..XXX..XXX..",
    ".XX..XX..XX.",
    "..XX....XX..",
  ]),
  player: makeBitmap([
    "......X......",
    ".....XXX.....",
    ".....XXX.....",
    ".XXXXXXXXXXX.",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
  ]),
  ufo: makeBitmap([
    ".....XXXXXX.....",
    "...XXXXXXXXXX...",
    "..XXXXXXXXXXXX..",
    ".XX.XX.XX.XX.XX.",
    "XXXXXXXXXXXXXXXX",
    "..XXX..XX..XXX..",
    "...X........X...",
  ]),

  // Explosions
  invaderBoom: makeBitmap([
    "....X...X....",
    ".X...X.X...X.",
    "..X.......X..",
    "X.X.......X.X",
    "..X.......X..",
    ".X...X.X...X.",
    "X...X...X...X",
    "....X...X....",
  ]),
  playerBoomA: makeBitmap([
    "....X..X..X....",
    "X..X..XX.X..X..",
    ".X.XXXXXXXX.X.X",
    "...XXXXXXXXXX..",
    "..XXXXXXXXXXXX.",
    ".X.XXXXXXXXX.X.",
    "...X.XXXXX.X...",
    "..X..X.XX..X...",
  ]),
  playerBoomB: makeBitmap([
    "..X....X...X...",
    "X...X.X..X..X..",
    "..X.XXXXXX.X..X",
    ".X.XXXXXXXXXX..",
    "...XXXXXXXXXXX.",
    "..XXXXXXXXXX.X.",
    ".X..XXXXX.X....",
    "X...X.XX...X.X.",
  ]),
  ufoBoom: makeBitmap([
    ".X..X.X..X.X..X.",
    "..X.XXXXXXX.X...",
    "X.XXXXXXXXXXX.X.",
    ".XXXXXXXXXXXXXX.",
    "X.XXXXXXXXXXX.X.",
    "..X.XXXXXXX.X...",
    ".X..X..X..X..X..",
  ]),
  topBoom: makeBitmap([
    "X..X..X.",
    ".X.X.X..",
    "..XXX...",
    "XXX.XXX.",
    "..XXX...",
    ".X.X.X..",
    "X..X..X.",
  ]),
  alienBoom: makeBitmap([
    ".X..X.",
    "X.XX.X",
    ".XXXX.",
    "X.XX.X",
    ".X..X.",
  ]),

  // Alien projectiles (3 x 7)
  plunger: makeBitmap([".X.", ".X.", "XXX", ".X.", ".X.", ".X.", ".X."]),
  rollA: makeBitmap([".X.", "X..", ".X.", "..X", ".X.", "X..", ".X."]),
  rollB: makeBitmap([".X.", "..X", ".X.", "X..", ".X.", "..X", ".X."]),
  squigA: makeBitmap(["X..", ".X.", "..X", ".X.", "X..", ".X.", "..X"]),
  squigB: makeBitmap(["..X", ".X.", "X..", ".X.", "..X", ".X.", "X.."]),
  orb: makeBitmap([".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."]),

  // Final boss (36 x 14) - drawn as a left half and mirrored
  boss: makeBitmap(
    mirror([
      "..........XXXXXXXX",
      "......XXXXXXXXXXXX",
      "....XXXXXXXXXXXXXX",
      "..XXXXXXXXXXXXXXXX",
      ".XXXXXXXXXXXXXXXXX",
      "XXXXXXXXXXXXXXXXXX",
      "XXXX....XXXXXXXXXX",
      "XXXX......XXXXXXXX",
      "XXXXX....XXXXXXXXX",
      "XXXXXXXXXXXXXXXXXX",
      ".XXX.XXX.XXX.XXXXX",
      "..X...X...X...XXXX",
      "..X.......X....XXX",
      "..........X......X",
    ]),
  ),

  shield: makeBitmap(shieldRows),
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
