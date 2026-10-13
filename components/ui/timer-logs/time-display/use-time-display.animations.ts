// import { useEffect, useRef, useState } from "react";
// import { Animated } from "react-native";
// import { TimerDisplayProps } from "./time-display";
// import { useTimerSeconds } from "@/hooks/context-hooks/use-timer-seconds";
// export const useTimerDisplayAnimation = ({
//     mode,
//     isRunning,
//     onToggleMode,
// }: TimerDisplayProps) => {
//     const FLIP_DURATION = 580;
//     const flipAnim = useRef(new Animated.Value(0)).current;
//     const [showingFront, setShowingFront] = useState(true);
//     const showingFrontRef = useRef(true); // ref copy for use inside callback
//     const isFlipping = useRef(false);
//     const time = useTimerSeconds();

//     // Sync face when mode changes externally (e.g. resetState() in context)
//     useEffect(() => {
//         const shouldShowFront = mode === "stopwatch";
//         if (shouldShowFront !== showingFrontRef.current && !isFlipping.current) {
//             showingFrontRef.current = shouldShowFront;
//             setShowingFront(shouldShowFront);
//             flipAnim.setValue(0);
//         }
//     }, [mode]);


//     const handleLongPress = () => {
//         if (isRunning || isFlipping.current) return;
//         isFlipping.current = true;
//         onToggleMode();
//         flipAnim.setValue(0);
//         Animated.timing(flipAnim, {
//             toValue: 1,
//             duration: FLIP_DURATION,
//             useNativeDriver: true,
//         }).start(() => {
//             const next = !showingFrontRef.current;
//             showingFrontRef.current = next;
//             setShowingFront(next);
//             isFlipping.current = false;
//             flipAnim.setValue(0);
//         });
//     };

//     // Recomputed every render because showingFront is state — this is correct
//     const aRotate = flipAnim.interpolate({
//         inputRange: [0, 0.5, 1],
//         outputRange: showingFront
//             ? ["0deg", "90deg", "90deg"]
//             : ["-90deg", "-90deg", "0deg"],
//     });
//     const bRotate = flipAnim.interpolate({
//         inputRange: [0, 0.5, 1],
//         outputRange: showingFront
//             ? ["-90deg", "-90deg", "0deg"]
//             : ["0deg", "90deg", "90deg"],
//     });

//     const pulseAnim = useRef(new Animated.Value(1)).current;
//     const prevSecond = useRef(-1);
//     useEffect(() => {
//         if (mode !== "stopwatch" || !isRunning) return;
//         const s = Math.floor(time);
//         if (s !== prevSecond.current) {
//             prevSecond.current = s;
//             Animated.sequence([
//                 Animated.timing(pulseAnim, {
//                     toValue: 1.025,
//                     duration: 100,
//                     useNativeDriver: true,
//                 }),
//                 Animated.timing(pulseAnim, {
//                     toValue: 1,
//                     duration: 100,
//                     useNativeDriver: true,
//                 }),
//             ]).start();
//         }
//     }, [time, mode, isRunning]);

//     return {
//         aRotate,
//         bRotate,
//         pulseAnim,
//         handleLongPress,
//     };
// };

import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { TimerDisplayProps } from "./time-display";
import { useTimerSeconds } from "@/hooks/context-hooks/use-timer-seconds";

const FLIP_DURATION = 580;

export const useTimerDisplayAnimation = ({ mode, isRunning, onToggleMode }: TimerDisplayProps) => {
    const time = useTimerSeconds();

    // 0 = stopwatch face (A) showing, 1 = countdown face (B) showing. Derived from mode only.
    const flip = useRef(new Animated.Value(mode === "countdown" ? 1 : 0)).current;
    const mounted = useRef(false);

    useEffect(() => {
        if (!mounted.current) { mounted.current = true; return; }
        flip.stopAnimation();
        Animated.timing(flip, {
            toValue: mode === "countdown" ? 1 : 0,
            duration: FLIP_DURATION,
            useNativeDriver: true,
        }).start();
    }, [mode]);

    const handleLongPress = () => {
        if (isRunning) return;
        onToggleMode(); // mode change drives the animation via the effect
    };

    const aRotate = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "90deg", "90deg"] });
    const bRotate = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-90deg", "-90deg", "0deg"] });

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const prevSecond = useRef(-1);
    useEffect(() => {
        if (mode !== "stopwatch" || !isRunning) return;
        if (time !== prevSecond.current) {
            prevSecond.current = time;
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.025, duration: 100, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();
        }
    }, [time, mode, isRunning]);

    return { aRotate, bRotate, pulseAnim, handleLongPress };
};