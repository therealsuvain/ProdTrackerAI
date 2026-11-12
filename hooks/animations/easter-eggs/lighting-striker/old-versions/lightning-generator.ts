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

/**
 * Creates one deterministic lightning tree for a given seed.
 * Coordinates are in canvas points (dp), not source-image pixels.
 */
export function generateLightningStrike(
  width: number,
  height: number,
  options: GeneratorOptions = {},
): LightningStrike {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Lightning canvas width and height must be positive finite numbers.");
  }

  const config: LightningGeneratorConfig = {
    ...LIGHTNING_STRIKER_TUNING.generator,
    ...options.config,
  };

  const seed = (options.seed ?? Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
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

  const origin: LightningPoint = { x: originX, y: -Math.max(2, height * 0.008) };
  const segments: PendingSegment[] = [];
  const mainPath: LightningPoint[] = [origin];
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
  // Main leader channel: jagged, but biased towards a randomly selected hit
  // location. The path remains connected and never teleports between points.
  // -----------------------------------------------------------------------
  const mainCount = randomInt(random, config.mainSegmentCount);
  const mainJitter = width * config.mainJitterRatio * footprintWidth;
  const mainDrift = width * config.mainDriftRatio * footprintWidth;
  let current: LightningPoint = origin;
  let smoothedOffset = 0;

  for (let index = 0; index < mainCount; index += 1) {
    const progress = (index + 1) / mainCount;
    const idealX = lerp(originX, impactX, progress);
    const randomOffset = randomBetween(random, [-mainJitter, mainJitter]);
    smoothedOffset =
      smoothedOffset * config.mainHorizontalSmoothing +
      randomOffset * (1 - config.mainHorizontalSmoothing);
    const x = clamp(
      idealX + smoothedOffset + randomBetween(random, [-mainDrift, mainDrift]),
      -width * 0.025,
      width * 1.025,
    );
    const y = impactY * progress + randomBetween(random, [-height * 0.008, height * 0.008]);
    const next: LightningPoint = { x, y };

    const segment = addSegment(
      index === 0 ? null : mainSegments[index - 1].id,
      "main",
      0,
      current,
      next,
      config.mainWidth * Math.pow(config.mainWidthTaper, index),
      index,
      1,
    );

    if (!segment) break;
    mainSegments.push(segment);
    mainPath.push(next);
    current = next;
  }

  const impact = { ...current };

  // -----------------------------------------------------------------------
  // Branches grow from their attachment point. Child branch segments receive
  // later reveal times; recursive branches inherit their parent's timing.
  // -----------------------------------------------------------------------
  const growBranch = (
    start: LightningPoint,
    initialAngle: number,
    depth: number,
    parentId: string,
    branchLengthRatio: number,
    stepCount: number,
    initialWidth: number,
    rawStart: number,
  ): void => {
    if (depth > config.maxBranchDepth || segments.length >= config.maxSegments) return;

    const branchId = `lightning-branch-${branchCounter++}`;
    const side = initialAngle < 0 ? -1 : 1;
    const totalLength = height * branchLengthRatio * footprintWidth;
    const nominalStep = totalLength / Math.max(1, stepCount);
    let point = start;
    let parentSegmentId = parentId;
    let angle = initialAngle;

    for (let index = 0; index < stepCount; index += 1) {
      if (segments.length >= config.maxSegments) return;

      angle = clamp(
        angle + randomBetween(random, [-config.branchAngleVariation, config.branchAngleVariation]),
        side < 0 ? -84 : 12,
        side < 0 ? -12 : 84,
      );

      const stepLength = nominalStep * randomBetween(random, [0.72, 1.28]);
      const next: LightningPoint = {
        x: point.x + Math.sin(degreesToRadians(angle)) * stepLength,
        y: point.y + Math.cos(degreesToRadians(angle)) * stepLength,
      };

      // Keep the generated structure inside the visible canvas. A branch that
      // reaches an edge simply terminates instead of wrapping around.
      if (
        next.x < -width * 0.02 ||
        next.x > width * 1.02 ||
        next.y > height * 1.04 ||
        next.y < -height * 0.02
      ) {
        break;
      }

      const segmentDuration = config.branchGrowthRate;
      const segment = addSegment(
        parentSegmentId,
        branchId,
        depth,
        point,
        next,
        initialWidth * Math.pow(config.branchWidthTaper, index),
        rawStart + index * segmentDuration,
        segmentDuration,
      );
      if (!segment) return;

      // A descendant starts only after its parent segment has begun to form.
      const childStart = segment.revealStartRaw + segment.revealDurationRaw;
      const childProbability = depth === 1
        ? config.secondaryBranchProbability
        : config.tertiaryBranchProbability;

      if (
        depth < config.maxBranchDepth &&
        index >= 1 &&
        index < stepCount - 1 &&
        randomChance(random, childProbability)
      ) {
        const childSide: -1 | 1 = randomChance(random, 0.5) ? -1 : 1;
        const childAngle = angle + childSide * randomBetween(random, [28, 67]);
        const childSteps = Math.max(2, Math.round(stepCount * 0.68));

        growBranch(
          next,
          childAngle,
          depth + 1,
          segment.id,
          branchLengthRatio * config.branchLengthDecay,
          childSteps,
          initialWidth * config.branchWidthMultiplier,
          childStart,
        );
      }

      parentSegmentId = segment.id;
      point = next;
    }
  };

  const attachmentCandidates = mainSegments.filter((segment, index) => {
    const position = (index + 0.5) / Math.max(1, mainSegments.length);
    return (
      position >= config.primaryBranchAttachmentRange[0] &&
      position <= config.primaryBranchAttachmentRange[1]
    );
  });

  // Shuffle candidates so attachment spacing and sides vary between strikes.
  for (let index = attachmentCandidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [attachmentCandidates[index], attachmentCandidates[swapIndex]] = [
      attachmentCandidates[swapIndex],
      attachmentCandidates[index],
    ];
  }

  const requestedPrimaryCount = randomInt(random, config.primaryBranchCount);
  const selectedAttachments = attachmentCandidates.slice(
    0,
    Math.min(requestedPrimaryCount, attachmentCandidates.length),
  );

  for (const attachment of selectedAttachments) {
    if (segments.length >= config.maxSegments) break;

    const side: -1 | 1 = randomChance(random, 0.5) ? -1 : 1;
    const angle = side * randomBetween(random, config.primaryBranchAngleRange);
    const lengthRatio = randomBetween(random, config.primaryBranchLengthRange);
    const stepCount = randomInt(random, config.primaryBranchStepCount);

    // Attach branches while the main leader is still travelling. Their
    // individual segment timings are normalized after the full tree is built.
    growBranch(
      attachment.end,
      angle,
      1,
      attachment.id,
      lengthRatio,
      stepCount,
      config.mainWidth * config.branchWidthMultiplier,
      attachment.revealStartRaw + attachment.revealDurationRaw,
    );
  }

  const maxRevealEnd = Math.max(
    1,
    ...segments.map((segment) => segment.revealStartRaw + segment.revealDurationRaw),
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
    primaryBranchCount: selectedAttachments.length,
    branchCount: branchCounter,
    maxDepth,
  };
}
