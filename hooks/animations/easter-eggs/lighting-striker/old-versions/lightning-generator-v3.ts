import { LIGHTNING_STRIKER_TUNING } from "../lightning-config-v3";
import type { LightningGeneratorConfig } from "../lightning-config-v3";
import type {
  LightningCoverage,
  LightningPoint,
  LightningRange,
  LightningSegment,
  LightningStrike,
} from "../lightning-types-v3";

type GeneratorOptions = {
  seed?: number;
  coverage?: LightningCoverage | "random";
  config?: Partial<LightningGeneratorConfig>;
};

type PendingSegment = LightningSegment & {
  revealStartRaw: number;
  revealDurationRaw: number;
};

type BuiltBranchSegment = {
  segment: PendingSegment;
  angle: number;
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

function mixSeed(seed: number, attempt: number): number {
  // A deterministic avalanche step: retries remain reproducible for a given seed.
  let value = (seed + Math.imul(attempt, 0x9E3779B9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7FEB352D);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846CA68B);
  value ^= value >>> 16;
  return value >>> 0;
}

function scoreLightningStrike(strike: LightningStrike, height: number): number {
  const branchMap = new Map<string, LightningSegment[]>();
  for (const segment of strike.segments) {
    if (segment.depth === 0) continue;
    const group = branchMap.get(segment.branchId);
    if (group) group.push(segment);
    else branchMap.set(segment.branchId, [segment]);
  }

  const primary = [...branchMap.values()].filter((segments) => segments[0]?.depth === 1);
  const secondary = [...branchMap.values()].filter((segments) => segments[0]?.depth === 2);

  let score = 0.48;

  // Reward an adequate number of substantial primary forks.
  score += 0.15 * clamp((primary.length - 2) / 4, 0, 1);

  // Reward branches extending to both sides without requiring perfect symmetry.
  const leftCount = primary.filter((segments) =>
    segments[0].end.x < segments[0].start.x,
  ).length;
  const rightCount = primary.length - leftCount;
  if (leftCount > 0 && rightCount > 0) {
    score += 0.10;
  } else if (primary.length >= 3) {
    score -= 0.08;
  }

  // Penalize primary forks that were clipped almost immediately or are nearly straight.
  if (primary.length > 0) {
    let qualityTotal = 0;
    for (const branch of primary) {
      const totalLength = branch.reduce((sum, segment) => sum + segment.length, 0);
      const chordLength = distance(branch[0].start, branch[branch.length - 1].end);
      const straightness = totalLength > 0 ? chordLength / totalLength : 1;
      const enoughLength = clamp(totalLength / (height * 0.10), 0, 1);
      const enoughBend = clamp((1 - straightness) / 0.12, 0, 1);
      qualityTotal += enoughLength * 0.65 + enoughBend * 0.35;
    }
    score += 0.18 * (qualityTotal / primary.length);
  }

  // A little secondary branching makes the tree feel electrical; too much is not rewarded.
  const secondaryRatio = primary.length > 0 ? secondary.length / primary.length : 0;
  score += secondaryRatio >= 0.2 && secondaryRatio <= 1.25 ? 0.09 :
    secondaryRatio > 0 ? 0.04 : -0.04;

  // Penalize many short, clipped descendants.
  const shortDescendants = [...branchMap.values()].filter((segments) => {
    const depth = segments[0]?.depth ?? 0;
    if (depth < 2) return false;
    const length = segments.reduce((sum, segment) => sum + segment.length, 0);
    return length < height * 0.025;
  }).length;
  const descendants = Math.max(1, secondary.length + [...branchMap.values()].filter((s) => s[0]?.depth === 3).length);
  score -= 0.12 * (shortDescendants / descendants);

  // Penalize a nearly ruler-straight main channel, but don't demand extreme zigzags.
  if (strike.mainPath.length > 2) {
    let pathLength = 0;
    for (let index = 1; index < strike.mainPath.length; index += 1) {
      pathLength += distance(strike.mainPath[index - 1], strike.mainPath[index]);
    }
    const chord = distance(strike.mainPath[0], strike.mainPath[strike.mainPath.length - 1]);
    const sinuosity = pathLength > 0 ? pathLength / Math.max(1, chord) : 1;
    if (sinuosity < 1.025) score -= 0.07;
    if (sinuosity > 1.55) score -= 0.06;
  }

  return clamp(score, 0, 1);
}

function generateLightningStrikeCandidate(
  width: number,
  height: number,
  options: GeneratorOptions & { seed: number },
  config: LightningGeneratorConfig,
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

  const origin: LightningPoint = { x: originX, y: -Math.max(2, height * 0.008) };
  const segments: PendingSegment[] = [];
  const mainPath: LightningPoint[] = [origin];
  const mainSegments: PendingSegment[] = [];
  let maxDepth = 0;
  let branchCounter = 0;

  const addSegment = (
    parentId: string | null,
    branchId: string,
    depth: 0 | 1 | 2 | 3,
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

  // Main leader: a connected, jittered path biased toward its impact location.
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
    const next: LightningPoint = {
      x: clamp(
        idealX + smoothedOffset + randomBetween(random, [-mainDrift, mainDrift]),
        -width * 0.025,
        width * 1.025,
      ),
      y: impactY * progress + randomBetween(random, [-height * 0.008, height * 0.008]),
    };

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

  /**
   * Build a whole branch first, then choose a small number of well-spaced
   * child forks. The previous per-segment probability could spawn several
   * children from adjacent segments, producing lumpy, unrealistic clusters.
   */
  const growBranch = (
    start: LightningPoint,
    initialAngle: number,
    depth: 1 | 2 | 3,
    parentId: string,
    branchLengthRatio: number,
    stepCount: number,
    initialWidth: number,
    rawStart: number,
  ): void => {
    if (depth > config.maxBranchDepth || segments.length >= config.maxSegments) return;

    const branchId = `lightning-branch-${branchCounter++}`;
    const side: -1 | 1 = initialAngle < 0 ? -1 : 1;
    const totalLength = height * branchLengthRatio * footprintWidth;
    const nominalStep = totalLength / Math.max(1, stepCount);
    const localSegments: BuiltBranchSegment[] = [];
    let point = start;
    let parentSegmentId = parentId;
    let angle = initialAngle;
    let turnMomentum = 0;

    for (let index = 0; index < stepCount; index += 1) {
      if (segments.length >= config.maxSegments) break;

      const rawTurn = randomBetween(
        random,
        [-config.branchAngleVariation, config.branchAngleVariation],
      );
      turnMomentum =
        turnMomentum * config.branchTurnPersistence +
        rawTurn * (1 - config.branchTurnPersistence);
      angle += turnMomentum;

      // Small, occasional kinks create electrical cracks without making every
      // segment turn violently or increasing the number of segments.
      if (randomChance(random, config.branchMicroKinkChance)) {
        const kinkSign: -1 | 1 = randomChance(random, 0.5) ? -1 : 1;
        angle += kinkSign * randomBetween(random, config.branchMicroKinkAngleRange);
      }

      angle = side < 0
        ? clamp(angle, -84, -12)
        : clamp(angle, 12, 84);

      const stepLength = nominalStep * randomBetween(random, config.branchStepLengthRange);
      const next: LightningPoint = {
        x: point.x + Math.sin(degreesToRadians(angle)) * stepLength,
        y: point.y + Math.cos(degreesToRadians(angle)) * stepLength,
      };

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
      if (!segment) break;

      localSegments.push({ segment, angle });
      parentSegmentId = segment.id;
      point = next;
    }

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

    const childCount = randomChance(random, childProbability)
      ? Math.min(
        Math.floor(config.maxChildBranchesPerBranch),
        localSegments.length - 2,
      )
      : 0;

    if (childCount <= 0) return;

    // Select distinct, spaced interior attachment points. This prevents a run
    // of adjacent segments from each spawning another branch.
    const availableSplitIndexes = Array.from(
      { length: localSegments.length - 2 },
      (_, index) => index + 1,
    );
    for (let index = availableSplitIndexes.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(random, [0, index]);
      [availableSplitIndexes[index], availableSplitIndexes[swapIndex]] = [
        availableSplitIndexes[swapIndex],
        availableSplitIndexes[index],
      ];
    }

    const selectedSplitIndexes: number[] = [];
    for (const candidateIndex of availableSplitIndexes) {
      if (
        selectedSplitIndexes.every(
          (selectedIndex) => Math.abs(selectedIndex - candidateIndex) >= 2,
        )
      ) {
        selectedSplitIndexes.push(candidateIndex);
      }
      if (selectedSplitIndexes.length >= childCount) break;
    }
    selectedSplitIndexes.sort((a, b) => a - b);

    const childSteps = Math.max(
      2,
      Math.round(stepCount * config.branchStepCountDecay),
    );

    for (const splitIndex of selectedSplitIndexes) {
      const split = localSegments[splitIndex];
      const childSide: -1 | 1 = randomChance(random, 0.5) ? -1 : 1;
      const childAngle = split.angle + childSide * randomBetween(random, config.branchForkAngleRange);

      growBranch(
        split.segment.end,
        childAngle,
        (depth + 1) as 2 | 3,
        split.segment.id,
        branchLengthRatio * config.branchLengthDecay,
        childSteps,
        initialWidth * config.branchWidthMultiplier,
        split.segment.revealStartRaw + split.segment.revealDurationRaw,
      );
    }
  };

  const attachmentCandidates = mainSegments.filter((segment, index) => {
    const position = (index + 0.5) / Math.max(1, mainSegments.length);
    return (
      position >= config.primaryBranchAttachmentRange[0] &&
      position <= config.primaryBranchAttachmentRange[1]
    );
  });

  // Stratified random selection distributes primary forks along the trunk.
  // This avoids accidental clusters while retaining a different layout per seed.
  const requestedPrimaryCount = Math.min(
    randomInt(random, config.primaryBranchCount),
    attachmentCandidates.length,
  );
  const selectedAttachments: PendingSegment[] = [];
  for (let slot = 0; slot < requestedPrimaryCount; slot += 1) {
    const startIndex = Math.floor(slot * attachmentCandidates.length / requestedPrimaryCount);
    const endIndex = Math.max(
      startIndex,
      Math.floor((slot + 1) * attachmentCandidates.length / requestedPrimaryCount) - 1,
    );
    const candidateIndex = randomInt(random, [startIndex, endIndex]);
    selectedAttachments.push(attachmentCandidates[candidateIndex]);
  }

  let leftForks = 0;
  let rightForks = 0;
  for (const attachment of selectedAttachments) {
    if (segments.length >= config.maxSegments) break;

    // Slightly favour the less-used side, while keeping the result asymmetric.
    let side: -1 | 1;
    if (leftForks === rightForks) {
      side = randomChance(random, 0.5) ? -1 : 1;
    } else {
      side = randomChance(random, 0.65)
        ? (leftForks < rightForks ? -1 : 1)
        : (leftForks < rightForks ? 1 : -1);
    }
    if (side < 0) leftForks += 1;
    else rightForks += 1;

    const angle = side * randomBetween(random, config.primaryBranchAngleRange);
    const lengthRatio = randomBetween(random, config.primaryBranchLengthRange);
    const stepCount = randomInt(random, config.primaryBranchStepCount);

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

  const candidate: LightningStrike = {
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
    qualityScore: 0,
  };
  candidate.qualityScore = scoreLightningStrike(candidate, height);
  return candidate;
}

/**
 * Generates a deterministic strike. If its geometry scores poorly against
 * simple visual heuristics (clipped forks, nearly straight branches, poor
 * side distribution), a small number of alternate seeds are tried and the
 * best candidate is returned.
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
  const baseSeed = (options.seed ?? Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
  const attempts = Math.max(0, Math.floor(config.qualityRetryCount));

  let best: LightningStrike | null = null;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const candidateSeed = attempt === 0 ? baseSeed : mixSeed(baseSeed, attempt);
    const candidate = generateLightningStrikeCandidate(
      width,
      height,
      { ...options, seed: candidateSeed },
      config,
    );

    if (!best || candidate.qualityScore > best.qualityScore) {
      best = candidate;
    }
    if (candidate.qualityScore >= config.minimumQualityScore) {
      return candidate;
    }
  }

  // At least one candidate is always generated, even when quality retries are disabled.
  return best!;
}
