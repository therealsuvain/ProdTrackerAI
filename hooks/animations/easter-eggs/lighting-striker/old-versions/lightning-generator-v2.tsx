import { LIGHTNING_STRIKER_TUNING } from "./lightning-config";
import type {
  LightningPoint,
  LightningRange,
  LightningSegment,
  LightningStrike,
  LightningCoverage,
} from "./lightning-types";
import type { LightningGeneratorConfig } from "./lightning-config";

type GeneratorOptions = {
  seed?: number;
  coverage?: LightningCoverage | "random";
  config?: Partial<LightningGeneratorConfig>;
};

type PendingSegment = LightningSegment & {
  revealStartRaw: number;
  revealDurationRaw: number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(
  random: () => number,
  [min, max]: LightningRange,
): number {
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

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Fractal midpoint displacement between two points.
 * Creates large macro-kinks first, then fine high-frequency jagged teeth.
 */
function subdivideFractalPath(
  random: () => number,
  start: LightningPoint,
  end: LightningPoint,
  generations: number,
  swayRatio: number,
): LightningPoint[] {
  let points: LightningPoint[] = [start, end];

  for (let gen = 0; gen < generations; gen += 1) {
    const nextPoints: LightningPoint[] = [points[0]];
    const scale = swayRatio * Math.pow(0.54, gen);

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);

      // Perpendicular normal (mostly horizontal for downward bolts)
      const nx = -dy / Math.max(0.001, segLen);
      const ny = dx / Math.max(0.001, segLen);

      const offset = randomBetween(random, [-1, 1]) * segLen * scale;
      // Slight forward bias so lightning never loops upward
      const midX = (a.x + b.x) * 0.5 + nx * offset;
      const midY = (a.y + b.y) * 0.5 + ny * offset * 0.25;

      nextPoints.push({ x: midX, y: Math.max(a.y + 0.5, midY) }, b);
    }
    points = nextPoints;
  }

  return points;
}

export function generateLightningStrike(
  width: number,
  height: number,
  options: GeneratorOptions = {},
): LightningStrike {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      "Lightning canvas width and height must be positive finite numbers.",
    );
  }

  const config: LightningGeneratorConfig = {
    ...LIGHTNING_STRIKER_TUNING.generator,
    ...options.config,
  };

  const seed = (options.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
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
    originX +
      randomBetween(random, config.impactXOffsetRange) * width * footprintWidth,
    margin,
    width - margin,
  );
  const impactY = height * footprintHeight;

  const origin: LightningPoint = {
    x: originX,
    y: -Math.max(2, height * 0.008),
  };
  const targetImpact: LightningPoint = { x: impactX, y: impactY };

  const segments: PendingSegment[] = [];
  const mainSegments: PendingSegment[] = [];
  let maxDepth = 0;
  let branchCounter = 0;

  const addSegment = (
    parentId: string | null,
    branchId: string,
    depth: number,
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
  // 1. Fractal Main Leader Channel (6 generations = 64 micro-segments)
  // -----------------------------------------------------------------------
  const mainPath = subdivideFractalPath(
    random,
    origin,
    targetImpact,
    6,
    0.34 * footprintWidth,
  ).map((pt) => ({
    x: clamp(pt.x, margin * 0.5, width - margin * 0.5),
    y: pt.y,
  }));

  for (let i = 0; i < mainPath.length - 1; i += 1) {
    const start = mainPath[i];
    const end = mainPath[i + 1];
    const progress = i / Math.max(1, mainPath.length - 1);
    // Gentle trunk taper (stays 85–100% thick all the way down)
    const trunkWidth =
      config.mainWidth * (1 - progress * (1 - config.mainWidthTaper));

    const segment = addSegment(
      i === 0 ? null : mainSegments[i - 1].id,
      "main",
      0,
      start,
      end,
      trunkWidth,
      i,
      1,
    );
    if (!segment) break;
    mainSegments.push(segment);
  }

  const impact = { ...mainPath[mainPath.length - 1] };

  // -----------------------------------------------------------------------
  // 2. Fractal Outward-Only Branching
  // -----------------------------------------------------------------------
  const growBranch = (
    start: LightningPoint,
    initialAngleDeg: number,
    side: -1 | 1,
    depth: number,
    parentId: string,
    branchLengthRatio: number,
    stepCount: number,
    initialWidth: number,
    rawStart: number,
  ): void => {
    if (depth > config.maxBranchDepth || segments.length >= config.maxSegments)
      return;

    const branchId = `lightning-branch-${branchCounter++}`;
    const totalLength =
      height * branchLengthRatio * (0.7 + footprintWidth * 0.3);

    // Compute overall branch endpoint, then fractal-subdivide it so it has
    // natural micro-chatter instead of ruler-straight needles!
    const rad = degreesToRadians(initialAngleDeg);
    const rawEnd: LightningPoint = {
      x: start.x + Math.sin(rad) * totalLength,
      y: start.y + Math.cos(rad) * totalLength,
    };

    const generations = depth === 1 ? 4 : 3; // 16 steps for primary, 8 for sub-branches
    const branchPoints = subdivideFractalPath(
      random,
      start,
      rawEnd,
      generations,
      0.28,
    );

    let parentSegmentId = parentId;
    const stepDuration = config.branchGrowthRate;

    for (let i = 0; i < branchPoints.length - 1; i += 1) {
      if (segments.length >= config.maxSegments) return;

      const pA = branchPoints[i];
      const pB = branchPoints[i + 1];

      // Terminate if branch leaves canvas bounds
      if (
        pB.x < -width * 0.02 ||
        pB.x > width * 1.02 ||
        pB.y > height * 1.04 ||
        pB.y < -height * 0.02
      ) {
        break;
      }

      const progress = i / Math.max(1, branchPoints.length - 1);
      // Smoothly taper branch width down toward minimumBranchWidth at the tip
      const currentWidth = Math.max(
        config.minimumBranchWidth,
        initialWidth *
          Math.pow(config.branchWidthTaper, i) *
          (1 - progress * 0.45),
      );

      const segment = addSegment(
        parentSegmentId,
        branchId,
        depth,
        pA,
        pB,
        currentWidth,
        rawStart + i * stepDuration,
        stepDuration,
      );
      if (!segment) return;

      // Spawn secondary/tertiary forks that stay biased outward on the SAME side
      const childProbability =
        depth === 1
          ? config.secondaryBranchProbability * 0.45
          : config.tertiaryBranchProbability * 0.4;

      if (
        depth < config.maxBranchDepth &&
        i >= 2 &&
        i < branchPoints.length - 3 &&
        randomChance(random, childProbability)
      ) {
        // 80% chance to fork further outward on the same side, 20% slight inner splay
        const forkOutward = randomChance(random, 0.8)
          ? side
          : (-side as -1 | 1);
        const childAngle = clamp(
          initialAngleDeg + forkOutward * randomBetween(random, [16, 36]),
          side < 0 ? -78 : 10,
          side < 0 ? -10 : 78,
        );

        growBranch(
          pB,
          childAngle,
          side,
          depth + 1,
          segment.id,
          branchLengthRatio * config.branchLengthDecay,
          Math.max(4, Math.round(stepCount * 0.6)),
          currentWidth * config.branchWidthMultiplier,
          segment.revealStartRaw + segment.revealDurationRaw,
        );
      }

      parentSegmentId = segment.id;
    }
  };

  // Find sharp "kink" vertices on the main trunk so branches fork naturally at bends
  const candidateIndices: Array<{
    idx: number;
    kinkScore: number;
    bendSide: -1 | 1;
  }> = [];
  for (let i = 3; i < mainSegments.length - 4; i += 1) {
    const pos = i / mainSegments.length;
    if (
      pos < config.primaryBranchAttachmentRange[0] ||
      pos > config.primaryBranchAttachmentRange[1]
    ) {
      continue;
    }
    const prev = mainSegments[i - 1];
    const curr = mainSegments[i + 1];
    const dx1 = prev.end.x - prev.start.x;
    const dx2 = curr.end.x - curr.start.x;
    const kinkScore = Math.abs(dx1 - dx2);
    const bendSide: -1 | 1 = dx1 >= dx2 ? 1 : -1;
    candidateIndices.push({ idx: i, kinkScore, bendSide });
  }

  // Sort by sharpest kinks, but enforce minimum spacing so branches don't clump
  candidateIndices.sort((a, b) => b.kinkScore - a.kinkScore);

  const requestedPrimaryCount = randomInt(random, config.primaryBranchCount);
  const chosenAttachments: typeof candidateIndices = [];
  const minIndexGap = Math.max(3, Math.floor(mainSegments.length / 10));

  for (const cand of candidateIndices) {
    if (chosenAttachments.length >= requestedPrimaryCount) break;
    const tooClose = chosenAttachments.some(
      (existing) => Math.abs(existing.idx - cand.idx) < minIndexGap,
    );
    if (!tooClose) {
      chosenAttachments.push(cand);
    }
  }

  for (let i = 0; i < chosenAttachments.length; i += 1) {
    if (segments.length >= config.maxSegments) break;

    const { idx, bendSide } = chosenAttachments[i];
    const attachment = mainSegments[idx];
    // Alternate/use outer bend side so left and right stay balanced
    const side: -1 | 1 = i % 2 === 0 ? bendSide : (-bendSide as -1 | 1);
    const angle = side * randomBetween(random, config.primaryBranchAngleRange);

    // Upper branches are longer, lower branches near ground are shorter
    const heightProgress = idx / mainSegments.length;
    const lengthRatio =
      randomBetween(random, config.primaryBranchLengthRange) *
      (1.15 - heightProgress * 0.45);
    const stepCount = randomInt(random, config.primaryBranchStepCount);

    growBranch(
      attachment.end,
      angle,
      side,
      1,
      attachment.id,
      lengthRatio,
      stepCount,
      attachment.width * config.branchWidthMultiplier,
      attachment.revealStartRaw + attachment.revealDurationRaw,
    );
  }

  const maxRevealEnd = Math.max(
    1,
    ...segments.map(
      (segment) => segment.revealStartRaw + segment.revealDurationRaw,
    ),
  );

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

  return {
    seed,
    width,
    height,
    coverage,
    origin,
    impact,
    segments: finalizedSegments,
    mainPath,
    primaryBranchCount: chosenAttachments.length,
    branchCount: branchCounter,
    maxDepth,
  };
}
