// import React, { useEffect } from "react";
// import { View, StyleSheet } from "react-native";
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withRepeat,
//   withTiming,
//   Easing,
// } from "react-native-reanimated";

// export const LoadingIndicatorPlanetaryOrbit = () => {
//   // A single master rotation driver (0 to 360 degrees)
//   const rotation = useSharedValue(0);
//   const pulse = useSharedValue(1);

//   useEffect(() => {
//     // 4000ms for a full 360-degree tumble
//     rotation.value = withRepeat(
//       withTiming(360, { duration: 4000, easing: Easing.linear }),
//       -1,
//       false,
//     );

//     // Subtle planet pulsing
//     pulse.value = withRepeat(
//       withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
//       -1,
//       true,
//     );
//   }, []);

//   // Outer Ring: Tumbles over X, slowly drifts over Y
//   const outerStyle = useAnimatedStyle(() => ({
//     transform: [
//       { rotateX: `${rotation.value}deg` },
//       { rotateY: `${rotation.value * 0.5}deg` },
//     ],
//   }));

//   // Middle Ring: Tumbles backward over X, fast over Y
//   const middleStyle = useAnimatedStyle(() => ({
//     transform: [
//       //{ rotateX: `${rotation.value * -0.75}deg` },
//       { rotateX: `${rotation.value * -0.5}deg` },
//       { rotateY: `${rotation.value}deg` },
//     ],
//   }));

//   // Inner Ring: Chaotic diagonal tumble
//   const innerStyle = useAnimatedStyle(() => ({
//     transform: [
//       /* { rotateX: `${rotation.value * 1.25}deg` },
//       { rotateY: `${rotation.value * -1.25}deg` }, */
//       { rotateX: `${rotation.value * 1.5}deg` },
//       { rotateY: `${rotation.value * -1.5}deg` },
//     ],
//   }));

//   // Planet Core
//   const coreStyle = useAnimatedStyle(() => ({
//     transform: [{ scale: pulse.value }],
//     opacity: 1.2 - pulse.value * 0.2, // Dims slightly as it pulses
//   }));

//   return (
//     <View style={styles.container}>
//       {/* The Central Planet */}
//       <Animated.View style={[styles.core, coreStyle]} />

//       {/* The 3 Intersecting Orbital Rings */}
//       <Animated.View style={[styles.ring, styles.outerRing, outerStyle]} />
//       <Animated.View style={[styles.ring, styles.middleRing, middleStyle]} />
//       <Animated.View style={[styles.ring, styles.innerRing, innerStyle]} />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     width: 28,
//     height: 28,
//     justifyContent: "center",
//     alignItems: "center",
//     marginRight: 12,
//   },
//   core: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: "#2C3E50", // Dark planet
//     position: "absolute",
//     zIndex: 10,
//   },
//   ring: {
//     position: "absolute",
//     borderRadius: 100, // Perfect, unbroken circles
//     borderWidth: 1.5, // Solid, clean lines
//   },
//   outerRing: {
//     width: 28,
//     height: 28,
//     borderColor: "#2C3E50",
//   },
//   middleRing: {
//     width: 22,
//     height: 22,
//     borderColor: "#34495E",
//   },
//   innerRing: {
//     width: 16,
//     height: 16,
//     borderColor: "#7F8C8D",
//   },
// });

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface Props {
  /** The total width/height of the outermost ring. Default is 28. */
  size?: number;
  /** Array of 4 hex codes: [Core, Outer Ring, Middle Ring, Inner Ring] */
  colors?: [string, string, string, string];
}

export const LoadingIndicatorPlanetaryOrbit = ({
  size = 28,
  colors = ["#2C3E50", "#2C3E50", "#34495E", "#7F8C8D"],
}: Props) => {
  const [coreColor, outerColor, middleColor, innerColor] = colors;

  // Calculate perfect proportional scales based on the master size
  const sOuter = size;
  const sMiddle = size * (22 / 28);
  const sInner = size * (16 / 28);
  const sCore = size * (8 / 28);
  // Scale border thickness, but never let it drop below 1 pixel
  const borderWidth = Math.max(1, size * (1.5 / 28));

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );

    pulse.value = withRepeat(
      withTiming(1.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value}deg` },
      { rotateY: `${rotation.value * 0.5}deg` },
    ],
  }));

  const middleStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value * -0.5}deg` },
      { rotateY: `${rotation.value}deg` },
    ],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateX: `${rotation.value * 1.5}deg` },
      { rotateY: `${rotation.value * -1.5}deg` },
    ],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1.2 - pulse.value * 0.2,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* 1. The Core */}
      <Animated.View
        style={[
          styles.core,
          coreStyle,
          {
            width: sCore,
            height: sCore,
            borderRadius: sCore / 2,
            backgroundColor: coreColor,
          },
        ]}
      />

      {/* 2. Outer Ring */}
      <Animated.View
        style={[
          styles.ring,
          outerStyle,
          {
            width: sOuter,
            height: sOuter,
            borderRadius: sOuter / 2,
            borderWidth,
            borderColor: outerColor,
          },
        ]}
      />

      {/* 3. Middle Ring */}
      <Animated.View
        style={[
          styles.ring,
          middleStyle,
          {
            width: sMiddle,
            height: sMiddle,
            borderRadius: sMiddle / 2,
            borderWidth,
            borderColor: middleColor,
          },
        ]}
      />

      {/* 4. Inner Ring */}
      <Animated.View
        style={[
          styles.ring,
          innerStyle,
          {
            width: sInner,
            height: sInner,
            borderRadius: sInner / 2,
            borderWidth,
            borderColor: innerColor,
          },
        ]}
      />
    </View>
  );
};

// Extracted static layout styles to keep the JSX somewhat clean
const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  core: {
    position: "absolute",
    zIndex: 10,
  },
  ring: {
    position: "absolute",
  },
});
