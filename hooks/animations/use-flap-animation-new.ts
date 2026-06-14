//NOTE LEADS TO APP CRASH

import { useEffect, useCallback } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnUI,
    cancelAnimation,
    SharedValue
} from 'react-native-reanimated';

// ✅ Standalone worklet — defined OUTSIDE component, Babel workletizes it correctly
function flapWorklet(rotateX: SharedValue<number>) {
    'worklet';
    cancelAnimation(rotateX);           // ← cancel any still-running spring first
    rotateX.value = -28;
    rotateX.value = withSpring(0, {
        damping: 0.2,
        stiffness: 25,
        mass: 0.25,
        velocity: 15,
        energyThreshold: 0.1
    });
}

function launchWorklet(
    launchOpacity: SharedValue<number>,
    launchTranslateY: SharedValue<number>,
) {
    'worklet';
    launchOpacity.value = withTiming(1, { duration: 480 });
    launchTranslateY.value = withSpring(0, { damping: 18, stiffness: 180 });
}

// ─── HOOK ────────────────────────────────────────────────────────
export function useFlapAnimation({
    launchDelay = 0,
    intervalMs = 10000,
    triggerOffset = 0,
} = {}) {
    const launchOpacity = useSharedValue(0);
    const launchTranslateY = useSharedValue(14);
    const rotateX = useSharedValue(0);
    const halfHeight = useSharedValue(0);

    // ─── LAYOUT ──────────────────────────────────────────────────
    const onLayout = useCallback((e: any) => {
        halfHeight.value = e.nativeEvent.layout.height / 2;
    }, []);

    // ─── LAUNCH ──────────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => {
            runOnUI(launchWorklet)(launchOpacity, launchTranslateY);
        }, launchDelay);
        return () => clearTimeout(t);
    }, [launchDelay]);

    // ─── INTERVAL ────────────────────────────────────────────────
    useEffect(() => {
        // Use ReturnType so the handle is typed correctly on both
        // React Native (opaque object) and Node (number) runtimes.
        // Storing in a ref-object avoids stale-closure issues.
        const intervalRef: {
            offsetTimer: ReturnType<typeof setTimeout> | null;
            ticker: ReturnType<typeof setInterval> | null
        } = {
            offsetTimer: null,
            ticker: null,
        };

        intervalRef.offsetTimer = setTimeout(() => {
            runOnUI(flapWorklet)(rotateX);

            intervalRef.ticker = setInterval(() => {
                runOnUI(flapWorklet)(rotateX);
            }, intervalMs);
        }, triggerOffset);

        return () => {
            // Always clear both timers on unmount or dep change
            if (intervalRef.offsetTimer !== null) {
                clearTimeout(intervalRef.offsetTimer);
                intervalRef.offsetTimer = null;
            }
            if (intervalRef.ticker !== null) {
                clearInterval(intervalRef.ticker);
                intervalRef.ticker = null;
            }
            // Cancel any in-flight animation on the worklet thread
            runOnUI(cancelAnimation)(rotateX);
        };
    }, [intervalMs, triggerOffset]);

    // ─── STYLE ───────────────────────────────────────────────────
    const animatedStyle = useAnimatedStyle(() => {
        const half = halfHeight.value;
        return {
            opacity: launchOpacity.value,
            transform: [
                { perspective: 500 },
                { translateY: -half },
                { rotateX: `${rotateX.value}deg` },
                { translateY: half + launchTranslateY.value },
            ],
        };
    });

    return { onLayout, animatedStyle };
}