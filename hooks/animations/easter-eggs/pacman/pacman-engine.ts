// Pure Pac-Man game logic. No React / React Native imports so it can be
// unit-tested headlessly. World space is the 224 x 256 pixel arcade grid.

// ---- World & Grid constants ------------------------------------------------
export const WORLD_W = 224;
export const WORLD_H = 256;
export const TILE = 8;
export const COLS = 28;
export const ROWS = 25;
export const MAZE_Y = 24;
export const GROUND_Y = 232;
export const END_INPUT_DELAY = 1.0;

const READY_TIME = 1.8;
const PLAYER_DEATH_TIME = 1.6;
const STAGE_CLEAR_TIME = 2.2;
const EAT_FREEZE_TIME = 0.28;
const EXTRA_LIFE_SCORE = 5000;

// Cell values in g.grid
export const CELL_EMPTY = 0;
export const CELL_WALL = 1;
export const CELL_DOT = 2;
export const CELL_POWER = 3;
export const CELL_GATE = 4;
export const CELL_HOUSE = 5;

// 28 x 25 symmetric arcade maze
export const MAZE_TEMPLATE: readonly string[] = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#O####.#####.##.#####.####O#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "######.##          ##.######",
  "######.## ###==### ##.######",
  "      .   #------#   .      ",
  "######.## ######## ##.######",
  "     #.##          ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#O..##.......  .......##..O#",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

// ---- Types -----------------------------------------------------------------
export type Dir = "up" | "down" | "left" | "right" | "none";
export type GhostId = "blinky" | "pinky" | "inky" | "clyde";
export type GhostMode = "inHouse" | "exiting" | "scatter" | "chase" | "frightened" | "eaten";
export type Phase =
  | "ready"
  | "playing"
  | "eatFreeze"
  | "playerDying"
  | "stageClear"
  | "gameOver"
  | "victory";

export type GameEventName =
  | "chomp"
  | "powerPellet"
  | "eatGhost"
  | "eatFruit"
  | "playerDie"
  | "extraLife"
  | "stageClear"
  | "gameOver"
  | "victory";

export interface GameEvent {
  name: GameEventName;
  n?: number;
}

export interface GameInput {
  dir: Dir;
}

export interface Ghost {
  id: GhostId;
  x: number; // center x in maze coordinates (0..224)
  y: number; // center y in maze coordinates (0..200)
  dir: Dir;
  mode: GhostMode;
  releaseDelay: number;
  frightenedTimer: number;
  scatterX: number;
  scatterY: number;
}

export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  text: string;
  age: number;
  ttl: number;
  color: "cyan" | "green" | "white";
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

  grid: Uint8Array;
  dotsRemaining: number;
  totalDots: number;
  dotsEaten: number;
  pelletVersion: number;

  pacX: number; // center x in maze space (0..224)
  pacY: number; // center y in maze space (0..200)
  pacDir: Dir;
  queuedDir: Dir;
  mouthAngle: number;
  mouthOpening: boolean;

  ghosts: Ghost[];
  ghostCombo: number;
  waveIndex: number;
  waveTimer: number;
  globalMode: "scatter" | "chase";
  freezeTimer: number;

  fruit: { active: boolean; timer: number; spawned1: boolean; spawned2: boolean };
  popups: ScorePopup[];
  popupSeq: number;

  events: GameEvent[];
  runEnded: boolean;
  endReason: "caught" | "victory" | null;
}

// ---- Helpers ---------------------------------------------------------------
let runCounter = 0;

const DIR_VEC: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  none: { dx: 0, dy: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  none: "none",
};

const DIRS: Dir[] = ["up", "left", "down", "right"]; // Arcade tie-breaker priority

function emit(g: Game, name: GameEventName, n?: number) {
  g.events.push({ name, n });
}

function addScore(g: Game, pts: number) {
  g.score += pts;
  if (g.score > g.hi) g.hi = g.score;
  if (!g.extraLifeGiven && g.score >= EXTRA_LIFE_SCORE) {
    g.extraLifeGiven = true;
    g.lives += 1;
    emit(g, "extraLife");
  }
}

function addPopup(
  g: Game,
  x: number,
  y: number,
  text: string,
  color: "cyan" | "green" | "white" = "cyan",
) {
  g.popups.push({
    id: ++g.popupSeq,
    x,
    y,
    text,
    age: 0,
    ttl: 0.9,
    color,
  });
}

export function isEndPhase(g: Game) {
  return g.phase === "gameOver" || g.phase === "victory";
}

export function getCell(g: Game, col: number, row: number): number {
  if (row < 0 || row >= ROWS) return CELL_WALL;
  // Row 13 is the horizontal warp tunnel
  if (col < 0 || col >= COLS) {
    return row === 13 ? CELL_EMPTY : CELL_WALL;
  }
  return g.grid[row * COLS + col];
}

function canPacEnter(g: Game, col: number, row: number): boolean {
  const c = getCell(g, col, row);
  return c !== CELL_WALL && c !== CELL_GATE && c !== CELL_HOUSE;
}

function canGhostEnter(g: Game, ghost: Ghost, col: number, row: number): boolean {
  const c = getCell(g, col, row);
  if (c === CELL_WALL) return false;
  if (c === CELL_GATE || c === CELL_HOUSE) {
    return ghost.mode === "inHouse" || ghost.mode === "exiting" || ghost.mode === "eaten";
  }
  return true;
}

// ---- Construction (split in steps for the loading screen) ------------------
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
    grid: new Uint8Array(COLS * ROWS),
    dotsRemaining: 0,
    totalDots: 0,
    dotsEaten: 0,
    pelletVersion: 0,
    pacX: 14 * TILE,
    pacY: 19 * TILE + TILE / 2,
    pacDir: "left",
    queuedDir: "left",
    mouthAngle: 0.3,
    mouthOpening: true,
    ghosts: [],
    ghostCombo: 0,
    waveIndex: 0,
    waveTimer: 0,
    globalMode: "scatter",
    freezeTimer: 0,
    fruit: { active: false, timer: 0, spawned1: false, spawned2: false },
    popups: [],
    popupSeq: 0,
    events: [],
    runEnded: false,
    endReason: null,
  };
}

export function buildMaze(g: Game) {
  let dots = 0;
  for (let r = 0; r < ROWS; r++) {
    const line = MAZE_TEMPLATE[r];
    for (let c = 0; c < COLS; c++) {
      const ch = line[c];
      let val = CELL_EMPTY;
      if (ch === "#") val = CELL_WALL;
      else if (ch === ".") {
        val = CELL_DOT;
        dots++;
      } else if (ch === "O") {
        val = CELL_POWER;
        dots++;
      } else if (ch === "=") val = CELL_GATE;
      else if (ch === "-") val = CELL_HOUSE;
      g.grid[r * COLS + c] = val;
    }
  }
  g.dotsRemaining = dots;
  g.totalDots = dots;
  g.dotsEaten = 0;
  g.pelletVersion++;
  g.fruit = { active: false, timer: 0, spawned1: false, spawned2: false };
}

export function spawnActors(g: Game) {
  g.pacX = 14 * TILE;
  g.pacY = 19 * TILE + TILE / 2;
  g.pacDir = "left";
  g.queuedDir = "left";
  g.mouthAngle = 0.25;
  g.mouthOpening = true;
  g.waveIndex = 0;
  g.waveTimer = 0;
  g.globalMode = "scatter";

  const speedFactor = g.level === 1 ? 1 : 0.65;
  g.ghosts = [
    {
      id: "blinky",
      x: 14 * TILE,
      y: 11 * TILE + TILE / 2,
      dir: "left",
      mode: "scatter",
      releaseDelay: 0,
      frightenedTimer: 0,
      scatterX: (COLS - 3) * TILE,
      scatterY: 0,
    },
    {
      id: "pinky",
      x: 14 * TILE,
      y: 13 * TILE + TILE / 2,
      dir: "up",
      mode: "inHouse",
      releaseDelay: 1.2 * speedFactor,
      frightenedTimer: 0,
      scatterX: 2 * TILE,
      scatterY: 0,
    },
    {
      id: "inky",
      x: 12 * TILE + TILE / 2,
      y: 13 * TILE + TILE / 2,
      dir: "up",
      mode: "inHouse",
      releaseDelay: 3.5 * speedFactor,
      frightenedTimer: 0,
      scatterX: (COLS - 2) * TILE,
      scatterY: (ROWS - 1) * TILE,
    },
    {
      id: "clyde",
      x: 15 * TILE + TILE / 2,
      y: 13 * TILE + TILE / 2,
      dir: "up",
      mode: "inHouse",
      releaseDelay: 6.0 * speedFactor,
      frightenedTimer: 0,
      scatterX: TILE,
      scatterY: (ROWS - 1) * TILE,
    },
  ];
}

export function createReadyGame(hi: number): Game {
  const g = createGame(hi);
  buildMaze(g);
  spawnActors(g);
  return g;
}

/** Runs a throwaway simulation so JIT / allocations are warm before play. */
export function warmUpEngine(frames = 240) {
  const g = createReadyGame(0);
  g.phase = "playing";
  const dirs: Dir[] = ["left", "up", "right", "down"];
  for (let i = 0; i < frames; i++) {
    updateGame(g, { dir: dirs[Math.floor(i / 45) % 4] }, 1 / 60);
    g.events.length = 0;
  }
}

// ---- Phase & Mode Control --------------------------------------------------
function setPhase(g: Game, phase: Phase) {
  g.phase = phase;
  g.phaseTime = 0;
}

function endRun(g: Game, reason: "caught" | "victory") {
  g.runEnded = true;
  g.endReason = reason;
  g.newRecord = g.score > g.startHi;
  if (reason === "victory") {
    setPhase(g, "victory");
    emit(g, "victory");
  } else {
    setPhase(g, "gameOver");
    emit(g, "gameOver");
  }
}

// Wave schedule: Scatter 7s -> Chase 20s -> Scatter 7s -> Chase 20s -> Scatter 5s -> Chase
const WAVE_DURATIONS = [7, 20, 7, 20, 5, 9999];

function updateGlobalWaves(g: Game, dt: number) {
  // Pause wave timer if any ghost is frightened
  if (g.ghosts.some((gh) => gh.mode === "frightened")) return;
  g.waveTimer += dt;
  const dur = WAVE_DURATIONS[Math.min(g.waveIndex, WAVE_DURATIONS.length - 1)];
  if (g.waveTimer >= dur) {
    g.waveTimer = 0;
    g.waveIndex++;
    const nextMode: "scatter" | "chase" = g.waveIndex % 2 === 0 ? "scatter" : "chase";
    g.globalMode = nextMode;
    for (const gh of g.ghosts) {
      if (gh.mode === "scatter" || gh.mode === "chase") {
        gh.mode = nextMode;
        gh.dir = OPPOSITE[gh.dir];
      }
    }
  }
}

// ---- Pac-Man movement & eating ---------------------------------------------
function movePacMan(g: Game, input: GameInput, dt: number) {
  if (input.dir !== "none") {
    g.queuedDir = input.dir;
  }

  const speed = g.level === 1 ? 58 : 66;
  const col = Math.floor(g.pacX / TILE);
  const row = Math.floor(g.pacY / TILE);
  const centerX = col * TILE + TILE / 2;
  const centerY = row * TILE + TILE / 2;

  // Immediate reversal is always allowed in corridors
  if (g.queuedDir !== "none" && g.queuedDir === OPPOSITE[g.pacDir]) {
    g.pacDir = g.queuedDir;
  }

  // Turning at intersections within generous 3.2px cornering window
  if (g.queuedDir !== "none" && g.queuedDir !== g.pacDir) {
    const qv = DIR_VEC[g.queuedDir];
    const distToCenter = Math.hypot(g.pacX - centerX, g.pacY - centerY);
    if (distToCenter <= 3.2 && canPacEnter(g, col + qv.dx, row + qv.dy)) {
      g.pacX = centerX;
      g.pacY = centerY;
      g.pacDir = g.queuedDir;
    }
  }

  const v = DIR_VEC[g.pacDir];
  let nx = g.pacX + v.dx * speed * dt;
  let ny = g.pacY + v.dy * speed * dt;

  // Keep aligned on perpendicular axis
  if (v.dx !== 0) ny = centerY;
  if (v.dy !== 0) nx = centerX;

  // Horizontal tunnel wrap on Row 13
  if (row === 13 && (nx < 4 || nx >= WORLD_W - 4)) {
    if (nx < -2) nx += WORLD_W;
    else if (nx >= WORLD_W + 2) nx -= WORLD_W;
    g.pacX = nx;
    g.pacY = ny;
  } else {
    // Check wall collision ahead of center
    const nextCol = Math.floor((nx + v.dx * 3.9) / TILE);
    const nextRow = Math.floor((ny + v.dy * 3.9) / TILE);
    if (!canPacEnter(g, nextCol, nextRow)) {
      g.pacX = centerX;
      g.pacY = centerY;
    } else {
      g.pacX = nx;
      g.pacY = ny;
    }
  }

  // Animate mouth chomp when moving
  const moved = Math.hypot(g.pacX - centerX, g.pacY - centerY) > 0.05 ||
    canPacEnter(g, col + v.dx, row + v.dy);
  if (moved && g.pacDir !== "none") {
    const chompSpeed = 3.8 * dt;
    if (g.mouthOpening) {
      g.mouthAngle += chompSpeed;
      if (g.mouthAngle >= 1) {
        g.mouthAngle = 1;
        g.mouthOpening = false;
      }
    } else {
      g.mouthAngle -= chompSpeed;
      if (g.mouthAngle <= 0) {
        g.mouthAngle = 0;
        g.mouthOpening = true;
      }
    }
  }

  // Check dot / power pellet consumption
  const curCol = Math.floor(g.pacX / TILE);
  const curRow = Math.floor(g.pacY / TILE);
  if (curCol >= 0 && curCol < COLS && curRow >= 0 && curRow < ROWS) {
    const idx = curRow * COLS + curCol;
    const cell = g.grid[idx];
    if (cell === CELL_DOT || cell === CELL_POWER) {
      g.grid[idx] = CELL_EMPTY;
      g.dotsRemaining--;
      g.dotsEaten++;
      g.pelletVersion++;

      if (cell === CELL_DOT) {
        addScore(g, 10);
        emit(g, "chomp");
      } else {
        addScore(g, 50);
        g.ghostCombo = 0;
        const frightTime = g.level === 1 ? 7.0 : 4.8;
        for (const gh of g.ghosts) {
          if (gh.mode === "scatter" || gh.mode === "chase" || gh.mode === "frightened") {
            if (gh.mode !== "frightened") gh.dir = OPPOSITE[gh.dir];
            gh.mode = "frightened";
            gh.frightenedTimer = frightTime;
          }
        }
        emit(g, "powerPellet");
      }

      // Trigger bonus cherry at 50 and 120 dots eaten
      if (!g.fruit.spawned1 && g.dotsEaten >= 50) {
        g.fruit.spawned1 = true;
        g.fruit.active = true;
        g.fruit.timer = 9.5;
      } else if (!g.fruit.spawned2 && g.dotsEaten >= 120) {
        g.fruit.spawned2 = true;
        g.fruit.active = true;
        g.fruit.timer = 9.5;
      }
    }
  }

  // Check bonus fruit pickup (at center below ghost house: x=112, y=15.5*8=124)
  if (g.fruit.active) {
    const fx = 14 * TILE;
    const fy = 15 * TILE + TILE / 2;
    if (Math.hypot(g.pacX - fx, g.pacY - fy) < 8) {
      g.fruit.active = false;
      const pts = g.level === 1 ? 500 : 1000;
      addScore(g, pts);
      addPopup(g, fx, fy - 4, String(pts), "green");
      emit(g, "eatFruit", pts);
    }
  }
}

// ---- Ghost AI & Movement ---------------------------------------------------
function getGhostTarget(g: Game, gh: Ghost): { tx: number; ty: number } {
  if (gh.mode === "eaten") {
    return { tx: 14 * TILE, ty: 11 * TILE + TILE / 2 };
  }
  if (gh.mode === "scatter") {
    return { tx: gh.scatterX, ty: gh.scatterY };
  }

  const pv = DIR_VEC[g.pacDir];
  switch (gh.id) {
    case "blinky":
      // Direct chase of Pac-Man's exact position
      return { tx: g.pacX, ty: g.pacY };

    case "pinky":
      // Ambush 4 tiles ahead of Pac-Man
      return {
        tx: g.pacX + pv.dx * 4 * TILE,
        ty: g.pacY + pv.dy * 4 * TILE,
      };

    case "inky": {
      // Vector from Blinky through 2 tiles ahead of Pac-Man, doubled
      const blinky = g.ghosts[0];
      const ax = g.pacX + pv.dx * 2 * TILE;
      const ay = g.pacY + pv.dy * 2 * TILE;
      return {
        tx: blinky ? blinky.x + (ax - blinky.x) * 2 : ax,
        ty: blinky ? blinky.y + (ay - blinky.y) * 2 : ay,
      };
    }

    case "clyde": {
      // Chases when >= 6 tiles away, retreats to scatter corner when closer
      const dist = Math.hypot(gh.x - g.pacX, gh.y - g.pacY);
      if (dist > 6 * TILE) return { tx: g.pacX, ty: g.pacY };
      return { tx: gh.scatterX, ty: gh.scatterY };
    }
  }
}

function chooseGhostDir(g: Game, gh: Ghost, col: number, row: number): Dir {
  const rev = OPPOSITE[gh.dir];
  const candidates: Dir[] = [];

  for (const d of DIRS) {
    if (d === rev) continue;
    const v = DIR_VEC[d];
    if (canGhostEnter(g, gh, col + v.dx, row + v.dy)) {
      // Ghosts in normal scatter/chase shouldn't re-enter the ghost house door going down
      if (
        d === "down" &&
        (gh.mode === "scatter" || gh.mode === "chase" || gh.mode === "frightened") &&
        getCell(g, col + v.dx, row + v.dy) === CELL_GATE
      ) {
        continue;
      }
      candidates.push(d);
    }
  }

  if (candidates.length === 0) {
    const rv = DIR_VEC[rev];
    return canGhostEnter(g, gh, col + rv.dx, row + rv.dy) ? rev : "up";
  }

  if (gh.mode === "frightened") {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const { tx, ty } = getGhostTarget(g, gh);
  let best = candidates[0];
  let bestDist = Infinity;
  for (const d of candidates) {
    const v = DIR_VEC[d];
    const cx = (col + v.dx) * TILE + TILE / 2;
    const cy = (row + v.dy) * TILE + TILE / 2;
    const dist = (cx - tx) * (cx - tx) + (cy - ty) * (cy - ty);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function updateGhosts(g: Game, dt: number) {
  const baseSpeed = g.level === 1 ? 52 : 60;

  for (const gh of g.ghosts) {
    // 1) Frightened timer countdown
    if (gh.mode === "frightened") {
      gh.frightenedTimer -= dt;
      if (gh.frightenedTimer <= 0) {
        gh.frightenedTimer = 0;
        gh.mode = g.globalMode;
      }
    }

    // 2) Waiting inside the ghost house
    if (gh.mode === "inHouse") {
      gh.releaseDelay -= dt;
      // Gentle vertical bob inside house
      const homeY = 13 * TILE + TILE / 2;
      gh.y = homeY + Math.sin(g.time * 6 + (gh.id === "inky" ? 1 : 2)) * 2;
      if (gh.releaseDelay <= 0) {
        gh.mode = "exiting";
      }
      continue;
    }

    // 3) Exiting the ghost house to row 11 center
    if (gh.mode === "exiting") {
      const targetX = 14 * TILE;
      const targetY = 11 * TILE + TILE / 2;
      const exitSpeed = 38 * dt;
      if (Math.abs(gh.x - targetX) > 0.8) {
        gh.x += Math.sign(targetX - gh.x) * Math.min(exitSpeed, Math.abs(targetX - gh.x));
        gh.dir = gh.x < targetX ? "right" : "left";
      } else {
        gh.x = targetX;
        gh.dir = "up";
        gh.y -= exitSpeed;
        if (gh.y <= targetY) {
          gh.y = targetY;
          gh.mode = g.globalMode;
          gh.dir = "left";
        }
      }
      continue;
    }

    // 4) Eaten eyes returning to the ghost house
    if (gh.mode === "eaten") {
      const gateX = 14 * TILE;
      const gateY = 11 * TILE + TILE / 2;
      if (Math.hypot(gh.x - gateX, gh.y - gateY) < 4) {
        gh.x = gateX;
        gh.y = 13 * TILE + TILE / 2;
        gh.mode = "exiting";
        continue;
      }
    }

    // Determine ghost speed
    let speed = baseSpeed;
    if (gh.mode === "frightened") speed = baseSpeed * 0.58;
    else if (gh.mode === "eaten") speed = baseSpeed * 2.1;
    else if (gh.id === "blinky" && g.dotsRemaining <= 25) speed = baseSpeed * 1.1; // Cruise Elroy

    const row = Math.floor(gh.y / TILE);
    const col = Math.floor(gh.x / TILE);
    // Slow down inside the warp tunnel
    if (row === 13 && (col < 5 || col >= COLS - 5) && gh.mode !== "eaten") {
      speed *= 0.55;
    }

    const step = speed * dt;
    const centerX = col * TILE + TILE / 2;
    const centerY = row * TILE + TILE / 2;
    const v = DIR_VEC[gh.dir];

    const nx = gh.x + v.dx * step;
    const ny = gh.y + v.dy * step;

    // Did this step cross or reach the current tile's center?
    const crossedCenter =
      (v.dx > 0 && gh.x <= centerX && nx >= centerX) ||
      (v.dx < 0 && gh.x >= centerX && nx <= centerX) ||
      (v.dy > 0 && gh.y <= centerY && ny >= centerY) ||
      (v.dy < 0 && gh.y >= centerY && ny <= centerY);

    if (crossedCenter && col >= 0 && col < COLS) {
      const rem = Math.max(0, step - Math.hypot(centerX - gh.x, centerY - gh.y));
      gh.x = centerX;
      gh.y = centerY;
      gh.dir = chooseGhostDir(g, gh, col, row);
      const nv = DIR_VEC[gh.dir];
      gh.x += nv.dx * rem;
      gh.y += nv.dy * rem;
    } else {
      // Check if blocked ahead (safety fallback)
      const nextCol = Math.floor((nx + v.dx * 3.9) / TILE);
      const nextRow = Math.floor((ny + v.dy * 3.9) / TILE);
      if (col >= 0 && col < COLS && !canGhostEnter(g, gh, nextCol, nextRow)) {
        gh.x = centerX;
        gh.y = centerY;
        gh.dir = chooseGhostDir(g, gh, col, row);
      } else {
        gh.x = nx;
        gh.y = ny;
      }
    }

    // Horizontal tunnel wrap
    if (row === 13) {
      if (gh.x < -2) gh.x += WORLD_W;
      else if (gh.x >= WORLD_W + 2) gh.x -= WORLD_W;
    }
  }
}

function checkGhostCollisions(g: Game) {
  for (const gh of g.ghosts) {
    if (gh.mode === "inHouse" || gh.mode === "eaten") continue;
    const d = Math.hypot(gh.x - g.pacX, gh.y - g.pacY);
    if (d < 6.5) {
      if (gh.mode === "frightened") {
        gh.mode = "eaten";
        gh.frightenedTimer = 0;
        g.ghostCombo = Math.min(4, g.ghostCombo + 1);
        const pts = 200 * Math.pow(2, g.ghostCombo - 1);
        addScore(g, pts);
        addPopup(g, gh.x, gh.y, String(pts), "cyan");
        g.freezeTimer = EAT_FREEZE_TIME;
        setPhase(g, "eatFreeze");
        emit(g, "eatGhost", pts);
        return;
      } else {
        g.lives = Math.max(0, g.lives - 1);
        g.fruit.active = false;
        setPhase(g, "playerDying");
        emit(g, "playerDie");
        return;
      }
    }
  }
}

// ---- Main update -----------------------------------------------------------
export function updateGame(g: Game, input: GameInput, dt: number) {
  g.time += dt;
  g.phaseTime += dt;

  // Update floating score popups
  for (let i = g.popups.length - 1; i >= 0; i--) {
    const p = g.popups[i];
    p.age += dt;
    p.y -= 10 * dt;
    if (p.age >= p.ttl) g.popups.splice(i, 1);
  }

  // Update fruit timer
  if (g.fruit.active) {
    g.fruit.timer -= dt;
    if (g.fruit.timer <= 0) g.fruit.active = false;
  }

  switch (g.phase) {
    case "ready":
      if (input.dir !== "none") g.queuedDir = input.dir;
      if (g.phaseTime >= READY_TIME) setPhase(g, "playing");
      break;

    case "playing":
      updateGlobalWaves(g, dt);
      movePacMan(g, input, dt);
      if (g.dotsRemaining <= 0) {
        g.fruit.active = false;
        setPhase(g, "stageClear");
        emit(g, "stageClear");
        break;
      }
      updateGhosts(g, dt);
      checkGhostCollisions(g);
      break;

    case "eatFreeze":
      if (input.dir !== "none") g.queuedDir = input.dir;
      g.freezeTimer -= dt;
      if (g.freezeTimer <= 0) {
        setPhase(g, "playing");
      }
      break;

    case "playerDying":
      if (g.phaseTime >= PLAYER_DEATH_TIME) {
        if (g.lives <= 0) {
          endRun(g, "caught");
        } else {
          spawnActors(g);
          setPhase(g, "ready");
        }
      }
      break;

    case "stageClear":
      if (g.phaseTime >= STAGE_CLEAR_TIME) {
        if (g.level === 1) {
          g.level = 2;
          addScore(g, 1000);
          buildMaze(g);
          spawnActors(g);
          setPhase(g, "ready");
        } else {
          addScore(g, g.lives * 1000);
          endRun(g, "victory");
        }
      }
      break;

    case "gameOver":
    case "victory":
      break;
  }
}
