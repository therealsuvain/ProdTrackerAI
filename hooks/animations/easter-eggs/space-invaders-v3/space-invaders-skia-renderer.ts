// Skia renderer for the Space Invaders easter egg.
//
// The whole playfield is drawn into ONE SkPicture per frame (immediate mode),
// and handed to a <Picture> via a Reanimated shared value. React never
// re-renders during play and there is exactly one native view for the world.
//
// Everything is recorded in arcade "world pixels" (224 x 256); the canvas is
// scaled once, so all coordinates match the engine 1:1.
//
// Expensive things are cached as pictures and only rebuilt when they change:
//   * every sprite (per colour)
//   * both animation frames of the invader formation (rebuilt on a kill)
//   * the shields (rebuilt on erosion)

import {
  Skia,
  matchFont,
  type SkFont,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import { WORLD_H, WORLD_W, PLAYER_Y, UFO_Y, type Game } from "./space-invaders-engine";
import {
  BITMAPS,
  bitmapToRects,
  getAtlas,
  makeBitmap,
  type SpriteKey,
} from "./space-invaders-sprites";
import { SI_COLORS, SI_FONT } from "./space-invaders-theme";

type Canvas = ReturnType<ReturnType<typeof Skia.PictureRecorder>["beginRecording"]>;
type ColorName = "white" | "green" | "red" | "orange" | "dim" | "black" | "veil";

const INVADER_W = { squid: 8, crab: 11, octopus: 12 } as const;
const COLOR_HEX: Record<ColorName, string> = {
  white: SI_COLORS.white,
  green: SI_COLORS.green,
  red: SI_COLORS.red,
  orange: SI_COLORS.orange,
  dim: SI_COLORS.dim,
  black: "#000000",
  veil: "rgba(0,0,0,0.88)",
};
const SPRITE_COLORS: ColorName[] = ["white", "green", "red", "orange"];
const FONT_SIZES = [8, 10, 14, 16];

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
      p.setAntiAlias(false); // crisp, arcade-style pixels
      built[name] = p;
    });
    paints = built;
  }
  return paints;
}

function getFont(size: number): SkFont {
  let font = fontCache.get(size);
  if (!font) {
    font = matchFont({ fontFamily: SI_FONT, fontSize: size, fontWeight: "bold" });
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
    if (key === "shield") continue;
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

function border(c: Canvas, x: number, y: number, w: number, h: number, t: number, color: ColorName) {
  rect(c, x, y, w, t, color);
  rect(c, x, y + h - t, w, t, color);
  rect(c, x, y, t, h, color);
  rect(c, x + w - t, y, t, h, color);
}

const pad = (n: number) => String(n).padStart(5, "0");

// ---- Renderer --------------------------------------------------------------
export interface SkiaRenderer {
  render(g: Game, scale: number, blink: boolean, canRestart: boolean): SkPicture;
}

export function createSkiaRenderer(): SkiaRenderer {
  const recorder = Skia.PictureRecorder();
  const cacheRecorder = Skia.PictureRecorder();

  let formKey = -1;
  let formA: SkPicture | null = null;
  let formB: SkPicture | null = null;
  let shieldKey = -1;
  let shieldPic: SkPicture | null = null;

  const buildFormation = (g: Game, variant: "A" | "B") => {
    const c = cacheRecorder.beginRecording(Skia.XYWHRect(0, 0, 176, 80));
    for (const inv of g.invaders) {
      if (!inv.alive) continue;
      sprite(
        c,
        `${inv.kind}${variant}` as SpriteKey,
        "white",
        inv.col * 16 + ((16 - INVADER_W[inv.kind]) >> 1),
        inv.row * 16,
      );
    }
    return cacheRecorder.finishRecordingAsPicture();
  };

  const buildShields = (g: Game) => {
    const c = cacheRecorder.beginRecording(Skia.XYWHRect(0, 0, WORLD_W, WORLD_H));
    const paint = getPaints().green;
    for (const s of g.shields) {
      const rows: string[] = [];
      for (let y = 0; y < 16; y++) {
        let row = "";
        for (let x = 0; x < 22; x++) row += s.px[y * 22 + x] ? "X" : ".";
        rows.push(row);
      }
      for (const r of bitmapToRects(makeBitmap(rows))) {
        c.drawRect(Skia.XYWHRect(s.x + r.x, s.y + r.y, r.w, r.h), paint);
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

      // HUD
      text(c, "SCORE", 8, 3, 64, 8, "white");
      text(c, pad(g.score), 8, 13, 64, 8, "green");
      text(c, "HI-SCORE", 80, 3, 64, 8, "white", "center");
      text(c, pad(g.hi), 80, 13, 64, 8, "red", "center");
      text(c, g.level === 1 ? "WAVE 1" : "FINAL", 152, 3, 64, 8, "white", "right");
      text(
        c,
        g.level === 1 ? "INVADERS" : "BOSS",
        152,
        13,
        64,
        8,
        g.level === 1 ? "green" : "red",
        "right",
      );

      // Boss colour / bar
      const boss = g.boss;
      const bossColor: ColorName = !boss
        ? "red"
        : boss.flash > 0
          ? "white"
          : boss.stage === 3
            ? "orange"
            : "red";
      if (boss && g.level === 2) {
        rect(c, 24, 25, 176, 4, "red");
        rect(c, 25, 26, 174, 2, "black");
        rect(c, 25, 26, 174 * (boss.hp / boss.maxHp), 2, bossColor);
      }

      // UFO
      if (g.ufo.active) sprite(c, "ufo", "red", g.ufo.x, UFO_Y);

      // Invader formation (cached per kill)
      if (g.invaders.length > 0) {
        const key = g.runId * 100000 + g.killVersion;
        if (key !== formKey || !formA || !formB) {
          formKey = key;
          formA = buildFormation(g, "A");
          formB = buildFormation(g, "B");
        }
        c.save();
        c.translate(g.formX, g.formY);
        c.drawPicture(g.formFrame === 0 ? formA : formB);
        c.restore();
      }

      // Shields (cached per erosion)
      if (g.shields.length > 0) {
        const key = g.runId * 1000000 + g.shieldVersion;
        if (key !== shieldKey || !shieldPic) {
          shieldKey = key;
          shieldPic = buildShields(g);
        }
        c.drawPicture(shieldPic);
      }

      // Boss
      if (boss && (g.phase !== "bossDying" || Math.floor(g.phaseTime * 14) % 2 === 0)) {
        sprite(c, "boss", bossColor, boss.x, boss.y);
      }

      // Player
      const wrecked = g.phase === "gameOver" && g.endReason === "shot";
      if (g.phase === "playerDying" || wrecked) {
        const f = Math.floor(g.phaseTime / 0.12) % 2 === 0 ? "playerBoomA" : "playerBoomB";
        sprite(c, wrecked ? "playerBoomB" : f, "green", g.playerX - 1, PLAYER_Y);
      } else {
        sprite(c, "player", "green", g.playerX, PLAYER_Y);
      }

      // Player bullet
      if (g.playerBullet) {
        rect(c, Math.round(g.playerBullet.x), Math.round(g.playerBullet.y), 1, 4, "white");
      }

      // Alien bullets
      for (const b of g.alienBullets) {
        let key: SpriteKey;
        switch (b.kind) {
          case "plunger":
            key = "plunger";
            break;
          case "rolling":
            key = b.frame === 0 ? "rollA" : "rollB";
            break;
          case "squiggly":
            key = b.frame === 0 ? "squigA" : "squigB";
            break;
          default:
            key = "orb";
        }
        sprite(c, key, b.kind === "orb" ? bossColor : "white", b.x, b.y);
      }

      // Explosions
      for (const e of g.explosions) {
        if (e.kind === "ufoBoom") {
          if (e.age < 0.3) sprite(c, "ufoBoom", "red", e.x, e.y);
          else text(c, e.label ?? "", e.x - 8, e.y, 32, 8, "red", "center");
        } else {
          sprite(
            c,
            e.kind,
            e.kind === "invaderBoom" ? "white" : e.kind === "topBoom" ? "red" : "green",
            e.x,
            e.y,
          );
        }
      }

      // Ground + lives
      rect(c, 0, 239, WORLD_W, 1, "green");
      text(c, String(g.lives), 8, 243, 12, 8, "white");
      for (let i = 0; i < Math.max(0, g.lives - 1); i++) {
        sprite(c, "player", "green", 22 + i * 16, 244);
      }
      text(c, "CREDIT 01", 136, 243, 80, 8, "white", "right");

      // Banners
      switch (g.phase) {
        case "ready":
          text(c, "READY!", 0, 118, WORLD_W, 14, "white", "center");
          text(c, "WAVE 1", 0, 138, WORLD_W, 8, "green", "center");
          break;
        case "waveClear":
          text(c, "WAVE CLEARED", 0, 112, WORLD_W, 14, "green", "center");
          text(c, "SOMETHING IS COMING...", 0, 132, WORLD_W, 8, "white", "center");
          break;
        case "bossIntro":
          text(c, "WARNING!", 0, 112, WORLD_W, 16, blink ? "red" : "white", "center");
          text(c, "FINAL BOSS APPROACHING", 0, 134, WORLD_W, 8, "red", "center");
          break;
        case "bossDying":
          text(c, "BOSS DOWN!", 0, 118, WORLD_W, 14, blink ? "white" : "red", "center");
          break;
        default:
          break;
      }

      // End card
      if (g.phase === "gameOver" || g.phase === "victory") {
        const win = g.phase === "victory";
        rect(c, 16, 74, 192, 108, "veil");
        border(c, 16, 74, 192, 108, 1.5, win ? "green" : "red");
        text(c, win ? "YOU WIN!" : "GAME OVER", 17, 82, 190, 16, win ? "green" : "red", "center");
        text(
          c,
          win
            ? "EARTH IS SAFE"
            : g.endReason === "invaded"
              ? "THE INVADERS LANDED"
              : "YOU WERE SHOT DOWN",
          17,
          104,
          190,
          8,
          "dim",
          "center",
        );
        text(c, `SCORE ${pad(g.score)}`, 17, 120, 190, 10, "white", "center");
        text(c, `HI-SCORE ${pad(g.hi)}`, 17, 134, 190, 10, "red", "center");
        if (g.newRecord) {
          text(c, "NEW HIGH SCORE!", 17, 150, 190, 8, blink ? "green" : "white", "center");
        }
        if (canRestart) {
          text(c, "TAP TO PLAY AGAIN", 17, 166, 190, 8, blink ? "white" : "dim", "center");
        }
      }

      return recorder.finishRecordingAsPicture();
    },
  };
}
