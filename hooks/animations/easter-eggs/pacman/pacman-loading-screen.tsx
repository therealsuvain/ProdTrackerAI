import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getAtlas } from "./pacman-sprites";
import { SpriteBody } from "./pacman-sprite-view";
import { PM_COLORS, PM_FONT } from "./pacman-theme";

interface Props {
  progress: number; // 0 - 100
  label: string;
  width: number;
  hi: number;
}

const SEGMENTS = 20;

export function PacManLoadingScreen({ progress, label, width, hi }: Props) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const chomp = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 260);
    const flash = setInterval(() => setBlink((b) => !b), 520);
    return () => {
      clearInterval(chomp);
      clearInterval(flash);
    };
  }, []);

  const atlas = getAtlas();
  const barWidth = Math.min(width * 0.74, 320);
  const filled = Math.floor((progress / 100) * SEGMENTS);
  const pacKey = frame === 0 ? "pacRightA" : "pacRightB";
  const ghostBody = frame === 0 ? "ghostBodyA" : "ghostBodyB";
  const ghosts = [
    PM_COLORS.blinky,
    PM_COLORS.pinky,
    PM_COLORS.inky,
    PM_COLORS.clyde,
  ];

  return (
    <View style={styles.root}>
      <View style={styles.marchRow}>
        <View style={{ transform: [{ translateX: frame === 0 ? -2 : 2 }] }}>
          <SpriteBody sprite={atlas[pacKey]} color={PM_COLORS.yellow} scale={3} />
        </View>
        {ghosts.map((color, idx) => (
          <View
            key={idx}
            style={{
              width: atlas[ghostBody].w * 3,
              height: atlas[ghostBody].h * 3,
              transform: [{ translateX: frame === 0 ? -2 : 2 }],
            }}
          >
            <SpriteBody sprite={atlas[ghostBody]} color={color} scale={3} />
            <View style={StyleSheet.absoluteFill}>
              <SpriteBody
                sprite={atlas.eyesRight}
                color={PM_COLORS.white}
                scale={3}
              />
            </View>
            <View style={StyleSheet.absoluteFill}>
              <SpriteBody
                sprite={atlas.pupilsRight}
                color={PM_COLORS.eyeBlue}
                scale={3}
              />
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.title}>PAC-MAN</Text>
      <Text style={[styles.sub, { opacity: blink ? 1 : 0.25 }]}>LOADING</Text>

      <View style={[styles.bar, { width: barWidth }]}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                backgroundColor:
                  i < filled ? PM_COLORS.yellow : "rgba(255,230,0,0.14)",
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
    backgroundColor: PM_COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  marchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  title: {
    color: PM_COLORS.yellow,
    fontFamily: PM_FONT,
    fontWeight: "700",
    fontSize: 28,
    letterSpacing: 4,
  },
  sub: {
    color: PM_COLORS.pellet,
    fontFamily: PM_FONT,
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
    borderColor: PM_COLORS.wall,
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
    color: PM_COLORS.yellow,
    fontFamily: PM_FONT,
    fontSize: 11,
    fontWeight: "700",
    flexShrink: 1,
  },
  hi: {
    marginTop: 18,
    color: PM_COLORS.blinky,
    fontFamily: PM_FONT,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
});
