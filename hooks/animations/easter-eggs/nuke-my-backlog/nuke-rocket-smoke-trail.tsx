// import React, { memo } from "react";
// import { Animated, StyleSheet, View } from "react-native";

// /**
//  * Nuke My Backlog — persistent exhaust trail.
//  * ---------------------------------------------------------------------------
//  * This is a screen-space trail made from a small number of soft cloud puffs.
//  * The controller supplies sampled positions from the exact paths used by the
//  * rocket. Each puff reveals as the rocket passes it, then slowly dissipates.
//  *
//  * The component never samples Animated.Values on the JS thread. Each segment's
//  * progress and the shared fade value are composed as native animated opacity
//  * nodes, so the trail doesn't need per-frame React state updates.
//  */

// export type NukeSmokeTrailPoint = {
//   x: number;
//   y: number;
//   /** 0..1 position along this segment, in the direction of travel. */
//   progress: number;
//   /** Puff width in dp. Height is derived from this. */
//   size: number;
//   /** Small deterministic variation so the trail does not look stamped. */
//   rotation: number;
//   opacity?: number;
// };

// export type NukeSmokeTrailSegment = {
//   id: string;
//   points: NukeSmokeTrailPoint[];
//   progress: Animated.Value;
// };

// type Props = {
//   segments: NukeSmokeTrailSegment[];
//   /** Shared 1 -> 0 fade, started when Act 3 takes over. */
//   opacity: Animated.Value;
//   maxOpacity: number;
//   visible: boolean;
// };

// const SmokePuff = memo(function SmokePuff({
//   point,
//   progress,
//   sharedOpacity,
//   maxOpacity,
// }: {
//   point: NukeSmokeTrailPoint;
//   progress: Animated.Value;
//   sharedOpacity: Animated.Value;
//   maxOpacity: number;
// }) {
//   // A puff starts revealing shortly before the rocket crosses its position,
//   // peaks at the crossing, then remains as a faint wisp until the segment ends.
//   const revealStart = point.progress * 0.88;
//   const revealOpacity = progress.interpolate({
//     inputRange: [0, Math.max(0.0001, revealStart), point.progress, 1],
//     outputRange: [
//       0,
//       0,
//       maxOpacity * (point.opacity ?? 1),
//       maxOpacity * (point.opacity ?? 1) * 0.34,
//     ],
//     extrapolate: "clamp",
//   });
//   const composedOpacity = Animated.multiply(revealOpacity, sharedOpacity);

//   const width = point.size;
//   const height = Math.max(4, width * 0.56);

//   return (
//     <Animated.View
//       pointerEvents="none"
//       style={[
//         styles.puff,
//         {
//           left: point.x - width / 2,
//           top: point.y - height / 2,
//           width,
//           height,
//           borderTopLeftRadius: width * 0.78,
//           borderTopRightRadius: width * 0.9,
//           borderBottomLeftRadius: height * 0.65,
//           borderBottomRightRadius: width * 0.58,
//           opacity: composedOpacity,
//           transform: [{ rotate: `${point.rotation}deg` }],
//         },
//       ]}
//     />
//   );
// });

// export default function NukeRocketSmokeTrail({
//   segments,
//   opacity,
//   maxOpacity,
//   visible,
// }: Props) {
//   if (!visible || segments.length === 0) return null;

//   return (
//     <View
//       pointerEvents="none"
//       accessible={false}
//       accessibilityElementsHidden
//       importantForAccessibility="no-hide-descendants"
//       style={StyleSheet.absoluteFillObject}
//     >
//       {segments.map((segment) =>
//         segment.points.map((point, index) => (
//           <SmokePuff
//             key={`${segment.id}-${index}`}
//             point={point}
//             progress={segment.progress}
//             sharedOpacity={opacity}
//             maxOpacity={maxOpacity}
//           />
//         )),
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   puff: {
//     position: "absolute",
//     overflow: "visible",
//     backgroundColor: "rgba(0, 132, 255, 0.88)",
//     shadowColor: "#7D8B99",
//     shadowOpacity: 0.18,
//     shadowRadius: 6,
//     shadowOffset: { width: 0, height: 1 },
//     elevation: 2,
//   },
// });

import React, { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";

export type NukeSmokeTrailPoint = {
  x: number;
  y: number;
  /** 0..1 position along this segment, in the direction of travel. */
  progress: number;
  /** Puff width in dp. Height is derived from this. */
  size: number;
  /** Small deterministic variation so the trail does not look stamped. */
  rotation: number;
  opacity?: number;
};

export type NukeSmokeTrailSegment = {
  id: string;
  points: NukeSmokeTrailPoint[];
  progress: Animated.Value;
};

type Props = {
  segments: NukeSmokeTrailSegment[];
  /** Shared 1 -> 0 fade, started when Act 3 takes over. */
  opacity: Animated.Value;
  maxOpacity: number;
  visible: boolean;
};

const SmokePuff = memo(function SmokePuff({
  point,
  progress,
  maxOpacity,
}: {
  point: NukeSmokeTrailPoint;
  progress: Animated.Value;
  maxOpacity: number;
}) {
  // Reveal right as the rocket reaches `point.progress`, peak immediately behind
  // the nozzle, then linger as a visible contrail wisp.
  const start = Math.max(0, point.progress - 0.035);
  const peak = Math.min(1, point.progress + 0.015);
  const peakAlpha = Math.min(1, maxOpacity * (point.opacity ?? 1));

  const revealOpacity = progress.interpolate({
    inputRange: [0, start, peak, 1],
    outputRange: [0, 0, peakAlpha, peakAlpha * 0.58],
    extrapolate: "clamp",
  });

  const puffScale = progress.interpolate({
    inputRange: [0, start, peak, 1],
    outputRange: [0.45, 0.45, 1, 1.42],
    extrapolate: "clamp",
  });

  const width = point.size * 1.35;
  const height = Math.max(8, width * 0.78);
  const radius = height / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.puff,
        {
          left: point.x - width / 2,
          top: point.y - height / 2,
          width,
          height,
          borderRadius: radius,
          opacity: revealOpacity,
          transform: [{ rotate: `${point.rotation}deg` }, { scale: puffScale }],
        },
      ]}
    />
  );
});

export default function NukeRocketSmokeTrail({
  segments,
  opacity,
  maxOpacity,
  visible,
}: Props) {
  if (!visible || segments.length === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, styles.container, { opacity }]}
    >
      {segments.map((segment) =>
        segment.points.map((point, index) => (
          <SmokePuff
            key={`${segment.id}-${index}`}
            point={point}
            progress={segment.progress}
            maxOpacity={maxOpacity}
          />
        )),
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 14,
  },
  puff: {
    position: "absolute",
    backgroundColor: "rgba(242, 248, 255, 0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(180, 206, 230, 0.55)",
  },
});
