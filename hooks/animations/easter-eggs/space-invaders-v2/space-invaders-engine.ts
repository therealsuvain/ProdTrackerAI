// Pure Space Invaders game logic. No React / React Native imports so it can be
// unit-tested headlessly. World space is the arcade's 224 x 256 pixel grid.

import { BITMAPS } from "./space-invaders-sprites";

// ---- World constants -------------------------------------------------------
export const WORLD_W = 224;
export const WORLD_H = 256;
export const PLAYER_Y = 216;
export const GROUND_Y = 239;
export const SHIELD_Y = 184;
export const UFO_Y = 32;
export const BOSS_Y = 44;

export const PLAYER_W = BITMAPS.player.w;
export const PLAYER_H = BITMAPS.player.h;
export const SHIELD_W = BITMAPS.shield.w;
export const SHIELD_H = BITMAPS.shield.h;
export const UFO_W = BITMAPS.ufo.w;
export const UFO_H = BITMAPS.ufo.h;
export const BOSS_W = BITMAPS.boss.w;
export const BOSS_H = BITMAPS.boss.h;
export const BOSS_HP = 30;
export const END_INPUT_DELAY = 1.2;

const CELL = 16;
const FORM_START_X = 24;
const FORM_START_Y = 64;
const FORM_COLS = 11;
const EDGE_L = 6;
const EDGE_R = WORLD_W - 6;
const STEP_PX = 2;
const DROP_PX = 8;

const PLAYER_SPEED = 78;
const PLAYER_BULLET_SPEED = 270;
const BULLET_CEILING = 30;
const UFO_SPEED = 46;

const READY_TIME = 1.8;
const PLAYER_DEATH_TIME = 1.8;
const WAVE_CLEAR_TIME = 2.2;
const BOSS_INTRO_TIME = 3.4;
const BOSS_DEATH_TIME = 2.6;

const EXTRA_LIFE_SCORE = 1500;
const SHIELD_XS = [32, 77, 122, 167];

/** Original UFO score table, indexed by (shots fired mod 15). */
const UFO_TABLE = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100];

// ---- Types -----------------------------------------------------------------
export type InvaderKind = "squid" | "crab" | "octopus";
export type Phase =
  | "ready"
  | "playing"
  | "playerDying"
  | "waveClear"
  | "bossIntro"
  | "bossDying"
  | "gameOver"
  | "victory";

export type GameEventName =
  | "shoot"
  | "step"
  | "invaderKilled"
  | "playerHit"
  | "ufoSpawn"
  | "ufoHit"
  | "bossWarning"
  | "bossHit"
  | "bossStage"
  | "bossDown"
  | "extraLife"
  | "waveClear"
  | "gameOver"
  | "victory";

export interface GameEvent {
  name: GameEventName;
  n?: number;
}

export interface GameInput {
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface Invader {
  row: number;
  col: number;
  kind: InvaderKind;
  alive: boolean;
}

export type AlienBulletKind = "plunger" | "rolling" | "squiggly" | "orb";

export interface AlienBullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  kind: AlienBulletKind;
  frame: 0 | 1;
  anim: number;
}

export type ExplosionKind = "invaderBoom" | "alienBoom" | "topBoom" | "ufoBoom";

export interface Explosion {
  id: number;
  x: number;
  y: number;
  kind: ExplosionKind;
  age: number;
  ttl: number;
  label?: string;
}

export interface Shield {
  x: number;
  y: number;
  px: Uint8Array;
  version: number;
}

export interface Boss {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  t: number;
  fireTimer: number;
  flash: number;
  stage: 1 | 2 | 3;
  pattern: number;
}

export interface Game {
  runId: number;
  level: 1 | 2;
  phase: Phase;
  phaseTime: number;
  time: number;

  score: number;
  hi: number;
  startHi: number;
  newRecord: boolean;
  lives: number;
  extraLifeGiven: boolean;

  playerX: number;
  playerBullet: { x: number; y: number } | null;
  shotsFired: number;

  invaders: Invader[];
  aliveCount: number;
  formX: number;
  formY: number;
  formDir: 1 | -1;
  formFrame: 0 | 1;
  stepTimer: number;
  stepIndex: number;
  killVersion: number;

  alienBullets: AlienBullet[];
  alienFireTimer: number;
  bulletSeq: number;
  bulletKindCycle: number;

  ufo: { active: boolean; x: number; dir: 1 | -1 };
  ufoTimer: number;
  ufoNextDir: 1 | -1;

  explosions: Explosion[];
  shields: Shield[];
  shieldVersion: number;

  boss: Boss | null;
  bossReserve: Boss | null;
  fxTimer: number;

  events: GameEvent[];
  runEnded: boolean;
  endReason: "shot" | "invaded" | "victory" | null;
}

// ---- Helpers ---------------------------------------------------------------
let runCounter = 0;

const INVADER_W: Record<InvaderKind, number> = {
  squid: BITMAPS.squidA.w,
  crab: BITMAPS.crabA.w,
  octopus: BITMAPS.octopusA.w,
};
const INVADER_H = BITMAPS.squidA.h;
const ROW_KINDS: InvaderKind[] = ["squid", "crab", "crab", "octopus", "octopus"];
export const INVADER_POINTS: Record<InvaderKind, number> = {
  squid: 30,
  crab: 20,
  octopus: 10,
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function overlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function emit(g: Game, name: GameEventName, n?: number) {
  g.events.push({ name, n });
}

function addExplosion(
  g: Game,
  x: number,
  y: number,
  kind: ExplosionKind,
  ttl: number,
  label?: string,
) {
  g.explosions.push({ id: ++g.bulletSeq, x, y, kind, age: 0, ttl, label });
}

function addScore(g: Game, points: number) {
  g.score += points;
  if (g.score > g.hi) g.hi = g.score;
  if (!g.extraLifeGiven && g.score >= EXTRA_LIFE_SCORE) {
    g.extraLifeGiven = true;
    g.lives += 1;
    emit(g, "extraLife");
  }
}

export function invaderRect(g: Game, inv: Invader) {
  const w = INVADER_W[inv.kind];
  return {
    x: g.formX + inv.col * CELL + ((CELL - w) >> 1),
    y: g.formY + inv.row * CELL,
    w,
    h: INVADER_H,
  };
}

export function isEndPhase(g: Game) {
  return g.phase === "gameOver" || g.phase === "victory";
}

// ---- Construction (split in steps so the loading screen can show them) -----
export function createGame(hi: number): Game {
  return {
    runId: ++runCounter,
    level: 1,
    phase: "ready",
    phaseTime: 0,
    time: 0,
    score: 0,
    hi,
    startHi: hi,
    newRecord: false,
    lives: 3,
    extraLifeGiven: false,
    playerX: Math.floor((WORLD_W - PLAYER_W) / 2),
    playerBullet: null,
    shotsFired: 0,
    invaders: [],
    aliveCount: 0,
    formX: FORM_START_X,
    formY: FORM_START_Y,
    formDir: 1,
    formFrame: 0,
    stepTimer: 0,
    stepIndex: 0,
    killVersion: 0,
    alienBullets: [],
    alienFireTimer: 1.4,
    bulletSeq: 0,
    bulletKindCycle: 0,
    ufo: { active: false, x: 0, dir: 1 },
    ufoTimer: 12,
    ufoNextDir: 1,
    explosions: [],
    shields: [],
    shieldVersion: 0,
    boss: null,
    bossReserve: null,
    fxTimer: 0,
    events: [],
    runEnded: false,
    endReason: null,
  };
}

export function spawnFormation(g: Game) {
  g.invaders = [];
  for (let row = 0; row < ROW_KINDS.length; row++) {
    for (let col = 0; col < FORM_COLS; col++) {
      g.invaders.push({ row, col, kind: ROW_KINDS[row], alive: true });
    }
  }
  g.aliveCount = g.invaders.length;
  g.formX = FORM_START_X;
  g.formY = FORM_START_Y;
  g.formDir = 1;
  g.formFrame = 0;
  g.stepTimer = 0;
  g.stepIndex = 0;
  g.killVersion++;
}

export function buildShields(g: Game) {
  const bm = BITMAPS.shield;
  g.shields = SHIELD_XS.map((x) => {
    const px = new Uint8Array(SHIELD_W * SHIELD_H);
    for (let y = 0; y < SHIELD_H; y++) {
      for (let xx = 0; xx < SHIELD_W; xx++) {
        px[y * SHIELD_W + xx] = bm.rows[y][xx] === "X" ? 1 : 0;
      }
    }
    return { x, y: SHIELD_Y, px, version: 0 };
  });
  g.shieldVersion++;
}

export function primeBoss(g: Game) {
  g.bossReserve = {
    x: (WORLD_W - BOSS_W) / 2,
    y: -BOSS_H,
    w: BOSS_W,
    h: BOSS_H,
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    t: 0,
    fireTimer: 1.4,
    flash: 0,
    stage: 1,
    pattern: 0,
  };
}

export function createReadyGame(hi: number): Game {
  const g = createGame(hi);
  spawnFormation(g);
  buildShields(g);
  primeBoss(g);
  return g;
}

/** Runs a throwaway simulation so JIT / allocations are warm before play. */
export function warmUpEngine(frames = 240) {
  const g = createReadyGame(0);
  g.phase = "playing";
  const input: GameInput = { left: false, right: false, fire: true };
  for (let i = 0; i < frames; i++) {
    input.left = i % 90 < 45;
    input.right = !input.left;
    updateGame(g, input, 1 / 60);
    g.events.length = 0;
  }
}

// ---- Phase control ---------------------------------------------------------
function setPhase(g: Game, phase: Phase) {
  g.phase = phase;
  g.phaseTime = 0;
}

function endRun(g: Game, reason: "shot" | "invaded" | "victory") {
  g.runEnded = true;
  g.endReason = reason;
  g.newRecord = g.score > g.startHi;
  g.playerBullet = null;
  g.alienBullets = [];
  g.ufo.active = false;
  if (reason === "victory") {
    setPhase(g, "victory");
    emit(g, "victory");
  } else {
    if (reason === "invaded") g.lives = 0;
    setPhase(g, "gameOver");
    emit(g, "gameOver");
  }
}

function killPlayer(g: Game) {
  g.lives = Math.max(0, g.lives - 1);
  g.playerBullet = null;
  setPhase(g, "playerDying");
  emit(g, "playerHit");
}

function beginBoss(g: Game) {
  g.level = 2;
  if (!g.bossReserve) primeBoss(g);
  g.boss = g.bossReserve;
  g.bossReserve = null;
  g.invaders = [];
  g.aliveCount = 0;
  g.alienBullets = [];
  g.playerBullet = null;
  g.ufo.active = false;
  buildShields(g);
  setPhase(g, "bossIntro");
  emit(g, "bossWarning");
}

// ---- Shields ---------------------------------------------------------------
function findShieldImpact(
  s: Shield,
  x: number,
  y: number,
  w: number,
  h: number,
  scanBottomUp: boolean,
): { x: number; y: number } | null {
  const x0 = Math.max(0, Math.floor(x - s.x));
  const x1 = Math.min(SHIELD_W - 1, Math.ceil(x + w - s.x) - 1);
  const y0 = Math.max(0, Math.floor(y - s.y));
  const y1 = Math.min(SHIELD_H - 1, Math.ceil(y + h - s.y) - 1);
  if (x1 < x0 || y1 < y0) return null;
  if (scanBottomUp) {
    for (let yy = y1; yy >= y0; yy--)
      for (let xx = x0; xx <= x1; xx++)
        if (s.px[yy * SHIELD_W + xx]) return { x: xx, y: yy };
  } else {
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++)
        if (s.px[yy * SHIELD_W + xx]) return { x: xx, y: yy };
  }
  return null;
}

function erodeShield(g: Game, s: Shield, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= SHIELD_W || y < 0 || y >= SHIELD_H) continue;
      const d = dx * dx + dy * dy;
      if (d <= r * r && (d <= 1 || Math.random() > 0.3)) {
        s.px[y * SHIELD_W + x] = 0;
      }
    }
  }
  s.version++;
  g.shieldVersion++;
}

/** Marching invaders chew through any shield pixels they overlap. */
function trampleShields(g: Game) {
  for (const inv of g.invaders) {
    if (!inv.alive) continue;
    const r = invaderRect(g, inv);
    if (r.y + r.h < SHIELD_Y) continue;
    for (const s of g.shields) {
      const ox0 = Math.max(r.x, s.x);
      const ox1 = Math.min(r.x + r.w, s.x + SHIELD_W);
      const oy0 = Math.max(r.y, s.y);
      const oy1 = Math.min(r.y + r.h, s.y + SHIELD_H);
      if (ox1 <= ox0 || oy1 <= oy0) continue;
      let changed = false;
      for (let y = oy0; y < oy1; y++) {
        for (let x = ox0; x < ox1; x++) {
          const idx = (y - s.y) * SHIELD_W + (x - s.x);
          if (s.px[idx]) {
            s.px[idx] = 0;
            changed = true;
          }
        }
      }
      if (changed) {
        s.version++;
        g.shieldVersion++;
      }
    }
  }
}

// ---- Player ----------------------------------------------------------------
function movePlayer(g: Game, input: GameInput, dt: number) {
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  g.playerX = clamp(g.playerX + dir * PLAYER_SPEED * dt, 6, WORLD_W - 6 - PLAYER_W);
}

function tryFire(g: Game, input: GameInput) {
  if (!input.fire || g.playerBullet) return;
  g.playerBullet = { x: Math.round(g.playerX) + 6, y: PLAYER_Y - 4 };
  g.shotsFired++;
  emit(g, "shoot");
}

function hitUfo(g: Game, b: { x: number; y: number }) {
  if (!g.ufo.active) return false;
  if (!overlap(b.x, b.y, 1, 4, g.ufo.x, UFO_Y, UFO_W, UFO_H)) return false;
  const pts = UFO_TABLE[g.shotsFired % UFO_TABLE.length];
  addScore(g, pts);
  addExplosion(g, g.ufo.x, UFO_Y, "ufoBoom", 0.9, String(pts));
  g.ufo.active = false;
  emit(g, "ufoHit");
  return true;
}

function hitInvader(g: Game, b: { x: number; y: number }) {
  if (g.level !== 1) return false;
  // Cheap reject: most bullet steps are nowhere near the formation.
  if (b.y + 4 < g.formY || b.y > g.formY + ROW_KINDS.length * CELL) return false;
  for (const inv of g.invaders) {
    if (!inv.alive) continue;
    const w = INVADER_W[inv.kind];
    const rx = g.formX + inv.col * CELL + ((CELL - w) >> 1);
    const ry = g.formY + inv.row * CELL;
    if (!overlap(b.x, b.y, 1, 4, rx, ry, w, INVADER_H)) continue;
    inv.alive = false;
    g.aliveCount--;
    g.killVersion++;
    addScore(g, INVADER_POINTS[inv.kind]);
    addExplosion(g, rx + w / 2 - 6.5, ry, "invaderBoom", 0.25);
    emit(g, "invaderKilled");
    return true;
  }
  return false;
}

function hitBoss(g: Game, b: { x: number; y: number }) {
  const boss = g.boss;
  if (!boss || g.level !== 2 || g.phase !== "playing") return false;
  if (!overlap(b.x, b.y, 1, 4, boss.x, boss.y, boss.w, boss.h)) return false;
  boss.hp -= 1;
  boss.flash = 0.09;
  addScore(g, 10);
  addExplosion(g, b.x - 3, b.y - 2, "alienBoom", 0.2);
  emit(g, "bossHit");
  if (boss.hp <= 0) {
    boss.hp = 0;
    addScore(g, 1000);
    g.alienBullets = [];
    g.fxTimer = 0;
    setPhase(g, "bossDying");
    emit(g, "bossDown");
  }
  return true;
}

function hitAlienBullet(g: Game, b: { x: number; y: number }) {
  for (let i = 0; i < g.alienBullets.length; i++) {
    const ab = g.alienBullets[i];
    if (overlap(b.x, b.y, 1, 4, ab.x, ab.y, ab.w, ab.h)) {
      g.alienBullets.splice(i, 1);
      addExplosion(g, ab.x + ab.w / 2 - 3, ab.y, "alienBoom", 0.25);
      return true;
    }
  }
  return false;
}

function hitShield(g: Game, b: { x: number; y: number }) {
  for (const s of g.shields) {
    const hit = findShieldImpact(s, b.x, b.y, 1, 4, true);
    if (hit) {
      erodeShield(g, s, hit.x, hit.y, 2);
      addExplosion(g, s.x + hit.x - 3, s.y + hit.y - 3, "alienBoom", 0.2);
      return true;
    }
  }
  return false;
}

function updatePlayerBullet(g: Game, dt: number) {
  if (!g.playerBullet) return;
  let remaining = PLAYER_BULLET_SPEED * dt;
  while (remaining > 0 && g.playerBullet) {
    const step = Math.min(2, remaining);
    remaining -= step;
    const b = g.playerBullet;
    b.y -= step;
    if (b.y <= BULLET_CEILING) {
      addExplosion(g, b.x - 3, BULLET_CEILING - 3, "topBoom", 0.3);
      g.playerBullet = null;
      return;
    }
    if (
      hitUfo(g, b) ||
      hitInvader(g, b) ||
      hitBoss(g, b) ||
      hitAlienBullet(g, b) ||
      hitShield(g, b)
    ) {
      g.playerBullet = null;
      return;
    }
  }
}

// ---- Invaders --------------------------------------------------------------
function stepFormationOnce(g: Game) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const inv of g.invaders) {
    if (!inv.alive) continue;
    const r = invaderRect(g, inv);
    if (r.x < minX) minX = r.x;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
  }
  if (minX === Infinity) return;

  const dx = g.formDir * STEP_PX;
  if (minX + dx < EDGE_L || maxX + dx > EDGE_R) {
    g.formY += DROP_PX;
    g.formDir = g.formDir === 1 ? -1 : 1;
  } else {
    g.formX += dx;
  }
  g.formFrame = g.formFrame === 0 ? 1 : 0;
  emit(g, "step", g.stepIndex++ % 4);

  trampleShields(g);

  // Invaders that reach the player's row end the game.
  let lowest = -Infinity;
  for (const inv of g.invaders) {
    if (!inv.alive) continue;
    const r = invaderRect(g, inv);
    lowest = Math.max(lowest, r.y + r.h);
  }
  if (lowest >= PLAYER_Y) endRun(g, "invaded");
}

function stepInvaders(g: Game, dt: number) {
  const interval = Math.max((Math.max(g.aliveCount, 1) / 60) * 0.4, 1 / 60);
  g.stepTimer += dt;
  let guard = 0;
  while (g.stepTimer >= interval && guard++ < 4 && g.phase === "playing") {
    g.stepTimer -= interval;
    stepFormationOnce(g);
  }
}

function pushBullet(
  g: Game,
  x: number,
  y: number,
  vx: number,
  vy: number,
  kind: AlienBulletKind,
) {
  const orb = kind === "orb";
  g.alienBullets.push({
    id: ++g.bulletSeq,
    x,
    y,
    vx,
    vy,
    w: orb ? 5 : 3,
    h: orb ? 5 : 7,
    kind,
    frame: 0,
    anim: 0,
  });
}

function alienFire(g: Game, dt: number) {
  g.alienFireTimer -= dt;
  if (g.alienFireTimer > 0 || g.alienBullets.length >= 3 || g.aliveCount === 0) {
    return;
  }

  const bottoms = new Map<number, Invader>();
  for (const inv of g.invaders) {
    if (!inv.alive) continue;
    const cur = bottoms.get(inv.col);
    if (!cur || inv.row > cur.row) bottoms.set(inv.col, inv);
  }
  const candidates = Array.from(bottoms.values());
  if (candidates.length === 0) return;

  let shooter = candidates[Math.floor(Math.random() * candidates.length)];
  if (Math.random() < 0.4) {
    // Aimed shot: the column nearest the player.
    let best = Infinity;
    const target = g.playerX + PLAYER_W / 2;
    for (const inv of candidates) {
      const r = invaderRect(g, inv);
      const d = Math.abs(r.x + r.w / 2 - target);
      if (d < best) {
        best = d;
        shooter = inv;
      }
    }
  }

  const kinds: AlienBulletKind[] = ["rolling", "plunger", "squiggly"];
  const kind = kinds[g.bulletKindCycle++ % kinds.length];
  const r = invaderRect(g, shooter);
  const speed = 92 + (1 - g.aliveCount / 55) * 55;
  pushBullet(g, r.x + r.w / 2 - 1, r.y + r.h, 0, speed, kind);
  g.alienFireTimer = (0.45 + Math.random() * 0.7) * (0.5 + (0.5 * g.aliveCount) / 55);
}

function updateUfo(g: Game, dt: number) {
  if (g.ufo.active) {
    g.ufo.x += g.ufo.dir * UFO_SPEED * dt;
    if (g.ufo.x > WORLD_W || g.ufo.x + UFO_W < 0) g.ufo.active = false;
    return;
  }
  g.ufoTimer -= dt;
  if (g.ufoTimer > 0) return;
  if (g.aliveCount < 8) {
    g.ufoTimer = 1;
    return;
  }
  g.ufo.active = true;
  g.ufo.dir = g.ufoNextDir;
  g.ufo.x = g.ufo.dir > 0 ? -UFO_W : WORLD_W;
  g.ufoNextDir = g.ufoNextDir === 1 ? -1 : 1;
  g.ufoTimer = 20 + Math.random() * 8;
  emit(g, "ufoSpawn");
}

// ---- Boss ------------------------------------------------------------------
function bossFire(g: Game, boss: Boss) {
  const ox = boss.x + boss.w / 2 - 2.5;
  const oy = boss.y + boss.h - 2;
  const px = g.playerX + PLAYER_W / 2;
  const aim = clamp(Math.atan2(PLAYER_Y - oy, px - ox), 0.45, Math.PI - 0.45);
  const speed = 80 + 12 * boss.stage;

  let angles: number[];
  if (boss.stage === 1) angles = [aim];
  else if (boss.stage === 2) angles = [aim - 0.32, aim, aim + 0.32];
  else if (boss.pattern % 2 === 0)
    angles = [aim - 0.55, aim - 0.28, aim, aim + 0.28, aim + 0.55];
  else angles = [aim - 0.12, aim + 0.12];
  boss.pattern++;

  for (const a of angles) {
    const ang = clamp(a, 0.35, Math.PI - 0.35);
    pushBullet(g, ox, oy, Math.cos(ang) * speed, Math.sin(ang) * speed, "orb");
  }
}

function updateBoss(g: Game, dt: number) {
  const boss = g.boss;
  if (!boss) return;
  const ratio = boss.hp / boss.maxHp;
  const stage: 1 | 2 | 3 = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (stage !== boss.stage) {
    boss.stage = stage;
    boss.flash = 0.4;
    boss.fireTimer = Math.min(boss.fireTimer, 0.6);
    emit(g, "bossStage", stage);
  }
  boss.t += dt * (0.75 + 0.3 * (stage - 1));
  const amp = (WORLD_W - boss.w - 16) / 2;
  boss.x = (WORLD_W - boss.w) / 2 + Math.sin(boss.t) * amp;
  boss.y = BOSS_Y + (stage === 3 ? Math.sin(boss.t * 1.7) * 6 : 0);
  if (boss.flash > 0) boss.flash = Math.max(0, boss.flash - dt);

  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    bossFire(g, boss);
    boss.fireTimer = [1.35, 1.1, 0.85][stage - 1];
  }
}

// ---- Alien bullets ---------------------------------------------------------
function resolveAlienBullet(g: Game, b: AlienBullet): boolean {
  if (b.x < -8 || b.x > WORLD_W + 8 || b.y > WORLD_H) return true;

  if (b.y + b.h >= GROUND_Y) {
    addExplosion(g, b.x + b.w / 2 - 3, GROUND_Y - 5, "alienBoom", 0.3);
    return true;
  }

  for (const s of g.shields) {
    const hit = findShieldImpact(s, b.x, b.y, b.w, b.h, false);
    if (hit) {
      erodeShield(g, s, hit.x, hit.y, b.kind === "orb" ? 4 : 3);
      addExplosion(g, s.x + hit.x - 3, s.y + hit.y - 2, "alienBoom", 0.25);
      return true;
    }
  }

  if (
    g.phase === "playing" &&
    overlap(b.x, b.y, b.w, b.h, g.playerX, PLAYER_Y, PLAYER_W, PLAYER_H)
  ) {
    killPlayer(g);
    return true;
  }
  return false;
}

function updateAlienBullets(g: Game, dt: number) {
  // Compact in place: no per-frame array allocation.
  const list = g.alienBullets;
  let keep = 0;
  for (let n = 0; n < list.length; n++) {
    const b = list[n];
    b.anim += dt;
    if (b.anim >= 0.1) {
      b.anim = 0;
      b.frame = b.frame === 0 ? 1 : 0;
    }
    const dist = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 2));
    let removed = false;
    for (let i = 0; i < steps && !removed; i++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      removed = resolveAlienBullet(g, b);
    }
    if (!removed) list[keep++] = b;
  }
  list.length = g.phase === "playing" ? keep : 0;
}

// ---- Main update -----------------------------------------------------------
function updatePlaying(g: Game, input: GameInput, dt: number) {
  movePlayer(g, input, dt);
  tryFire(g, input);
  updatePlayerBullet(g, dt);
  if (g.phase !== "playing") return;

  if (g.level === 1) {
    if (g.aliveCount === 0) {
      g.playerBullet = null;
      g.alienBullets = [];
      g.ufo.active = false;
      setPhase(g, "waveClear");
      emit(g, "waveClear");
      return;
    }
    stepInvaders(g, dt);
    if (g.phase !== "playing") return;
    alienFire(g, dt);
    updateUfo(g, dt);
  } else {
    updateBoss(g, dt);
  }
  updateAlienBullets(g, dt);
}

export function updateGame(g: Game, input: GameInput, dt: number) {
  g.time += dt;
  g.phaseTime += dt;

  for (let i = g.explosions.length - 1; i >= 0; i--) {
    const e = g.explosions[i];
    e.age += dt;
    if (e.age >= e.ttl) g.explosions.splice(i, 1);
  }

  switch (g.phase) {
    case "ready":
      movePlayer(g, input, dt);
      if (g.phaseTime >= READY_TIME) setPhase(g, "playing");
      break;

    case "playing":
      updatePlaying(g, input, dt);
      break;

    case "playerDying":
      if (g.phaseTime >= PLAYER_DEATH_TIME) {
        if (g.lives <= 0) {
          endRun(g, "shot");
        } else {
          g.playerX = Math.floor((WORLD_W - PLAYER_W) / 2);
          g.alienBullets = [];
          g.alienFireTimer = Math.max(g.alienFireTimer, 0.9);
          setPhase(g, "playing");
        }
      }
      break;

    case "waveClear":
      movePlayer(g, input, dt);
      if (g.phaseTime >= WAVE_CLEAR_TIME) beginBoss(g);
      break;

    case "bossIntro": {
      movePlayer(g, input, dt);
      const boss = g.boss;
      if (boss) {
        const p = clamp(g.phaseTime / 1.8, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        boss.x = (WORLD_W - boss.w) / 2;
        boss.y = -boss.h + (BOSS_Y + boss.h) * eased;
      }
      if (g.phaseTime >= BOSS_INTRO_TIME) {
        if (boss) boss.fireTimer = 1.4;
        setPhase(g, "playing");
      }
      break;
    }

    case "bossDying": {
      const boss = g.boss;
      g.fxTimer += dt;
      if (boss && g.fxTimer >= 0.09) {
        g.fxTimer = 0;
        addExplosion(
          g,
          boss.x + Math.random() * (boss.w - 13),
          boss.y + Math.random() * (boss.h - 8),
          "invaderBoom",
          0.3,
        );
      }
      if (g.phaseTime >= BOSS_DEATH_TIME) {
        addScore(g, g.lives * 500);
        endRun(g, "victory");
      }
      break;
    }

    case "gameOver":
    case "victory":
      break;
  }
}
