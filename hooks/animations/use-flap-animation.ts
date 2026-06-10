import { useEffect, useCallback } from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnUI,
} from 'react-native-reanimated';

// ✅ Standalone worklet — defined OUTSIDE component, Babel workletizes it correctly
function flapWorklet(rotateX: any) {
    'worklet';
    rotateX.value = -28;
    rotateX.value = withSpring(0, {
        damping: 0.2,
        stiffness: 25,
        mass: 0.25,
        velocity: 15,
    });
}

function launchWorklet(launchOpacity: any, launchTranslateY: any) {
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
    }, []);

    // ─── INTERVAL ────────────────────────────────────────────────
    useEffect(() => {
        const intervalRef = { id: 0 };

        const offsetTimer = setTimeout(() => {
            runOnUI(flapWorklet)(rotateX);
            intervalRef.id = setInterval(() => {
                runOnUI(flapWorklet)(rotateX);
            }, intervalMs);
        }, triggerOffset);

        return () => {
            clearTimeout(offsetTimer);
            if (intervalRef.id) clearInterval(intervalRef.id);
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