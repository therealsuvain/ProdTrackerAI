import React from "react";
import { View } from "react-native";

import { getAtlas, type AtlasSprite, type SpriteKey } from "./space-invaders-sprites";

interface BodyProps {
  sprite: AtlasSprite;
  color: string;
  scale: number;
}

/** Static rectangles for one sprite. Memoised so moving a sprite never rebuilds them. */
export const SpriteBody = React.memo(function SpriteBody({
  sprite,
  color,
  scale,
}: BodyProps) {
  return (
    <View
      pointerEvents="none"
      style={{ width: sprite.w * scale, height: sprite.h * scale }}
    >
      {sprite.rects.map((r, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: r.x * scale,
            top: r.y * scale,
            width: r.w * scale,
            height: r.h * scale,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
});

interface SpriteProps {
  name: SpriteKey;
  x: number;
  y: number;
  color: string;
  scale: number;
}

/**
 * Positions a sprite on the integer pixel grid, like the arcade did.
 * Uses transforms (no layout pass) and only re-renders when the snapped
 * pixel position actually changes.
 */
export const Sprite = React.memo(
  function Sprite({ name, x, y, color, scale }: SpriteProps) {
    const sprite = getAtlas()[name];
    return (
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: [
            { translateX: Math.round(x) * scale },
            { translateY: Math.round(y) * scale },
          ],
        }}
      >
        <SpriteBody sprite={sprite} color={color} scale={scale} />
      </View>
    );
  },
  (a, b) =>
    a.name === b.name &&
    a.color === b.color &&
    a.scale === b.scale &&
    Math.round(a.x) === Math.round(b.x) &&
    Math.round(a.y) === Math.round(b.y),
);
