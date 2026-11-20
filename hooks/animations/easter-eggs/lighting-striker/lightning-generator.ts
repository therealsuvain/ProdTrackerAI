import { LIGHTNING_STRIKER_TUNING } from "./lightning-config";
import type { LightningGeneratorConfig } from "./lightning-config";
import type {
  LightningCoverage,
  LightningDepth,
  LightningPoint,
  LightningRange,
  LightningSegment,
  LightningStrike,
} from "./lightning-types";

type GeneratorOptions = {
  seed?: number;
  coverage?: LightningCoverage | "random";
  config?: Partial<Omit<LightningGeneratorConfig, "qualitySelection">> & {
    qualitySelection?: Partial<LightningGeneratorConfig["qualitySelection"]>;
  };
};

type PendingSegment = LightningSegment & {
  revealStartRaw: number;
  revealDurationRaw: number;
};

type BuiltBranchSegment = {
  segment: PendingSegment;
  angle: number;
};

type BranchCandidate = {
  segment: PendingSegment;
  kinkScore: number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random: () => number, [min, max]: LightningRange): number {
  return min + random() * (max - min);
}

function randomInt(random: () => number, [min, max]: LightningRange): number {
  return Math.floor(randomBetween(random, [min, max + 1]));
}

function randomChance(random: () => number, probability: number): boolean {
  return random() < Math.max(0, Math.min(1, probability));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: LightningPoint, b: LightningPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function mixSeed(seed: number, attempt: number): number {
  // Deterministic avalanche step: retries reproduce the same candidate sequence.
  let value = (seed + Math.imul(attempt, 0x9E3779B9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7FEB352D);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846CA68B);
  value ^= value >>> 16;
  return value >>> 0;
}

function clampGenerationCount(value: number): number {
  return Math.round(clamp(value, 1, 8));
}

/**
 * Multi-scale midpoint displacement.
 *
 * Each generation bisects every current segment and offsets its midpoint along
 * the segment normal. Large displacements are introduced first; later levels
 * add progressively smaller kinks. Downward progress is constrained so a
 * midpoint cannot jump above its parent segment's start or beyond its end.
 */
function subdivideFractalPath(
  random: () => number,
  start: LightningPoint,
  end: LightningPoint,
  generations: number,
  displacementRatio: number,
  config: LightningGeneratorConfig,
): LightningPoint[] {
  let points: LightningPoint[] = [start, end];
  const safeGenerations = clampGenerationCount(generations);

  for (let generation = 0; generation < safeGenerations; generation += 1) {
    const nextPoints: LightningPoint[] = [points[0]];
    const amplitude = displacementRatio * Math.pow(config.displacementDecay, generation);

    for (let index = 0; index < points.length - 1; index += 1) {
      const a = points[index];
      const b = points[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segmentLength = Math.max(0.001, Math.hypot(dx, dy));

      // Unit perpendicular to the current segment.
      const normalX = -dy / segmentLength;
      const normalY = dx / segmentLength;
      const maxOffset = segmentLength * config.maximumDisplacementRatio;
      const rawOffset = randomBetween(random, [-1, 1]) * segmentLength * amplitude;
      const offset = clamp(rawOffset, -maxOffset, maxOffset);

      let midpoint: LightningPoint = {
        x: (a.x + b.x) * 0.5 + normalX * offset,
        y: (a.y + b.y) * 0.5 + normalY * offset,
      };

      // For downward channels, retain a minimum amount of forward progress.
      if (b.y > a.y) {
        const forwardProgress = clamp(config.minimumForwardProgressRatio, 0.01, 0.45);
        const minY = a.y + (b.y - a.y) * forwardProgress;
        const maxY = b.y - (b.y - a.y) * forwardProgress;
        midpoint = { ...midpoint, y: clamp(midpoint.y, minY, maxY) };
      }

      nextPoints.push(midpoint, b);
    }

    points = nextPoints;
  }

  return points;
}

function turnAngleDegrees(a: LightningPoint, b: LightningPoint, c: LightningPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const first = Math.atan2(aby, abx);
  const second = Math.atan2(bcy, bcx);
  let difference = Math.abs(radiansToDegrees(second - first));
  if (difference > 180) difference = 360 - difference;
  return difference;
}

function properSegmentIntersection(
  a1: LightningPoint,
  a2: LightningPoint,
  b1: LightningPoint,
  b2: LightningPoint,
): boolean {
  // Shared endpoints are intentional branch junctions, not crossings.
  const endpointEpsilon = 0.75;
  if (
    distance(a1, b1) < endpointEpsilon ||
    distance(a1, b2) < endpointEpsilon ||
    distance(a2, b1) < endpointEpsilon ||
    distance(a2, b2) < endpointEpsilon
  ) {
    return false;
  }

  const orient = (p: LightningPoint, q: LightningPoint, r: LightningPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  const epsilon = 1e-4;
  return o1 * o2 < -epsilon && o3 * o4 < -epsilon;
}

function scoreLightningStrike(strike: LightningStrike, height: number): number {
  const byBranch = new Map<string, LightningSegment[]>();
  for (const segment of strike.segments) {
    if (segment.depth === 0) continue;
    const group = byBranch.get(segment.branchId);
    if (group) group.push(segment);
    else byBranch.set(segment.branchId, [segment]);
  }

  const branches = [...byBranch.values()];
  const primary = branches.filter((branch) => branch[0]?.depth === 1);
  const secondary = branches.filter((branch) => branch[0]?.depth === 2);
  const tertiary = branches.filter((branch) => branch[0]?.depth === 3);

  let score = 0.48;

  // Reward a useful count of primary forks without requiring perfect symmetry.
  score += 0.14 * clamp((primary.length - 2) / 4, 0, 1);
  const leftCount = primary.filter((branch) => branch[0].end.x < branch[0].start.x).length;
  const rightCount = primary.length - leftCount;
  if (leftCount > 0 && rightCount > 0) score += 0.08;
  else if (primary.length >= 3) score -= 0.07;

  // Reward substantial branches with some curvature, but don't reward tangled paths.
  if (primary.length > 0) {
    let accumulated = 0;
    for (const branch of primary) {
      const totalLength = branch.reduce((sum, segment) => sum + segment.length, 0);
      const chord = distance(branch[0].start, branch[branch.length - 1].end);
      const sinuosity = totalLength / Math.max(1, chord);
      const enoughLength = clamp(totalLength / (height * 0.095), 0, 1);
      const healthyCurvature =
        clamp((sinuosity - 1.015) / 0.20, 0, 1) *
        (1 - clamp((sinuosity - 1.65) / 0.55, 0, 1));
      accumulated += enoughLength * 0.58 + healthyCurvature * 0.42;
    }
    score += 0.16 * (accumulated / primary.length);
  }

  // A moderate amount of recursive branching is useful; excess twigs are not.
  const descendantRatio = primary.length > 0 ? (secondary.length + tertiary.length * 0.45) / primary.length : 0;
  if (descendantRatio >= 0.22 && descendantRatio <= 1.8) score += 0.10;
  else if (descendantRatio > 0) score += 0.04;
  else score -= 0.04;

  // Penalize clipped or disproportionately short descendants.
  const shortDescendants = branches.filter((branch) => {
    if ((branch[0]?.depth ?? 0) < 2) return false;
    const length = branch.reduce((sum, segment) => sum + segment.length, 0);
    return length < height * 0.022;
  }).length;
  const descendantCount = Math.max(1, secondary.length + tertiary.length);
  score -= 0.12 * (shortDescendants / descendantCount);

  // Main-channel sinuosity: avoid both a ruler-straight trunk and a tangled one.
  let mainLength = 0;
  for (let index = 1; index < strike.mainPath.length; index += 1) {
    mainLength += distance(strike.mainPath[index - 1], strike.mainPath[index]);
  }
  const mainChord = distance(strike.mainPath[0], strike.mainPath[strike.mainPath.length - 1]);
  const mainSinuosity = mainLength / Math.max(1, mainChord);
  if (mainSinuosity >= 1.025 && mainSinuosity <= 1.55) score += 0.06;
  else if (mainSinuosity < 1.01 || mainSinuosity > 1.85) score -= 0.08;

  // Penalize non-junction crossings between unrelated branches. This is a
  // quadratic check, but it runs only during optional quality selection and is
  // bounded by maxSegments (320 by default).
  let crossingCount = 0;
  const segments = strike.segments;
  for (let i = 0; i < segments.length; i += 1) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length; j += 1) {
      const b = segments[j];
      if (a.branchId === b.branchId) continue;
      if (a.parentId === b.id || b.parentId === a.id) continue;
      if (
        Math.max(a.start.x, a.end.x) < Math.min(b.start.x, b.end.x) ||
        Math.max(b.start.x, b.end.x) < Math.min(a.start.x, a.end.x) ||
        Math.max(a.start.y, a.end.y) < Math.min(b.start.y, b.end.y) ||
        Math.max(b.start.y, b.end.y) < Math.min(a.start.y, a.end.y)
      ) {
        continue;
      }
      if (properSegmentIntersection(a.start, a.end, b.start, b.end)) {
        crossingCount += 1;
        if (crossingCount >= 8) break;
      }
    }
    if (crossingCount >= 8) break;
  }
  score -= Math.min(0.24, crossingCount * 0.035);

  // A few sharp turns are characteristic; penalize paths dominated by either
  // almost-straight runs or extremely erratic reversals.
  let mainTurnTotal = 0;
  let sharpTurnCount = 0;
  for (let index = 1; index < strike.mainPath.length - 1; index += 1) {
    const turn = turnAngleDegrees(
      strike.mainPath[index - 1],
      strike.mainPath[index],
      strike.mainPath[index + 1],
    );
    mainTurnTotal += turn;
    if (turn >= 18 && turn <= 78) sharpTurnCount += 1;
  }
  const averageTurn = mainTurnTotal / Math.max(1, strike.mainPath.length - 2);
  const sharpTurnRatio = sharpTurnCount / Math.max(1, strike.mainPath.length - 2);
  if (averageTurn >= 3 && averageTurn <= 30 && sharpTurnRatio >= 0.08) score += 0.04;
  else if (averageTurn > 48) score -= 0.05;

  return clamp(score, 0, 1);
}

function generateLightningStrikeCandidate(
  width: number,
  height: number,
  options: GeneratorOptions & { seed: number },
  config: LightningGeneratorConfig,
  calculateQuality: boolean,
): LightningStrike {
  const seed = options.seed >>> 0;
  const random = mulberry32(seed);

  const coverage: LightningCoverage =
    options.coverage === "full" || options.coverage === "partial"
      ? options.coverage
      : randomChance(random, config.fullCoverageChance)
        ? "full"
        : "partial";

  const footprintWidth = randomBetween(
    random,
    coverage === "full" ? config.fullWidthRange : config.partialWidthRange,
  );
  const footprintHeight = randomBetween(
    random,
    coverage === "full" ? config.fullHeightRange : config.partialHeightRange,
  );

  const margin = width * config.edgeMarginRatio;
  const originX = randomBetween(random, config.originXRange) * width;
  const impactX = clamp(
    originX + randomBetween(random, config.impactXOffsetRange) * width * footprintWidth,
    margin,
    width - margin,
  );
  const impactY = height * footprintHeight;
  const origin: LightningPoint = {
    x: originX,
    y: -Math.max(2, height * 0.008),
  };
  const target: LightningPoint = { x: impactX, y: impactY };

  const segments: PendingSegment[] = [];
  const mainSegments: PendingSegment[] = [];
  const mainPath: LightningPoint[] = [];
  let maxDepth = 0;
  let branchCounter = 0;

  const addSegment = (
    parentId: string | null,
    branchId: string,
    depth: LightningDepth,
    start: LightningPoint,
    end: LightningPoint,
    lineWidth: number,
    revealStartRaw: number,
    revealDurationRaw: number,
  ): PendingSegment | null => {
    if (segments.length >= config.maxSegments) return null;
    const segment: PendingSegment = {
      id: `lightning-segment-${segments.length}`,
      parentId,
      branchId,
      depth,
      start,
      end,
      length: distance(start, end),
      width: Math.max(config.minimumBranchWidth, lineWidth),
      revealStart: 0,
      revealDuration: 0,
      revealStartRaw,
      revealDurationRaw,
    };
    segments.push(segment);
    maxDepth = Math.max(maxDepth, depth);
    return segment;
  };

  // -----------------------------------------------------------------------
  // 1. Fractal main leader: broad displacement first, finer kinks afterward.
  // -----------------------------------------------------------------------
  const mainPoints = subdivideFractalPath(
    random,
    origin,
    target,
    config.mainFractalGenerations,
    config.mainDisplacementRatio * footprintWidth,
    config,
  ).map((point) => ({
    x: clamp(point.x, margin * 0.5, width - margin * 0.5),
    y: point.y,
  }));
  mainPath.push(...mainPoints);

  for (let index = 0; index < mainPoints.length - 1; index += 1) {
    const start = mainPoints[index];
    const end = mainPoints[index + 1];
    const progress = index / Math.max(1, mainPoints.length - 2);
    // Linear taper keeps the trunk visually substantial all the way down.
    const widthAtSegment = config.mainWidth * (1 - progress * (1 - config.mainWidthTaper));
    const segment = addSegment(
      index === 0 ? null : mainSegments[index - 1].id,
      "main",
      0,
      start,
      end,
      widthAtSegment,
      index,
      1,
    );
    if (!segment) break;
    mainSegments.push(segment);
  }

  const impact = { ...mainPoints[mainPoints.length - 1] };

  // -----------------------------------------------------------------------
  // 2. Recursive fractal branches with outward-biased child forks.
  // -----------------------------------------------------------------------
  const growBranch = (
    start: LightningPoint,
    initialAngle: number,
    side: -1 | 1,
    depth: 1 | 2 | 3,
    parentId: string,
    branchLengthRatio: number,
    initialWidth: number,
    rawStart: number,
  ): void => {
    if (depth > config.maxBranchDepth || segments.length >= config.maxSegments) return;

    const branchId = `lightning-branch-${branchCounter++}`;
    const totalLength = height * branchLengthRatio * footprintWidth;
    const angleRadians = degreesToRadians(initialAngle);
    const rawEnd: LightningPoint = {
      x: start.x + Math.sin(angleRadians) * totalLength,
      y: start.y + Math.cos(angleRadians) * totalLength,
    };

    const generations = depth === 1
      ? config.primaryBranchFractalGenerations
      : depth === 2
        ? config.secondaryBranchFractalGenerations
        : config.tertiaryBranchFractalGenerations;

    const points = subdivideFractalPath(
      random,
      start,
      rawEnd,
      generations,
      config.branchDisplacementRatio,
      config,
    );

    const localSegments: BuiltBranchSegment[] = [];
    let parentSegmentId = parentId;
    const segmentDuration = config.branchGrowthRate;

    for (let index = 0; index < points.length - 1; index += 1) {
      if (segments.length >= config.maxSegments) break;
      const pointA = points[index];
      const pointB = points[index + 1];

      // Stop this branch at the first out-of-bounds point; don't let it re-enter.
      if (
        pointB.x < -width * 0.02 ||
        pointB.x > width * 1.02 ||
        pointB.y > height * 1.04 ||
        pointB.y < -height * 0.02
      ) {
        break;
      }

      const progress = index / Math.max(1, points.length - 2);
      const widthAtSegment = Math.max(
        config.minimumBranchWidth,
        initialWidth * Math.pow(config.branchWidthTaper, index) * (1 - progress * 0.30),
      );
      const segment = addSegment(
        parentSegmentId,
        branchId,
        depth,
        pointA,
        pointB,
        widthAtSegment,
        rawStart + index * segmentDuration,
        segmentDuration,
      );
      if (!segment) break;

      const angle = radiansToDegrees(Math.atan2(pointB.x - pointA.x, pointB.y - pointA.y));
      localSegments.push({ segment, angle });
      parentSegmentId = segment.id;
    }

    // Generate at most N spaced child forks after the parent branch is complete.
    if (
      depth >= config.maxBranchDepth ||
      localSegments.length < 3 ||
      config.maxChildBranchesPerBranch <= 0
    ) {
      return;
    }

    const childProbability = depth === 1
      ? config.secondaryBranchProbability
      : config.tertiaryBranchProbability;
    if (!randomChance(random, childProbability)) return;

    const available: number[] = Array.from(
      { length: Math.max(0, localSegments.length - 2) },
      (_, index) => index + 1,
    );
    for (let index = available.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(random, [0, index]);
      [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
    }

    const childCount = Math.min(
      Math.floor(config.maxChildBranchesPerBranch),
      available.length,
    );
    const selected: number[] = [];
    for (const candidate of available) {
      if (selected.every((chosen) => Math.abs(chosen - candidate) >= 2)) {
        selected.push(candidate);
      }
      if (selected.length >= childCount) break;
    }
    selected.sort((a, b) => a - b);

    for (const splitIndex of selected) {
      const split = localSegments[splitIndex];
      const forkOutward = randomChance(random, config.outwardForkProbability)
        ? side
        : (side === 1 ? -1 : 1);
      const childAngle = clamp(
        split.angle + forkOutward * randomBetween(random, config.branchForkAngleRange),
        side < 0 ? -82 : 8,
        side < 0 ? -8 : 82,
      );
      growBranch(
        split.segment.end,
        childAngle,
        side,
        (depth + 1) as 2 | 3,
        split.segment.id,
        branchLengthRatio * config.branchLengthDecay,
        initialWidth * config.branchWidthMultiplier,
        split.segment.revealStartRaw + split.segment.revealDurationRaw,
      );
    }
  };

  // -----------------------------------------------------------------------
  // 3. V3-style stratified attachments, biased toward actual trunk kinks.
  // -----------------------------------------------------------------------
  const eligible = mainSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ index }) => {
      const position = (index + 0.5) / Math.max(1, mainSegments.length);
      return position >= config.primaryBranchAttachmentRange[0] &&
        position <= config.primaryBranchAttachmentRange[1];
    });

  const requestedCount = Math.min(
    randomInt(random, config.primaryBranchCount),
    eligible.length,
  );
  const selectedAttachments: PendingSegment[] = [];
  for (let slot = 0; slot < requestedCount; slot += 1) {
    const slotStart = Math.floor(slot * eligible.length / requestedCount);
    const slotEnd = Math.max(
      slotStart,
      Math.floor((slot + 1) * eligible.length / requestedCount) - 1,
    );
    const slotCandidates = eligible.slice(slotStart, slotEnd + 1);
    const ranked: BranchCandidate[] = slotCandidates.map(({ segment, index }) => {
      const before = mainPath[Math.max(0, index - 1)];
      const at = mainPath[index];
      const after = mainPath[Math.min(mainPath.length - 1, index + 2)];
      const kinkScore = turnAngleDegrees(before, at, after);
      return { segment, kinkScore };
    }).sort((a, b) => b.kinkScore - a.kinkScore);

    // Pick randomly among the stronger half of this slot, rather than always
    // attaching to the single sharpest kink (which would look deterministic).
    const shortlistLength = Math.max(1, Math.ceil(ranked.length * 0.55));
    const shortlist = ranked.slice(0, shortlistLength);
    selectedAttachments.push(shortlist[randomInt(random, [0, shortlist.length - 1])].segment);
  }

  let leftForks = 0;
  let rightForks = 0;
  for (const attachment of selectedAttachments) {
    if (segments.length >= config.maxSegments) break;

    let side: -1 | 1;
    if (leftForks === rightForks) {
      side = randomChance(random, 0.5) ? -1 : 1;
    } else {
      const underrepresentedSide: -1 | 1 = leftForks < rightForks ? -1 : 1;
      side = randomChance(random, 0.65)
        ? underrepresentedSide
        : (underrepresentedSide === -1 ? 1 : -1);
    }
    if (side < 0) leftForks += 1;
    else rightForks += 1;

    const angle = side * randomBetween(random, config.primaryBranchAngleRange);
    const lengthRatio = randomBetween(random, config.primaryBranchLengthRange);
    growBranch(
      attachment.end,
      angle,
      side,
      1,
      attachment.id,
      lengthRatio,
      attachment.width * config.branchWidthMultiplier,
      attachment.revealStartRaw + attachment.revealDurationRaw,
    );
  }

  let maxRevealEnd = 1;
  for (const segment of segments) {
    maxRevealEnd = Math.max(
      maxRevealEnd,
      segment.revealStartRaw + segment.revealDurationRaw,
    );
  }

  const finalizedSegments: LightningSegment[] = segments.map((segment) => ({
    id: segment.id,
    parentId: segment.parentId,
    branchId: segment.branchId,
    depth: segment.depth,
    start: segment.start,
    end: segment.end,
    length: segment.length,
    width: segment.width,
    revealStart: clamp(segment.revealStartRaw / maxRevealEnd, 0, 1),
    revealDuration: Math.max(0.0001, segment.revealDurationRaw / maxRevealEnd),
  }));

  const strike: LightningStrike = {
    seed,
    width,
    height,
    coverage,
    origin,
    impact,
    segments: finalizedSegments,
    mainPath,
    primaryBranchCount: selectedAttachments.length,
    branchCount: branchCounter,
    maxDepth,
    qualityScore: -1,
    qualityScored: false,
    qualityAttempts: 1,
  };

  if (calculateQuality) {
    strike.qualityScore = scoreLightningStrike(strike, height);
    strike.qualityScored = true;
  }

  return strike;
}

/**
 * Generates one deterministic lightning strike.
 *
 * When qualitySelection.enabled is false, exactly one candidate is generated
 * and the scorer is never called. When enabled, retries use deterministic
 * derived seeds and the best candidate is retained if no candidate reaches
 * minimumScore.
 */
export function generateLightningStrike(
  width: number,
  height: number,
  options: GeneratorOptions = {},
): LightningStrike {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Lightning canvas width and height must be positive finite numbers.");
  }

  const defaults = LIGHTNING_STRIKER_TUNING.generator;
  const config: LightningGeneratorConfig = {
    ...defaults,
    ...options.config,
    qualitySelection: {
      ...defaults.qualitySelection,
      ...options.config?.qualitySelection,
    },
  };
  // The geometry type and renderer intentionally support depths 0–3 only.
  config.maxBranchDepth = clamp(Math.floor(config.maxBranchDepth), 1, 3);
  config.maxChildBranchesPerBranch = Math.max(
    0,
    Math.floor(config.maxChildBranchesPerBranch),
  );
  config.maxSegments = Math.max(1, Math.floor(config.maxSegments));

  const baseSeed = (options.seed ?? Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;

  // Performance-test mode: no retry loop, no geometry scoring, one candidate.
  if (!config.qualitySelection.enabled) {
    return generateLightningStrikeCandidate(
      width,
      height,
      { ...options, seed: baseSeed },
      config,
      false,
    );
  }

  const retries = Math.max(0, Math.floor(config.qualitySelection.maxRetries));
  const maxAttempts = retries + 1;
  let best: LightningStrike | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateSeed = attempt === 0 ? baseSeed : mixSeed(baseSeed, attempt);
    const candidate = generateLightningStrikeCandidate(
      width,
      height,
      { ...options, seed: candidateSeed },
      config,
      true,
    );
    candidate.qualityAttempts = attempt + 1;

    if (!best || candidate.qualityScore > best.qualityScore) {
      best = candidate;
    }
    if (candidate.qualityScore >= config.qualitySelection.minimumScore) {
      return candidate;
    }
  }

  return best!;
}
