import {
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkPaint,
  type SkPicture,
} from "@shopify/react-native-skia";

import { BREAKING_POINT_TUNING } from "./breaking-point-config";
import type {
  FractureKind,
  FractureModel,
  FracturePoint,
  FractureStroke,
} from "./fracture-engine";

type RecordingCanvas = ReturnType<ReturnType<typeof Skia.PictureRecorder>["beginRecording"]>;


function makePaint(
  color: string,
  opacity: number,
  width: number,
  style: PaintStyle,
): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(Math.max(0, Math.min(1, opacity)));
  paint.setStyle(style);
  if (style === PaintStyle.Stroke) {
    paint.setStrokeWidth(Math.max(0.1, width));
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
  }
  return paint;
}

function strokeWidth(kind: FractureKind) {
  const appearance = BREAKING_POINT_TUNING.appearance;
  switch (kind) {
    case "primary": return appearance.primaryWidth;
    case "secondary": return appearance.secondaryWidth;
    case "hairline": return appearance.hairlineWidth;
    case "ring": return appearance.ringWidth;
  }
}

function highlightOpacity(kind: FractureKind) {
  const appearance = BREAKING_POINT_TUNING.appearance;
  switch (kind) {
    case "primary": return appearance.primaryHighlightOpacity;
    case "secondary": return appearance.secondaryHighlightOpacity;
    case "hairline": return appearance.hairlineHighlightOpacity;
    case "ring": return appearance.ringHighlightOpacity;
  }
}

function shiftPolyline(points: FracturePoint[], offset: number): FracturePoint[] {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    return {
      x: point.x + normalX * offset,
      y: point.y + normalY * offset,
    };
  });
}

type SkPath = NonNullable<ReturnType<typeof Skia.Path.MakeFromSVGString>>;

type PathBatch = {
  kind: FractureKind;
  strength: 0 | 1 | 2;
  path: SkPath;
  offsetPath: SkPath;
};

function strengthBucket(intensity: number): 0 | 1 | 2 {
  if (intensity < 0.48) return 0;
  if (intensity < 0.74) return 1;
  return 2;
}

function polylineToSvg(points: FracturePoint[]) {
  if (points.length < 2) return "";
  return `M ${points[0].x} ${points[0].y} ` +
    points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(" ");
}

function buildPathBatches(strokes: FractureStroke[]) {
  const groups = new Map<string, {
    kind: FractureKind;
    strength: 0 | 1 | 2;
    paths: string[];
    offsetPaths: string[];
  }>();

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    const strength = strengthBucket(stroke.intensity);
    const key = `${stroke.kind}:${strength}`;
    let group = groups.get(key);
    if (!group) {
      group = { kind: stroke.kind, strength, paths: [], offsetPaths: [] };
      groups.set(key, group);
    }
    group.paths.push(polylineToSvg(stroke.points));
    group.offsetPaths.push(polylineToSvg(
      shiftPolyline(stroke.points, BREAKING_POINT_TUNING.appearance.highlightOffset),
    ));
  }

  const batches: PathBatch[] = [];
  for (const group of groups.values()) {
    const path = Skia.Path.MakeFromSVGString(group.paths.join(" "));
    const offsetPath = Skia.Path.MakeFromSVGString(group.offsetPaths.join(" "));
    if (!path || !offsetPath) continue;
    batches.push({ kind: group.kind, strength: group.strength, path, offsetPath });
  }
  return batches;
}

function drawFracturePass(
  canvas: RecordingCanvas,
  batches: PathBatch[],
  pass: "edge" | "seam" | "specular" | "glint",
) {
  const appearance = BREAKING_POINT_TUNING.appearance;
  const strengthAlpha = [0.52, 0.78, 1] as const;

  for (const batch of batches) {
    const baseWidth = strokeWidth(batch.kind) * (0.92 + batch.strength * 0.04);
    const alpha = strengthAlpha[batch.strength];
    const highlight = highlightOpacity(batch.kind) * alpha;

    if (pass === "edge") {
      canvas.drawPath(
        batch.path,
        makePaint(appearance.edgeColor, appearance.edgeOpacity * alpha, baseWidth * 2.65, PaintStyle.Stroke),
      );
    } else if (pass === "seam") {
      canvas.drawPath(
        batch.path,
        makePaint(appearance.seamColor, appearance.seamOpacity * alpha, baseWidth * 1.42, PaintStyle.Stroke),
      );
    } else if (pass === "specular") {
      canvas.drawPath(
        batch.path,
        makePaint(appearance.highlightColor, highlight, baseWidth * 0.43, PaintStyle.Stroke),
      );
    } else {
      canvas.drawPath(
        batch.offsetPath,
        makePaint("#FFFFFF", highlight * 0.62, baseWidth * 0.19, PaintStyle.Stroke),
      );
    }
  }
}

function drawImpactCentres(canvas: RecordingCanvas, model: FractureModel) {
  const appearance = BREAKING_POINT_TUNING.appearance;

  for (const impact of model.impacts) {
    const centrePathData = impact.centre.length > 0
      ? `${polylineToSvg(impact.centre)} Z`
      : "";
    const centrePath = Skia.Path.MakeFromSVGString(centrePathData);
    if (!centrePath) continue;

    // A subdued fractured core, not a filled white dot.
    canvas.drawPath(
      centrePath,
      makePaint(appearance.impactCoreColor, appearance.impactCoreOpacity, 0, PaintStyle.Fill),
    );
    canvas.drawPath(
      centrePath,
      makePaint(appearance.highlightColor, appearance.impactGlintOpacity, 0.66, PaintStyle.Stroke),
    );

    // A handful of tiny deterministic glints around each impact centre.
    // They are deliberately sparse and do not create extra animated objects.
    let state = impact.seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const glintPaint = makePaint("#FFFFFF", appearance.impactGlintOpacity, 0, PaintStyle.Fill);
    for (let i = 0; i < 5; i++) {
      const angle = random() * Math.PI * 2;
      const radius = impact.radius * (0.18 + random() * 0.48);
      const size = 0.35 + random() * 0.55;
      canvas.drawCircle(
        impact.x + Math.cos(angle) * radius,
        impact.y + Math.sin(angle) * radius,
        size,
        glintPaint,
      );
    }
  }
}

/**
 * Records the complete static fracture network into one SkPicture.
 * This is called only after a tap changes the graph, never once per frame.
 */
export function createFracturePicture(model: FractureModel): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, model.width, model.height),
  );

  // Build geometry once, then reuse those paths across the material passes.
  // Strength is bucketed so individual fractures retain subtle brightness variation.
  const batches = buildPathBatches(model.strokes);
  drawFracturePass(canvas, batches, "edge");
  drawFracturePass(canvas, batches, "seam");
  drawFracturePass(canvas, batches, "specular");
  drawFracturePass(canvas, batches, "glint");
  drawImpactCentres(canvas, model);

  return recorder.finishRecordingAsPicture();
}
