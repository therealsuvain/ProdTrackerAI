import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getAtlas } from "./space-invaders-sprites";
import { SpriteBody } from "./space-invaders-sprite-view";
import { SI_COLORS, SI_FONT } from "./space-invaders-theme";

interface Props {
  progress: number; // 0 - 100
  label: string;
  width: number;
  hi: number;
}

const SEGMENTS = 20;

export function SpaceInvadersLoadingScreen({ progress, label, width, hi }: Props) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const march = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 450);
    const flash = setInterval(() => setBlink((b) => !b), 520);
    return () => {
      clearInterval(march);
      clearInterval(flash);
    };
  }, []);

  const atlas = getAtlas();
  const barWidth = Math.min(width * 0.74, 320);
  const filled = Math.floor((progress / 100) * SEGMENTS);
  const f = frame === 0 ? "A" : "B";
  const sprites = [
    { key: `squid${f}` as const, color: SI_COLORS.white },
    { key: `crab${f}` as const, color: SI_COLORS.white },
    { key: `octopus${f}` as const, color: SI_COLORS.white },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.marchRow}>
        {sprites.map((s) => (
          <View
            key={s.key.slice(0, -1)}
            style={{ transform: [{ translateX: frame === 0 ? -4 : 4 }] }}
          >
            <SpriteBody sprite={atlas[s.key]} color={s.color} scale={3} />
          </View>
        ))}
      </View>

      <Text style={styles.title}>SPACE INVADERS</Text>
      <Text style={[styles.sub, { opacity: blink ? 1 : 0.25 }]}>LOADING</Text>

      <View style={[styles.bar, { width: barWidth }]}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor:
                  i < filled ? SI_COLORS.green : "rgba(61,255,90,0.12)",
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.metaRow, { width: barWidth }]}>
        <Text style={styles.meta} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        <Text style={styles.meta}>{String(progress).padStart(3, " ")}%</Text>
      </View>

      <Text style={styles.hi}>HI-SCORE {String(hi).padStart(5, "0")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SI_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  marchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 14,
  },
  title: {
    color: SI_COLORS.white,
    fontFamily: SI_FONT,
    fontWeight: "700",
    fontSize: 26,
    letterSpacing: 3,
  },
  sub: {
    color: SI_COLORS.green,
    fontFamily: SI_FONT,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 6,
  },
  bar: {
    flexDirection: "row",
    gap: 3,
    padding: 4,
    marginTop: 8,
    borderWidth: 2,
    borderColor: SI_COLORS.green,
  },
  segment: {
    flex: 1,
    height: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    color: SI_COLORS.green,
    fontFamily: SI_FONT,
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  hi: {
    marginTop: 18,
    color: SI_COLORS.red,
    fontFamily: SI_FONT,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
});
