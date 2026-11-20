import type { RefObject } from "react";
import type { View } from "react-native";

export type RainSplashSurface = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  edge: "top" | "bottom";
};

type RegisteredSurface = {
  node: View;
  edge: RainSplashSurface["edge"];
};

type MeasuredRect = { x: number; y: number; width: number; height: number };

const registeredSurfaces = new Map<string, RegisteredSurface>();

/** Register/unregister a native view that can receive rain impacts. */
export function setRainSplashSurface(
  id: string,
  node: View | null,
  edge: RainSplashSurface["edge"] = "top",
): void {
  if (!node) {
    registeredSurfaces.delete(id);
    return;
  }
  registeredSurfaces.set(id, { node, edge });
}

function measureInWindow(node: View): Promise<MeasuredRect | null> {
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Resolve currently mounted surfaces into animation-canvas coordinates.
 * Measuring at rain activation time naturally accounts for scrolling,
 * wrapping, keyboard reflow and changing result positions.
 */
export async function measureRainSplashSurfaces(
  canvasRef: RefObject<View | null>,
): Promise<RainSplashSurface[]> {
  const canvasNode = canvasRef.current;
  if (!canvasNode) return [];

  const canvasRect = await measureInWindow(canvasNode);
  if (!canvasRect) return [];

  const entries = [...registeredSurfaces.entries()];
  const measured = await Promise.all(
    entries.map(async ([id, registered]) => {
      const rect = await measureInWindow(registered.node);
      if (!rect) return null;

      // The splash canvas covers the animationCanvas. Keep only surfaces whose
      // impact edge is actually inside that viewport, clipping horizontal reach.
      const localX = rect.x - canvasRect.x;
      const localY = rect.y - canvasRect.y;
      const edgeY = registered.edge === "top"
        ? localY
        : localY + rect.height;
      if (edgeY < 0 || edgeY > canvasRect.height) return null;

      const left = Math.max(0, localX);
      const right = Math.min(canvasRect.width, localX + rect.width);
      const clippedWidth = right - left;
      if (clippedWidth < 18) return null;

      return {
        id,
        x: left,
        y: edgeY,
        width: clippedWidth,
        height: rect.height,
        edge: registered.edge,
      } satisfies RainSplashSurface;
    }),
  );

  return measured.filter((surface): surface is RainSplashSurface => surface !== null);
}
