// Skia renderer for the Snake easter egg.
//
// Everything is recorded in LCD pixels (world units) and scaled once by
// `layout.p`. The static LCD look (vignette, pixel grid, HUD divider, dotted
// wrap-around frame) is one cached picture; only snake / food / HUD are
// re-recorded, and only when the engine marks the game dirty.

import {
  Skia,
  TileMode,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import {
  CELL,
  type SnakeLayout,
} from "./snake-layout";
import {
  FONT,
  SNAKE_BODY,
  SNAKE_BONUS,
  SNAKE_FOOD,
  SNAKE_HEAD_CLOSED,
  SNAKE_HEAD_OPEN,
} from "./snake-sprites";
import { SNAKE_COLORS as C } from "./snake-theme";
import { foodAhead, isEndPhase, type Game } from "./snake-engine";

const GAP = 0.09; // gap between lit LCD pixels
const GHOST = 0.25; // LCD "ghost" offset

let paints: { ink: SkPaint; ghost: SkPaint; fill: SkPaint; grid: SkPaint } | null =
  null;
const spriteCache = new Map<string, SkPicture>();
const bgCache = new Map<string, SkPicture>();

function getPaints() {
  if (!paints) {
    const mk = (color: string) => {
      const p = Skia.Paint();
      p.setColor(Skia.Color(color));
      p.setAntiAlias(false);
      return p;
    };
    paints = {
      ink: mk(C.ink),
      ghost: mk(C.inkGhost),
      fill: mk(C.lcdMid),
      grid: mk(C.grid),
    };
  }
  return paints;
}

type Canvas = ReturnType<ReturnType<typeof Skia.PictureRecorder>["beginRecording"]>;

function rect(c: Canvas, x: number, y: number, w: number, h: number, paint: SkPaint) {
  c.drawRect(Skia.XYWHRect(x, y, w, h), paint);
}

function sprite(rows: string[], tone: "ink" | "ghost", id: string): SkPicture {
  const key = `${id}:${tone}`;
  let pic = spriteCache.get(key);
  if (!pic) {
    const h = rows.length;
    const w = rows[0].length;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, w, h));
    const paint = getPaints()[tone];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rows[y][x] === "X") rect(c, x + GAP, y + GAP, 1 - GAP * 2, 1 - GAP * 2, paint);
      }
    }
    pic = rec.finishRecordingAsPicture();
    spriteCache.set(key, pic);
  }
  return pic;
}

function blit(c: Canvas, rows: string[], id: string, x: number, y: number) {
  c.save();
  c.translate(x + GHOST, y + GHOST);
  c.drawPicture(sprite(rows, "ghost", id));
  c.restore();
  c.save();
  c.translate(x, y);
  c.drawPicture(sprite(rows, "ink", id));
  c.restore();
}

// ---- Pixel text ------------------------------------------------------------
export const textWidth = (s: string, size: number) =>
  s.length * 4 * size - size;

function text(c: Canvas, s: string, x: number, y: number, size: number) {
  const { ink, ghost } = getPaints();
  for (const pass of [0, 1]) {
    const paint = pass === 0 ? ghost : ink;
    const off = pass === 0 ? GHOST : 0;
    let cx = x;
    for (const ch of s) {
      const glyph = FONT[ch];
      if (glyph) {
        for (let r = 0; r < 5; r++) {
          for (let k = 0; k < 3; k++) {
            if (glyph[r][k] === "X") {
              rect(
                c,
                cx + k * size + off + GAP,
                y + r * size + off + GAP,
                size - GAP * 2,
                size - GAP * 2,
                paint,
              );
            }
          }
        }
      }
      cx += 4 * size;
    }
  }
}

function centeredText(c: Canvas, s: string, cx: number, y: number, size: number) {
  text(c, s, Math.round(cx - textWidth(s, size) / 2), y, size);
}

// ---- Static LCD background -------------------------------------------------
function lcdBackground(worldW: number, worldH: number): SkPicture {
  const key = `${worldW}x${worldH}`;
  let pic = bgCache.get(key);
  if (pic) return pic;

  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, worldW, worldH));

  const base = Skia.Paint();
  base.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: worldW * 0.45, y: worldH * 0.4 },
      Math.max(worldW, worldH) * 0.85,
      [Skia.Color(C.lcdLight), Skia.Color(C.lcdMid), Skia.Color(C.lcdDark)],
      [0, 0.55, 1],
      TileMode.Clamp,
    ),
  );
  rect(c, 0, 0, worldW, worldH, base);

  // Soft shadow cast by the top bezel.
  const shade = Skia.Paint();
  shade.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: 14 },
      [Skia.Color("rgba(15,25,8,0.30)"), Skia.Color("rgba(15,25,8,0)")],
      null,
      TileMode.Clamp,
    ),
  );
  rect(c, 0, 0, worldW, 14, shade);

  // LCD pixel grid.
  const { grid } = getPaints();
  for (let x = 0; x <= worldW; x++) rect(c, x - 0.07, 0, 0.14, worldH, grid);
  for (let y = 0; y <= worldH; y++) rect(c, 0, y - 0.07, worldW, 0.14, grid);

  pic = rec.finishRecordingAsPicture();
  if (bgCache.size > 4) bgCache.clear();
  bgCache.set(key, pic);
  return pic;
}

const pad4 = (n: number) => String(Math.min(n, 99999)).padStart(4, "0");

// ---- Game renderer ---------------------------------------------------------
export function createSnakeRenderer(L: SnakeLayout) {
  const { fieldX, fieldY, cols, rows, worldW, worldH } = L;
  const fw = cols * CELL;
  const fh = rows * CELL;

  // Static layer: LCD + HUD divider + dotted wrap-around frame (cached).
  let staticPic: SkPicture | null = null;
  const getStatic = () => {
    if (staticPic) return staticPic;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, worldW, worldH));
    c.drawPicture(lcdBackground(worldW, worldH));
    const { ink } = getPaints();
    rect(c, 3, 15, worldW - 6, 1, ink);
    // dotted frame: it is NOT a wall - the snake wraps straight through it
    for (let x = -2; x <= fw + 1; x += 2) {
      rect(c, fieldX + x, fieldY - 2, 1, 1, ink);
      rect(c, fieldX + x, fieldY + fh + 1, 1, 1, ink);
    }
    for (let y = -2; y <= fh + 1; y += 2) {
      rect(c, fieldX - 2, fieldY + y, 1, 1, ink);
      rect(c, fieldX + fw + 1, fieldY + y, 1, 1, ink);
    }
    staticPic = rec.finishRecordingAsPicture();
    return staticPic;
  };

  const cellXY = (idx: number) => ({
    x: fieldX + (idx % cols) * CELL,
    y: fieldY + ((idx / cols) | 0) * CELL,
  });

  function render(g: Game, blink: boolean, canRestart: boolean): SkPicture {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, L.canvasW, L.canvasH));
    c.scale(L.p, L.p);
    c.drawPicture(getStatic());

    // HUD: score (left), bonus timer or hi-score (right)
    text(c, pad4(g.score), 4, 3, 2);
    if (g.bonus) {
      const t = String(Math.ceil(g.bonus.ttl));
      const tw = textWidth(t, 2);
      text(c, t, worldW - 4 - tw, 3, 2);
      blit(c, SNAKE_BONUS, "bonus", worldW - 4 - tw - 10, 3);
    } else {
      const hi = pad4(Math.max(g.hi, g.score));
      const hw = textWidth(hi, 1);
      text(c, hi, worldW - 4 - hw, 8, 1);
      text(c, "HI", worldW - 4 - hw - 10, 8, 1);
    }

    // food
    if (g.food >= 0) {
      const f = cellXY(g.food);
      blit(c, SNAKE_FOOD, "food", f.x, f.y);
    }

    // bonus (flashes when about to expire)
    if (g.bonus && (g.bonus.ttl >= 4 || Math.floor(g.time * 4) % 2 === 0)) {
      blit(
        c,
        SNAKE_BONUS,
        "bonus",
        fieldX + g.bonus.x * CELL,
        fieldY + g.bonus.y * CELL,
      );
    }

    // snake (blinks on death)
    const dying = isEndPhase(g) && g.phase === "over" && g.phaseTime < 1.2;
    const hideSnake = dying && Math.floor(g.phaseTime * 5) % 2 === 1;
    if (!hideSnake) {
      const last = g.body.length - 1;
      for (let i = 0; i < last; i++) {
        const p = cellXY(g.body[i]);
        blit(c, SNAKE_BODY, "body", p.x, p.y);
      }
      const hp = cellXY(g.body[last]);
      const open = g.phase === "playing" && foodAhead(g, 2);
      if (open) {
        blit(c, SNAKE_HEAD_OPEN[g.dir], `open${g.dir}`, hp.x, hp.y);
      } else {
        blit(c, SNAKE_HEAD_CLOSED, "head", hp.x, hp.y);
      }
    }

    // messages
    const mx = fieldX + fw / 2;
    const my = fieldY + fh / 2;
    const box = (w: number, h: number) => {
      const bx = Math.round(mx - w / 2);
      const by = Math.round(my - h / 2);
      const { fill, ink } = getPaints();
      rect(c, bx, by, w, h, fill);
      rect(c, bx, by, w, 1, ink);
      rect(c, bx, by + h - 1, w, 1, ink);
      rect(c, bx, by, 1, h, ink);
      rect(c, bx + w - 1, by, 1, h, ink);
      return by;
    };

    if (g.phase === "ready") {
      const by = box(44, 30);
      centeredText(c, "SNAKE", mx, by + 4, 2);
      if (blink) centeredText(c, "PRESS KEY", mx, by + 20, 1);
    } else if (g.phase === "paused") {
      const by = box(40, 16);
      centeredText(c, "PAUSED", mx, by + 6, 1);
    } else if (g.phase === "over" && g.phaseTime > 0.7) {
      const by = box(48, 48);
      centeredText(c, "GAME", mx, by + 4, 2);
      centeredText(c, "OVER", mx, by + 16, 2);
      centeredText(c, `SCORE ${g.score}`, mx, by + 29, 1);
      if (canRestart && blink) centeredText(c, "AGAIN", mx, by + 38, 1);
    } else if (g.phase === "won") {
      const by = box(44, 30);
      centeredText(c, "YOU", mx, by + 4, 2);
      centeredText(c, "WIN!", mx, by + 16, 2);
    }

    return rec.finishRecordingAsPicture();
  }

  return { render, prepare: () => { getStatic(); getPaints(); } };
}

/** Builds paints, sprites and the LCD background up front (loading step). */
export function prepareSnakeAssets(L: SnakeLayout) {
  getPaints();
  lcdBackground(L.worldW, L.worldH);
  const ids: [string[], string][] = [
    [SNAKE_BODY, "body"],
    [SNAKE_HEAD_CLOSED, "head"],
    [SNAKE_FOOD, "food"],
    [SNAKE_BONUS, "bonus"],
    ...([0, 1, 2, 3] as const).map(
      (d) => [SNAKE_HEAD_OPEN[d], `open${d}`] as [string[], string],
    ),
  ];
  for (const [rows, id] of ids) {
    sprite(rows, "ink", id);
    sprite(rows, "ghost", id);
  }
}

// ---- Loading screen --------------------------------------------------------
// A snake winds through a serpentine path, eating pellets; its position along
// the path is the progress and its length grows as the load advances.
const LOAD_W = 84; // the original Nokia LCD width, in pixels
const PATH_COLS = 18;
const PATH_ROWS = 3;

const loadPath: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let r = 0; r < PATH_ROWS; r++) {
    const ltr = r % 2 === 0;
    for (let i = 0; i < PATH_COLS; i++) {
      out.push({ x: ltr ? i : PATH_COLS - 1 - i, y: r * 2 });
    }
    if (r < PATH_ROWS - 1) out.push({ x: ltr ? PATH_COLS - 1 : 0, y: r * 2 + 1 });
  }
  return out;
})();

export function computeLoadingLayout(width: number, height: number, ratio: number) {
  const p = Math.max(Math.floor((width / LOAD_W) * ratio) / ratio, 1);
  const worldW = LOAD_W;
  const worldH = Math.ceil(height / p);
  return { p, worldW, worldH, canvasW: Math.ceil(worldW * p), canvasH: height };
}

export function renderSnakeLoading(
  L: ReturnType<typeof computeLoadingLayout>,
  progress: number,
  label: string,
  hi: number,
  time: number,
): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, L.canvasW, L.canvasH));
  c.scale(L.p, L.p);
  c.drawPicture(lcdBackground(L.worldW, L.worldH));

  const blockH = 74;
  const top = Math.max(6, Math.round((L.worldH - blockH) / 2));
  const cx = L.worldW / 2;

  centeredText(c, "SNAKE", cx, top, 3);

  const trackX = Math.round((L.worldW - PATH_COLS * CELL) / 2);
  const trackY = top + 26;
  const headIdx = Math.round((Math.min(progress, 100) / 100) * (loadPath.length - 1));
  const len = 4 + Math.floor(progress / 20);

  // pellets ahead of the head
  for (let i = headIdx + 2; i < loadPath.length; i++) {
    const cell = loadPath[i];
    if (cell.y % 2 === 0 && i % 3 === 0) {
      blit(c, SNAKE_FOOD, "food", trackX + cell.x * CELL, trackY + cell.y * CELL);
    }
  }
  // body + head
  for (let i = Math.max(0, headIdx - len + 1); i < headIdx; i++) {
    const cell = loadPath[i];
    blit(c, SNAKE_BODY, "body", trackX + cell.x * CELL, trackY + cell.y * CELL);
  }
  const hc = loadPath[headIdx];
  const open = Math.floor(time * 4) % 2 === 0;
  const prev = loadPath[Math.max(0, headIdx - 1)];
  const next = loadPath[Math.min(loadPath.length - 1, headIdx + 1)];
  const dx = (next.x - prev.x) || (hc.x - prev.x);
  const dy = (next.y - prev.y) || (hc.y - prev.y);
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : dy >= 0 ? 2 : 0;
  if (open) {
    blit(c, SNAKE_HEAD_OPEN[dir as 0 | 1 | 2 | 3], `open${dir}`, trackX + hc.x * CELL, trackY + hc.y * CELL);
  } else {
    blit(c, SNAKE_HEAD_CLOSED, "head", trackX + hc.x * CELL, trackY + hc.y * CELL);
  }

  const lineY = trackY + (PATH_ROWS * 2 - 1) * CELL + 8;
  centeredText(c, label.toUpperCase().slice(0, 20), cx, lineY, 1);
  centeredText(c, `${Math.round(progress)}%`, cx, lineY + 9, 1);
  if (hi > 0) centeredText(c, `HI ${pad4(hi)}`, cx, lineY + 20, 1);

  return rec.finishRecordingAsPicture();
}
