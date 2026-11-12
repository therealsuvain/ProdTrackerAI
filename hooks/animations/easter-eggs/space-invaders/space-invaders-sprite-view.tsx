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

/** Positions a sprite on the integer pixel grid, like the arcade did. */
export function Sprite({ name, x, y, color, scale }: SpriteProps) {
  const sprite = getAtlas()[name];
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: Math.round(x) * scale,
        top: Math.round(y) * scale,
      }}
    >
      <SpriteBody sprite={sprite} color={color} scale={scale} />
    </View>
  );
}
