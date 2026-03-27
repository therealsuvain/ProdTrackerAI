import {   useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { TimerDisplayProps } from "./time-display";
export const useTimerDisplayAnimation = ({
    time,
    mode,
    isRunning,
    onToggleMode,
}: TimerDisplayProps) => {
    const FLIP_DURATION = 580;
    const flipAnim = useRef(new Animated.Value(0)).current;
    const [showingFront, setShowingFront] = useState(true);
    const showingFrontRef = useRef(true); // ref copy for use inside callback
    const isFlipping = useRef(false);

    // Sync face when mode changes externally (e.g. resetState() in context)
    useEffect(() => {
        const shouldShowFront = mode === "stopwatch";
        if (shouldShowFront !== showingFrontRef.current && !isFlipping.current) {
            showingFrontRef.current = shouldShowFront;
            setShowingFront(shouldShowFront);
            flipAnim.setValue(0);
        }
    }, [mode]);


    const handleLongPress = () => {
        if (isRunning || isFlipping.current) return;
        isFlipping.current = true;
        onToggleMode();
        flipAnim.setValue(0);
        Animated.timing(flipAnim, {
            toValue: 1,
            duration: FLIP_DURATION,
            useNativeDriver: true,
        }).start(() => {
            const next = !showingFrontRef.current;
            showingFrontRef.current = next;
            setShowingFront(next);
            isFlipping.current = false;
            flipAnim.setValue(0);
        });
    };

    // Recomputed every render because showingFront is state — this is correct
    const aRotate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: showingFront
            ? ["0deg", "90deg", "90deg"]
            : ["-90deg", "-90deg", "0deg"],
    });
    const bRotate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: showingFront
            ? ["-90deg", "-90deg", "0deg"]
            : ["0deg", "90deg", "90deg"],
    });

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const prevSecond = useRef(-1);
    useEffect(() => {
        if (mode !== "stopwatch" || !isRunning) return;
        const s = Math.floor(time);
        if (s !== prevSecond.current) {
            prevSecond.current = s;
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.025,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [time, mode, isRunning]);
    
    return {
        aRotate,
        bRotate,
        pulseAnim,
        handleLongPress,
    };
};