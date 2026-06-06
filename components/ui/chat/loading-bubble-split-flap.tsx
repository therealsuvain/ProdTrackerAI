import React, { useEffect, useState, useRef } from "react";
import { View, Animated as RNAnimated, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { LoadingIndicatorNC } from "@/components/shared/loading-indicator-neural-core";
import { LoadingIndicatorSynth } from "@/components/shared/loading-indicator-synth";
import { LoadingIndicatorOrbit } from "@/components/shared/loading-indicator-orbit";
import { LoadingIndicatorAtomicOrbit } from "@/components/shared/loading-indicator-atomic-orbit";
import { LoadingIndicatorGyro } from "@/components/shared/loading-indicator-gyro";
import { LoadingIndicatorSonar } from "@/components/shared/loading-indicator-sonar";
import { LoadingIndicatorInfinity } from "@/components/shared/loading-indicator-infinity";
import { LoadingIndicatorPlanetaryOrbit } from "@/components/shared/loading-indicator-planetary-orbit";
import { LoadingIndicatorPlanetaryOrbitSkia } from "@/components/shared/loading-indicator-planetary-orbit-skia";

interface Props {
  isUser?: boolean;
  agentProgress?: string | null;
}

const parseText = (text: string) => {
  let gIndex = 0;
  return text.split(" ").map((word) => {
    const chars = word.split("").map((char) => ({ char, index: gIndex++ }));
    gIndex++; // Account for the space in the global index
    return chars;
  });
};

const AnimatedLetter = ({
  char,
  index,
  isPrev,
}: {
  char: string;
  index: number;
  isPrev: boolean;
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    const delay = index * 20; // Stagger effect from left to right
    if (isPrev) {
      // Exit fast and sharp
      progress.value = withDelay(delay, withTiming(1, { duration: 250 }));
    } else {
      // Enter with a mechanical spring bounce
      progress.value = withDelay(
        delay,
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    }
  }, []);

  const style = useAnimatedStyle(() => {
    if (isPrev) {
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.5],
          [1, 0],
          Extrapolation.CLAMP,
        ),
        transform: [
          { perspective: 400 },
          { rotateX: `${interpolate(progress.value, [0, 1], [0, 90])}deg` },
        ],
      };
    } else {
      return {
        opacity: interpolate(
          progress.value,
          [0, 0.2],
          [0, 1],
          Extrapolation.CLAMP,
        ),
        transform: [
          { perspective: 400 },
          { rotateX: `${interpolate(progress.value, [0, 1], [-90, 0])}deg` },
        ],
      };
    }
  });

  return (
    <Animated.Text style={[styles.agentProgress, style]}>{char}</Animated.Text>
  );
};

const SplitFlapTransitioner = ({ text }: { text: string }) => {
  const [state, setState] = useState({ prev: "", curr: text, key: 0 });

  useEffect(() => {
    if (text && text !== state.curr) {
      setState((s) => ({ prev: s.curr, curr: text, key: s.key + 1 }));
    }
  }, [text]);

  const renderWords = (textToRender: string, isPrev: boolean) => (
    <View style={styles.wordsContainer}>
      {parseText(textToRender).map((word, wIdx) => (
        <View key={wIdx} style={styles.wordRow}>
          {word.map((item) => (
            <AnimatedLetter
              key={item.index}
              char={item.char}
              index={item.index}
              isPrev={isPrev}
            />
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.textWrapper}>
      <View style={{ position: "absolute" }} key={"prev" + state.key}>
        {renderWords(state.prev, true)}
      </View>
      <View key={"curr" + state.key}>{renderWords(state.curr, false)}</View>
    </View>
  );
};

export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
  const dot1 = useRef(new RNAnimated.Value(0.3)).current;
  const dot2 = useRef(new RNAnimated.Value(0.3)).current;
  const dot3 = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    if (!isUser) return;
    const animate = (dot: RNAnimated.Value, delay: number) => {
      return RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [isUser]);

  if (isUser) {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        {[dot1, dot2, dot3].map((anim, i) => (
          <RNAnimated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.bubble, styles.aiBubble]}>
      {agentProgress && <LoadingIndicatorPlanetaryOrbit size={42} />}
      {agentProgress && <SplitFlapTransitioner text={agentProgress} />}
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#F0F0F0",
    borderRadius: 18,
    marginRight: 10,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginLeft: 10,
    minHeight: 45,
    minWidth: 150,
  },
  textWrapper: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  wordsContainer: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
    alignItems: "center",
  },
  wordRow: { flexDirection: "row", marginRight: 4 }, // marginRight acts as the space between words
  agentProgress: {
    fontFamily: "serif",
    fontWeight: "bold",
    color: "#2C3E50",
    fontSize: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});

// // loading-bubble-split-flap.tsx
// import React, { useEffect, useState, useRef } from "react";
// import { View, Animated as RNAnimated, StyleSheet } from "react-native";
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withSpring,
//   withTiming,
//   withDelay,
//   interpolate,
//   Extrapolation,
//   Extrapolation,
// } from "react-native-reanimated";

// interface Props {
//   isUser?: boolean;
//   agentProgress?: string | null;
// }

// /* const parseText = (text: string) => {
//   let gIndex = 0;
//   return text.split(" ").map((word) => {
//     const chars = word.split("").map((char) => ({ char, index: gIndex++ }));
//     gIndex++; // Account for the space in the global index
//     return chars;
//   });
// };
//  */
// const AnimatedLetter = React.memo(
//   ({
//     char,
//     index,
//     isPrev,
//     trigger,
//   }: {
//     char: string;
//     index: number;
//     isPrev: boolean;
//     trigger: number;
//   }) => {
//     const progress = useSharedValue(0);

//     useEffect(() => {
//       // OPTIMIZATION 2: Re-use the mounted component, just reset the animation value
//       progress.value = 0;
//       const delay = index * 15; // Stagger effect from left to right
//       if (isPrev) {
//         // Exit fast and sharp
//         progress.value = withDelay(delay, withTiming(1, { duration: 200 }));
//       } else {
//         // Enter with a mechanical spring bounce
//         progress.value = withDelay(
//           delay,
//           withSpring(1, { damping: 12, stiffness: 200 }),
//         );
//       }
//     }, [trigger, isPrev]);

//     const style = useAnimatedStyle(() => {
//       if (isPrev) {
//         return {
//           opacity: interpolate(
//             progress.value,
//             [0, 0.5],
//             [1, 0],
//             Extrapolation.CLAMP,
//           ),
//           transform: [
//             { perspective: 400 },
//             { rotateX: `${interpolate(progress.value, [0, 1], [0, 90])}deg` },
//           ],
//         };
//       } else {
//         return {
//           opacity: interpolate(
//             progress.value,
//             [0, 0.2],
//             [0, 1],
//             Extrapolation.CLAMP,
//           ),
//           transform: [
//             { perspective: 400 },
//             { rotateX: `${interpolate(progress.value, [0, 1], [-90, 0])}deg` },
//           ],
//         };
//       }
//     });
//     // OPTIMIZATION 3: Swap standard spaces for non-breaking spaces (\u00A0)
//     // This ensures the spaces hold their physical width without needing nested Views.
//     const displayChar = char === " " ? "\u00A0" : char;
//     return (
//       <Animated.Text style={[styles.agentProgress, style]}>
//         {displayChar}
//       </Animated.Text>
//     );
//   },
// );

// const SplitFlapTransitioner = ({ text }: { text: string }) => {
//   const [state, setState] = useState({ prev: "", curr: text, trigger: 0 });

//   useEffect(() => {
//     if (text && text !== state.curr) {
//       setState((s) => ({ prev: s.curr, curr: text, trigger: s.trigger + 1 }));
//     }
//   }, [text]);

//   const renderWords = (textToRender: string, isPrev: boolean) => (
//     <View style={styles.wordsContainer}>
//       {textToRender.split("").map((char, idx) => (
//         <AnimatedLetter
//           key={idx} // React recycles these efficiently now
//           char={char}
//           index={idx}
//           isPrev={isPrev}
//           trigger={state.trigger}
//         />
//       ))}
//     </View>
//   );

//   return (
//     <View style={styles.textWrapper}>
//       <View style={{ position: "absolute" }}>
//         {renderWords(state.prev, true)}
//       </View>
//       <View>{renderWords(state.curr, false)}</View>
//     </View>
//   );
// };

// export const LoadingBubble = ({ isUser, agentProgress }: Props) => {
//   const dot1 = useRef(new RNAnimated.Value(0.3)).current;
//   const dot2 = useRef(new RNAnimated.Value(0.3)).current;
//   const dot3 = useRef(new RNAnimated.Value(0.3)).current;

//   useEffect(() => {
//     if (!isUser) return;
//     const animate = (dot: RNAnimated.Value, delay: number) => {
//       return RNAnimated.loop(
//         RNAnimated.sequence([
//           RNAnimated.delay(delay),
//           RNAnimated.timing(dot, {
//             toValue: 1,
//             duration: 400,
//             useNativeDriver: true,
//           }),
//           RNAnimated.timing(dot, {
//             toValue: 0.3,
//             duration: 400,
//             useNativeDriver: true,
//           }),
//         ]),
//       ).start();
//     };
//     animate(dot1, 0);
//     animate(dot2, 200);
//     animate(dot3, 400);
//   }, [isUser]);

//   if (isUser) {
//     return (
//       <View style={[styles.bubble, styles.userBubble]}>
//         {[dot1, dot2, dot3].map((anim, i) => (
//           <RNAnimated.View key={i} style={[styles.dot, { opacity: anim }]} />
//         ))}
//       </View>
//     );
//   }

//   return (
//     <View style={[styles.bubble, styles.aiBubble]}>
//       {agentProgress && <SplitFlapTransitioner text={agentProgress} />}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   bubble: {
//     paddingVertical: 12,
//     paddingHorizontal: 18,
//     flexDirection: "row",
//     alignItems: "center",
//     marginBottom: 8,
//   },
//   userBubble: {
//     alignSelf: "flex-end",
//     backgroundColor: "#F0F0F0",
//     borderRadius: 18,
//     marginRight: 10,
//   },
//   aiBubble: {
//     alignSelf: "flex-start",
//     backgroundColor: "#E8ECEF",
//     borderRadius: 14,
//     marginLeft: 10,
//     minHeight: 45,
//     minWidth: 150,
//   },
//   textWrapper: {
//     justifyContent: "center",
//     alignItems: "center",
//     overflow: "visible",
//   },
//   wordsContainer: {
//     flexDirection: "row",
//     flexWrap: "nowrap",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   agentProgress: {
//     fontFamily: "serif",
//     fontWeight: "bold",
//     color: "#2C3E50",
//     fontSize: 14,
//   },
//   dot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: "#888",
//     marginHorizontal: 3,
//   },
// });
