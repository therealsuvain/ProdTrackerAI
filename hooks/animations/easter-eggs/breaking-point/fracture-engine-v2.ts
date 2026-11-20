import { BREAKING_POINT_TUNING } from "./breaking-point-config";

export type FracturePoint = { x: number; y: number };
export type FractureKind = "primary" | "secondary" | "hairline" | "ring";

export interface FractureStroke {
  kind: FractureKind;
  points: FracturePoint[];
  intensity: number;
}

export interface FractureImpact {
  x: number;
  y: number;
  radius: number;
  /** Irregular central fracture outline, in screen coordinates. */
  centre: FracturePoint[];
  seed: number;
}

export interface FractureModel {
  width: number;
  height: number;
  seed: number;
  impacts: FractureImpact[];
  strokes: FractureStroke[];
  stage: number;
}

export interface ImpactAnchor {
  x: number;
  y: number;
}

type Random = () => number;

const TAU = Math.PI * 2;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Small deterministic PRNG. A seed reproduces the exact same fracture graph. */
function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random: Random, min: number, max: number) {
  return min + (max - min) * random();
}

function distance(a: FracturePoint, b: FracturePoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rayBoundaryDistance(
  origin: FracturePoint,
  angle: number,
  width: number,
  height: number,
) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates: number[] = [];

  if (dx > 0.0001) candidates.push((width - origin.x) / dx);
  if (dx < -0.0001) candidates.push((0 - origin.x) / dx);
  if (dy > 0.0001) candidates.push((height - origin.y) / dy);
  if (dy < -0.0001) candidates.push((0 - origin.y) / dy);

  return Math.max(0, Math.min(...candidates.filter((n) => n >= 0)));
}

function buildCentre(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
  random: Random,
): FracturePoint[] {
  const count = BREAKING_POINT_TUNING.impact.centreVertexCount;
  const irregularity = BREAKING_POINT_TUNING.impact.centreIrregularity;
  const rotation = randomBetween(random, 0, TAU);
  const points: FracturePoint[] = [];

  for (let i = 0; i < count; i++) {
    const angle = rotation + (i / count) * TAU;
    const r = radius * randomBetween(random, 0.38, 0.72) * (1 + randomBetween(random, -irregularity, irregularity));
    points.push({
      x: clamp(x + Math.cos(angle) * r, 1, width - 1),
      y: clamp(y + Math.sin(angle) * r, 1, height - 1),
    });
  }
  return points;
}

function traceCrack(
  start: FracturePoint,
  angle: number,
  desiredLength: number,
  width: number,
  height: number,
  random: Random,
  kink: number,
): FracturePoint[] {
  const actualSteps = Math.floor(
    randomBetween(random, BREAKING_POINT_TUNING.generation.pathStepsMin, BREAKING_POINT_TUNING.generation.pathStepsMax + 1),
  );
  const count = Math.min(actualSteps, BREAKING_POINT_TUNING.limits.maxPointsPerStroke - 1);
  const weights = Array.from({ length: count }, () => randomBetween(random, 0.78, 1.22));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const points: FracturePoint[] = [{ ...start }];
  let current = { ...start };
  let currentAngle = angle;

  for (let i = 0; i < count; i++) {
    // Glass fractures tend to travel in fairly straight runs, then make a
    // decisive angular change at a stress point. Avoid smooth sine-wave paths.
    if (i > 0 && random() < 0.72) {
      currentAngle += randomBetween(random, -kink, kink);
    }

    const stepLength = desiredLength * (weights[i] / weightTotal);
    const rawX = current.x + Math.cos(currentAngle) * stepLength;
    const rawY = current.y + Math.sin(currentAngle) * stepLength;
    const next = {
      x: clamp(rawX, 1, width - 1),
      y: clamp(rawY, 1, height - 1),
    };

    points.push(next);
    current = next;

    // End the path when it reaches a screen edge. Continuing after clamping
    // would draw an artificial crack running along the display boundary.
    if (rawX <= 1 || rawX >= width - 1 || rawY <= 1 || rawY >= height - 1) {
      break;
    }
  }

  return points;
}


/**
 * Creates a gently kinked fracture that terminates at the first display edge
 * intersected by its heading. The endpoint is exact; only the interior points
 * receive controlled lateral variation. This makes edge-reaching primary
 * fractures reliable without drawing ruler-straight spokes.
 */
function traceCrackToBoundary(
  start: FracturePoint,
  angle: number,
  width: number,
  height: number,
  random: Random,
): FracturePoint[] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const rayLength = rayBoundaryDistance(start, angle, width, height);
  const end = {
    x: clamp(start.x + dx * rayLength, 1, width - 1),
    y: clamp(start.y + dy * rayLength, 1, height - 1),
  };

  const steps = Math.max(
    2,
    Math.floor(randomBetween(
      random,
      BREAKING_POINT_TUNING.generation.pathStepsMin,
      BREAKING_POINT_TUNING.generation.pathStepsMax + 1,
    )),
  );
  const normalX = -dy;
  const normalY = dx;
  const maxOffset = Math.min(width, height) *
    BREAKING_POINT_TUNING.generation.stage3EdgeRayJitter * 0.72;
  const points: FracturePoint[] = [{ ...start }];

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Offset tapers to zero at both ends, preserving the exact impact and edge.
    const envelope = Math.sin(Math.PI * t);
    const offset = randomBetween(random, -maxOffset, maxOffset) * envelope;
    points.push({
      x: clamp(start.x + (end.x - start.x) * t + normalX * offset, 1, width - 1),
      y: clamp(start.y + (end.y - start.y) * t + normalY * offset, 1, height - 1),
    });
  }

  points.push(end);
  return points;
}

function polylineLength(points: FracturePoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

function getTangent(points: FracturePoint[], index: number) {
  const a = points[Math.max(0, index - 1)];
  const b = points[Math.min(points.length - 1, index + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  return { x: dx / length, y: dy / length };
}

function addBranches(
  parent: FractureStroke,
  random: Random,
  width: number,
  height: number,
  output: FractureStroke[],
  budget: { branchesRemaining: number; strokesRemaining: number },
) {
  const config = BREAKING_POINT_TUNING.generation;
  if (parent.points.length < 3) return;

  // The budget object is shared by every primary ray in this impact. The old
  // implementation reset maxBranchesPerImpact for each parent, so 50 primary
  // rays could each create 42 branches (2,100 potential branches in one tap).
  for (let i = 1; i < parent.points.length - 1; i++) {
    if (budget.branchesRemaining <= 0 || budget.strokesRemaining <= 0) break;
    if (random() > config.branchChance) continue;

    const tangent = getTangent(parent.points, i);
    const base = Math.atan2(tangent.y, tangent.x);
    const side = random() > 0.5 ? 1 : -1;
    const branchAngle = base + side * randomBetween(random, config.branchAngleMin, config.branchAngleMax);
    const parentLength = polylineLength(parent.points);
    const branchLength = parentLength * randomBetween(random, config.branchLengthMin, config.branchLengthMax);
    const points = traceCrack(
      parent.points[i],
      branchAngle,
      branchLength,
      width,
      height,
      random,
      config.pathKink * 0.75,
    );

    if (points.length < 2 || polylineLength(points) < 7) continue;
    output.push({ kind: "secondary", points, intensity: randomBetween(random, 0.48, 0.82) });
    budget.branchesRemaining--;
    budget.strokesRemaining--;

    if (random() < config.hairlineChance && points.length >= 3 && budget.strokesRemaining > 0) {
      const branchIndex = Math.max(1, Math.floor(points.length * randomBetween(random, 0.35, 0.75)));
      const branchTangent = getTangent(points, branchIndex);
      const branchBase = Math.atan2(branchTangent.y, branchTangent.x);
      const hairAngle = branchBase + (random() > 0.5 ? 1 : -1) * randomBetween(random, 0.5, 1.15);
      const hairLength = branchLength * randomBetween(random, 0.12, 0.25);
      const hairPoints = traceCrack(
        points[branchIndex],
        hairAngle,
        hairLength,
        width,
        height,
        random,
        config.pathKink * 0.55,
      );
      if (hairPoints.length >= 2) {
        output.push({ kind: "hairline", points: hairPoints, intensity: randomBetween(random, 0.25, 0.55) });
        budget.strokesRemaining--;
      }
    }
  }
}

function addImpactMicroFractures(
  impact: FractureImpact,
  random: Random,
  width: number,
  height: number,
  output: FractureStroke[],
) {
  // Dense, short, irregular fractures in the crushed region sell the impact.
  // These are local details; they do not add expensive long-distance geometry.
  const count = 15 + Math.floor(random() * 8);
  for (let i = 0; i < count; i++) {
    const angle = randomBetween(random, 0, TAU);
    const startRadius = impact.radius * randomBetween(random, 0.12, 0.42);
    const length = impact.radius * randomBetween(random, 0.42, 1.45);
    const start = {
      x: clamp(impact.x + Math.cos(angle) * startRadius, 1, width - 1),
      y: clamp(impact.y + Math.sin(angle) * startRadius, 1, height - 1),
    };
    const points = traceCrack(
      start,
      angle + randomBetween(random, -0.2, 0.2),
      length,
      width,
      height,
      random,
      BREAKING_POINT_TUNING.generation.pathKink * 1.35,
    );
    output.push({
      kind: i % 3 === 0 ? "hairline" : "secondary",
      points,
      intensity: randomBetween(random, 0.36, 0.78),
    });
  }
}

function addRings(
  impact: FractureImpact,
  random: Random,
  width: number,
  height: number,
  output: FractureStroke[],
) {
  const config = BREAKING_POINT_TUNING.generation;
  const ringCount = Math.floor(randomBetween(random, config.ringCountMin, config.ringCountMax + 1));

  for (let ring = 0; ring < ringCount; ring++) {
    const radius = impact.radius * randomBetween(random, 0.58 + ring * 0.32, 0.9 + ring * 0.48);
    const start = randomBetween(random, 0, TAU);
    const direction = random() > 0.5 ? 1 : -1;
    const sweep = randomBetween(random, config.ringSweepMin, config.ringSweepMax) * direction;
    const steps = 5 + Math.floor(random() * 4);
    const points: FracturePoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = start + sweep * t;
      const irregularRadius = radius * (1 + randomBetween(random, -0.075, 0.075));
      points.push({
        x: clamp(impact.x + Math.cos(angle) * irregularRadius, 1, width - 1),
        y: clamp(impact.y + Math.sin(angle) * irregularRadius, 1, height - 1),
      });
    }
    output.push({ kind: "ring", points, intensity: randomBetween(random, 0.3, 0.64) });
  }
}

function findNearestExistingPoint(
  anchor: FracturePoint,
  strokes: FractureStroke[],
): { point: FracturePoint; distance: number } | null {
  let nearest: { point: FracturePoint; distance: number } | null = null;
  for (const stroke of strokes) {
    if (stroke.kind === "hairline" || stroke.kind === "ring") continue;
    for (const point of stroke.points) {
      const d = distance(anchor, point);
      if (!nearest || d < nearest.distance) nearest = { point, distance: d };
    }
  }
  return nearest;
}

function addConnector(
  anchor: FracturePoint,
  existing: FractureStroke[],
  random: Random,
  width: number,
  height: number,
  output: FractureStroke[],
) {
  const config = BREAKING_POINT_TUNING.generation;
  if (!existing.length || random() > config.connectorChance) return;
  const nearest = findNearestExistingPoint(anchor, existing);
  if (!nearest || nearest.distance > Math.min(width, height) * config.connectorDistanceRatio) return;

  const dx = nearest.point.x - anchor.x;
  const dy = nearest.point.y - anchor.y;
  const baseAngle = Math.atan2(dy, dx);
  const bend = randomBetween(random, -0.18, 0.18);
  const mid = {
    x: lerp(anchor.x, nearest.point.x, 0.5) + Math.cos(baseAngle + Math.PI / 2) * nearest.distance * bend,
    y: lerp(anchor.y, nearest.point.y, 0.5) + Math.sin(baseAngle + Math.PI / 2) * nearest.distance * bend,
  };
  output.push({
    kind: "primary",
    points: [anchor, mid, nearest.point],
    intensity: randomBetween(random, 0.55, 0.85),
  });
}

function buildImpact(
  width: number,
  height: number,
  anchor: ImpactAnchor,
  seed: number,
  stage: number,
  existing: FractureStroke[],
): { impact: FractureImpact; strokes: FractureStroke[] } {
  const random = createRandom(seed);
  const config = BREAKING_POINT_TUNING.generation;
  const impactConfig = BREAKING_POINT_TUNING.impact;
  const radius = clamp(
    Math.min(width, height) * impactConfig.radiusRatio,
    impactConfig.minimumRadius,
    impactConfig.maximumRadius,
  );
  const impactX = clamp(anchor.x, 2, width - 2);
  const impactY = clamp(anchor.y, 2, height - 2);
  const impact: FractureImpact = {
    x: impactX,
    y: impactY,
    radius,
    centre: buildCentre(impactX, impactY, radius, width, height, random),
    seed,
  };
  const strokes: FractureStroke[] = [];

  addConnector({ x: impact.x, y: impact.y }, existing, random, width, height, strokes);

  const rayCount = stage === 1
    ? config.primaryRaysStage1
    : stage === 2
      ? config.primaryRaysStage2
      : config.primaryRaysStage3;
  const fullCoverage = stage >= 3;
  const primaryStrokes: FractureStroke[] = [];
  // Uneven angular gaps prevent the impact from becoming a neat radial starburst.
  const angularWeights = Array.from({ length: rayCount }, () => randomBetween(random, 0.34, 1.78));
  const angularTotal = angularWeights.reduce((sum, value) => sum + value, 0);
  let accumulatedAngle = randomBetween(random, 0, TAU);

  // Select a scattered 90% (or configured ratio) of the primary rays for
  // guaranteed edge reach. Selecting by ray index would leave one conspicuous
  // unfractured angular sector, so the chosen indices are seeded and shuffled.
  const edgeRatio = clamp(
    "primaryEdgeReachRatio" in config ? config.primaryEdgeReachRatio : 0.9,
    0,
    1,
  );
  const edgeRayCount = Math.min(rayCount, Math.ceil(rayCount * edgeRatio));
  const edgeRayIndices = new Set<number>();
  while (edgeRayIndices.size < edgeRayCount) {
    edgeRayIndices.add(Math.floor(random() * rayCount));
  }

  // Stage 3 additionally reserves cardinal coverage, independent of the
  // random seed and the chosen user impact position.
  const cardinalAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;
  if (fullCoverage) {
    for (let i = 0; i < Math.min(rayCount, config.stage3EdgeRayCount, cardinalAngles.length); i++) {
      edgeRayIndices.add(i);
    }
  }

  for (let i = 0; i < rayCount; i++) {
    const isGuaranteedEdgeRay = edgeRayIndices.has(i);
    const angle = fullCoverage && i < Math.min(config.stage3EdgeRayCount, cardinalAngles.length)
      ? cardinalAngles[i]
      : accumulatedAngle + randomBetween(random, -config.primaryAngleJitter, config.primaryAngleJitter);
    accumulatedAngle += (angularWeights[i] / angularTotal) * TAU;
    const edgeDistance = rayBoundaryDistance(impact, angle, width, height);
    const lengthRoll = random();
    const lengthRatio = fullCoverage
      ? lengthRoll < 0.34
        ? randomBetween(random, config.fullScreenLengthMin, config.fullScreenLengthMax)
        : lengthRoll < 0.80
          ? randomBetween(random, 0.52, 0.86)
          : randomBetween(random, 0.22, 0.50)
      : lengthRoll < 0.26
        ? randomBetween(random, config.primaryLengthMin, config.primaryLengthMax)
        : lengthRoll < 0.66
          ? randomBetween(random, 0.38, 0.72)
          : randomBetween(random, 0.15, 0.48);
    let desiredLength = Math.max(8, edgeDistance * lengthRatio);
    if (stage === 1) desiredLength = Math.min(desiredLength, Math.min(width, height) * 0.28);
    if (stage === 2) desiredLength = Math.min(desiredLength, Math.min(width, height) * 0.62);
    const startOffset = radius * randomBetween(random, 0.08, 0.22);
    const start = {
      x: clamp(impact.x + Math.cos(angle) * startOffset, 1, width - 1),
      y: clamp(impact.y + Math.sin(angle) * startOffset, 1, height - 1),
    };
    const pathAngle = angle + randomBetween(random, -0.06, 0.06);
    const points = isGuaranteedEdgeRay
      ? traceCrackToBoundary(start, pathAngle, width, height, random)
      : traceCrack(
          start,
          pathAngle,
          desiredLength,
          width,
          height,
          random,
          fullCoverage ? config.pathKink * 0.72 : config.pathKink,
        );
    if (points.length >= 2) {
      const stroke: FractureStroke = {
        kind: "primary",
        points,
        intensity: randomBetween(random, 0.64, 1),
      };
      primaryStrokes.push(stroke);
      strokes.push(stroke);
    }
  }

  const branchBudget = {
    branchesRemaining: config.maxBranchesPerImpact,
    // Includes secondary branches and their optional hairline offshoots.
    // The overall model cap below remains the final hard ceiling.
    strokesRemaining: Math.max(0, config.maxStrokesTotal - strokes.length),
  };
  for (const primary of primaryStrokes) {
    if (branchBudget.branchesRemaining <= 0 || branchBudget.strokesRemaining <= 0) break;
    addBranches(primary, random, width, height, strokes, branchBudget);
  }
  addImpactMicroFractures(impact, random, width, height, strokes);
  addRings(impact, random, width, height, strokes);

  return { impact, strokes };
}

/**
 * Applies the total stroke budget without dropping later-stage primary rays.
 * The previous simple `combined.slice(0, cap)` kept only the oldest strokes,
 * so a dense first/second stage could erase most or all of stage-three output.
 * Major fractures are mandatory; remaining capacity is shared by branches,
 * hairlines and rings in that visual-priority order.
 */
function capStrokesByVisualPriority(
  strokes: FractureStroke[],
  maximum: number,
): FractureStroke[] {
  if (strokes.length <= maximum) return strokes;
  const primary = strokes.filter((stroke) => stroke.kind === "primary");
  const secondary = strokes.filter((stroke) => stroke.kind === "secondary");
  const hairline = strokes.filter((stroke) => stroke.kind === "hairline");
  const rings = strokes.filter((stroke) => stroke.kind === "ring");

  const chosen = primary.slice(0, maximum);
  let remaining = maximum - chosen.length;
  if (remaining <= 0) return chosen;

  const ringReserve = Math.min(rings.length, Math.floor(maximum * 0.04));
  const hairlineReserve = Math.min(hairline.length, Math.floor(remaining * 0.20));
  const secondaryCount = Math.min(secondary.length, remaining - ringReserve - hairlineReserve);
  chosen.push(...secondary.slice(0, secondaryCount));
  remaining -= secondaryCount;

  const hairlineCount = Math.min(hairline.length, Math.max(hairlineReserve, remaining - ringReserve));
  chosen.push(...hairline.slice(0, hairlineCount));
  remaining -= hairlineCount;

  const ringCount = Math.min(rings.length, remaining);
  chosen.push(...rings.slice(0, ringCount));
  remaining -= ringCount;

  // Fill any unused capacity if one class had fewer strokes than reserved.
  if (remaining > 0) {
    const selected = new Set(chosen);
    for (const stroke of [...secondary, ...hairline, ...rings]) {
      if (remaining <= 0) break;
      if (selected.has(stroke)) continue;
      chosen.push(stroke);
      selected.add(stroke);
      remaining--;
    }
  }

  return chosen;
}

/** Creates the first deterministic fracture network. */
export function createFractureModel(
  width: number,
  height: number,
  anchor: ImpactAnchor,
  seed = BREAKING_POINT_TUNING.sequence.fixedSeed ?? Math.floor(Math.random() * 0x7fffffff),
): FractureModel {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const first = buildImpact(safeWidth, safeHeight, anchor, seed, 1, []);
  return {
    width: safeWidth,
    height: safeHeight,
    seed,
    impacts: [first.impact],
    strokes: capStrokesByVisualPriority(first.strokes, BREAKING_POINT_TUNING.generation.maxStrokesTotal),
    stage: 1,
  };
}

/** Extends the existing graph; previous impact geometry is never regenerated. */
export function extendFractureModel(
  current: FractureModel,
  anchor: ImpactAnchor,
): FractureModel {
  if (current.stage >= BREAKING_POINT_TUNING.sequence.maxImpactStages) return current;

  const nextStage = current.stage + 1;
  const nextSeed = (current.seed + Math.imul(nextStage, 0x45d9f3b)) >>> 0;
  const extension = buildImpact(
    current.width,
    current.height,
    anchor,
    nextSeed,
    nextStage,
    current.strokes,
  );

  const combined = [...current.strokes, ...extension.strokes];
  const capped = capStrokesByVisualPriority(
    combined,
    BREAKING_POINT_TUNING.generation.maxStrokesTotal,
  );

  return {
    ...current,
    impacts: [...current.impacts, extension.impact].slice(0, BREAKING_POINT_TUNING.limits.maxImpacts),
    strokes: capped,
    stage: nextStage,
  };
}
