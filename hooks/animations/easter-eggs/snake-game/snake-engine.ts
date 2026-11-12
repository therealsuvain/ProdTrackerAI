// Classic Snake engine: one empty, boundless level (the edges wrap around).
// Pure TypeScript, no React / RN imports, so it is trivial to unit test.

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export type Phase = "ready" | "playing" | "paused" | "over" | "won";
export type GameEventName =
  | "start"
  | "eat"
  | "bonusSpawn"
  | "bonusEat"
  | "bonusExpire"
  | "die"
  | "win";

export interface Bonus {
  x: number; // top-left of the 2x2 footprint
  y: number;
  ttl: number; // seconds left
}

export interface Game {
  cols: number;
  rows: number;
  body: number[]; // cell indices (y * cols + x), tail first, head last
  occ: Uint8Array;
  dir: Dir;
  queue: Dir[];
  food: number;
  bonus: Bonus | null;
  grow: number;
  score: number;
  hi: number;
  eaten: number;
  phase: Phase;
  time: number;
  phaseTime: number;
  acc: number;
  stepSec: number;
  dirty: boolean;
  blinkQ: number;
  events: { name: GameEventName; n?: number }[];
  runId: number;
  runEnded: boolean;
}

export const START_LEN = 4;
export const FOOD_POINTS = 5;
export const BONUS_EVERY = 5;
export const BONUS_TIME = 15;
export const END_INPUT_DELAY = 0.9;
const STEP_START = 0.14;
const STEP_MIN = 0.065;
const STEP_PER_FOOD = 0.0035;

let runCounter = 0;

const emit = (g: Game, name: GameEventName, n?: number) =>
  g.events.push({ name, n });

export function createGame(cols: number, rows: number, hi = 0): Game {
  const occ = new Uint8Array(cols * rows);
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const body: number[] = [];
  for (let i = 0; i < START_LEN; i++) {
    const x = cx - (START_LEN - 1) + i;
    const idx = cy * cols + ((x % cols) + cols) % cols;
    body.push(idx);
    occ[idx] = 1;
  }
  const g: Game = {
    cols,
    rows,
    body,
    occ,
    dir: 1,
    queue: [],
    food: -1,
    bonus: null,
    grow: 0,
    score: 0,
    hi,
    eaten: 0,
    phase: "ready",
    time: 0,
    phaseTime: 0,
    acc: 0,
    stepSec: STEP_START,
    dirty: true,
    blinkQ: 0,
    events: [],
    runId: ++runCounter,
    runEnded: false,
  };
  spawnFood(g);
  return g;
}

/** Fresh game on the same maze, keeping the best score. */
export function restartGame(prev: Game): Game {
  return createGame(prev.cols, prev.rows, Math.max(prev.hi, prev.score));
}

export const isEndPhase = (g: Game) => g.phase === "over" || g.phase === "won";

function inBonus(b: Bonus | null, x: number, y: number) {
  return !!b && x >= b.x && x <= b.x + 1 && y >= b.y && y <= b.y + 1;
}

function isFree(g: Game, x: number, y: number) {
  return !g.occ[y * g.cols + x] && g.food !== y * g.cols + x && !inBonus(g.bonus, x, y);
}

function spawnFood(g: Game) {
  const { cols, rows } = g;
  for (let t = 0; t < 40; t++) {
    const x = (Math.random() * cols) | 0;
    const y = (Math.random() * rows) | 0;
    if (!g.occ[y * cols + x] && !inBonus(g.bonus, x, y)) {
      g.food = y * cols + x;
      return;
    }
  }
  const free: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!g.occ[y * cols + x] && !inBonus(g.bonus, x, y)) free.push(y * cols + x);
    }
  }
  if (free.length === 0) {
    g.food = -1;
    g.phase = "won";
    g.phaseTime = 0;
    g.runEnded = true;
    emit(g, "win");
    return;
  }
  g.food = free[(Math.random() * free.length) | 0];
}

function spawnBonus(g: Game) {
  const { cols, rows } = g;
  if (cols < 2 || rows < 2) return;
  for (let t = 0; t < 60; t++) {
    const x = (Math.random() * (cols - 1)) | 0;
    const y = (Math.random() * (rows - 1)) | 0;
    if (
      isFree(g, x, y) &&
      isFree(g, x + 1, y) &&
      isFree(g, x, y + 1) &&
      isFree(g, x + 1, y + 1)
    ) {
      g.bonus = { x, y, ttl: BONUS_TIME };
      emit(g, "bonusSpawn");
      return;
    }
  }
}

/** Queue a turn. The first input of a "ready" game also starts it. */
export function setDirection(g: Game, d: Dir) {
  if (g.phase === "ready") {
    g.phase = "playing";
    g.phaseTime = 0;
    g.dirty = true;
    emit(g, "start");
    // Can't reverse into the body on the very first move.
    if (d === 3) return;
  }
  if (g.phase !== "playing") return;
  const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
  if (d === last || d === (((last + 2) % 4) as Dir)) return;
  if (g.queue.length < 2) g.queue.push(d);
}

export function togglePause(g: Game) {
  if (g.phase === "ready") {
    g.phase = "playing";
    g.phaseTime = 0;
    emit(g, "start");
  } else if (g.phase === "playing") {
    g.phase = "paused";
  } else if (g.phase === "paused") {
    g.phase = "playing";
  }
  g.dirty = true;
}

function die(g: Game) {
  g.phase = "over";
  g.phaseTime = 0;
  g.runEnded = true;
  g.dirty = true;
  emit(g, "die");
}

function tick(g: Game) {
  const { cols, rows } = g;
  const nd = g.queue.length ? (g.queue.shift() as Dir) : g.dir;
  g.dir = nd;

  const head = g.body[g.body.length - 1];
  const hx = head % cols;
  const hy = (head / cols) | 0;
  // Boundless maze: leaving one edge re-enters from the opposite one.
  const nx = (hx + DX[nd] + cols) % cols;
  const ny = (hy + DY[nd] + rows) % rows;
  const ni = ny * cols + nx;

  const ateFood = ni === g.food;
  const ateBonus = inBonus(g.bonus, nx, ny);
  const willGrow = g.grow > 0 || ateFood || ateBonus;

  // Free the tail first so the head may legally step into the cell it leaves.
  let removed = -1;
  if (!willGrow) {
    removed = g.body.shift() as number;
    g.occ[removed] = 0;
  }
  if (g.occ[ni]) {
    if (removed >= 0) {
      g.body.unshift(removed);
      g.occ[removed] = 1;
    }
    die(g);
    return;
  }
  g.body.push(ni);
  g.occ[ni] = 1;
  if (g.grow > 0 && !ateFood && !ateBonus) g.grow--;
  g.dirty = true;

  if (ateFood) {
    g.score += FOOD_POINTS;
    g.eaten++;
    emit(g, "eat", FOOD_POINTS);
    g.stepSec = Math.max(STEP_MIN, STEP_START - g.eaten * STEP_PER_FOOD);
    spawnFood(g);
    if (g.eaten % BONUS_EVERY === 0 && !g.bonus && g.phase === "playing") {
      spawnBonus(g);
    }
  }
  if (ateBonus && g.bonus) {
    const pts = Math.max(5, Math.ceil(g.bonus.ttl) * 3);
    g.score += pts;
    g.grow += 2;
    g.bonus = null;
    emit(g, "bonusEat", pts);
  }
}

export function updateGame(g: Game, dt: number) {
  g.time += dt;
  g.phaseTime += dt;

  if (isEndPhase(g)) {
    if (g.phaseTime < 1.4) g.dirty = true; // death blink
    return;
  }
  if (g.phase !== "playing") return;

  const q = Math.floor(g.time * 4);
  const quarter = q !== g.blinkQ;
  g.blinkQ = q;

  if (g.bonus) {
    const before = Math.ceil(g.bonus.ttl);
    g.bonus.ttl -= dt;
    if (g.bonus.ttl <= 0) {
      g.bonus = null;
      emit(g, "bonusExpire");
      g.dirty = true;
    } else if (Math.ceil(g.bonus.ttl) !== before || (quarter && g.bonus.ttl < 4)) {
      g.dirty = true;
    }
  }

  g.acc += dt;
  let guard = 0;
  while (g.acc >= g.stepSec && g.phase === "playing" && guard++ < 4) {
    g.acc -= g.stepSec;
    tick(g);
  }
  if (g.acc > g.stepSec) g.acc = 0;
}

/** True when the cell `ahead` steps in front of the head holds the food. */
export function foodAhead(g: Game, ahead = 2): boolean {
  const head = g.body[g.body.length - 1];
  let x = head % g.cols;
  let y = (head / g.cols) | 0;
  const d = g.queue.length ? g.queue[0] : g.dir;
  for (let i = 0; i < ahead; i++) {
    x = (x + DX[d] + g.cols) % g.cols;
    y = (y + DY[d] + g.rows) % g.rows;
    const idx = y * g.cols + x;
    if (idx === g.food || inBonus(g.bonus, x, y)) return true;
  }
  return false;
}

/** Runs a throw-away game so the JIT / allocations are warm before play. */
export function warmUpEngine() {
  const g = createGame(20, 28, 0);
  setDirection(g, 0);
  for (let i = 0; i < 120; i++) {
    if (i % 17 === 0) setDirection(g, ((i / 17) % 4) as Dir);
    updateGame(g, 1 / 30);
    foodAhead(g);
    g.events.length = 0;
    if (isEndPhase(g)) break;
  }
}
