import React, { useEffect, useMemo, useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import { Canvas, Picture, type SkPicture } from "@shopify/react-native-skia";

import {
  computeLoadingLayout,
  renderSnakeLoading,
} from "./snake-skia-renderer";
import { SNAKE_COLORS } from "./snake-theme";

interface Props {
  progress: number; // 0 - 100
  label: string;
  width: number;
  height: number;
  hi: number;
}

// Full-screen "phone boot" LCD: a pixel snake winds through a serpentine
// track, eating pellets; the further it gets, the longer it is.
export function SnakeLoadingScreen({ progress, label, width, height, hi }: Props) {
  const layout = useMemo(
    () => computeLoadingLayout(width, height, PixelRatio.get()),
    [width, height],
  );
  const [time, setTime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setTime((Date.now() - start) / 1000), 110);
    return () => clearInterval(id);
  }, []);

  const picture: SkPicture = useMemo(
    () => renderSnakeLoading(layout, progress, label, hi, time),
    [layout, progress, label, hi, time],
  );

  return (
    <View style={styles.root}>
      <Canvas style={{ width: layout.canvasW, height: layout.canvasH }}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SNAKE_COLORS.lcdMid,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
