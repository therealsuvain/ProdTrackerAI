import { useCallback } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

// ─── TUNING ──────────────────────────────────────────────────────
// Same natural frequency as your old config (sqrt(25 / 0.25) = 10 rad/s) so the
// swing speed feels identical. Only damping changes: 0.2 -> 1.25 (damping ratio
// 0.04 -> 0.25). Still swings back and forth ~4 times, but comes to rest in ~2s
// instead of ringing for 10-20s. Lower damping = more swings, higher = fewer.
const FLAP_SPRING = { mass: 0.25, stiffness: 25, damping: 0.5 };

const ENTER_MARGIN = 24;   // px the title must be inside the viewport before it flaps
const COOLDOWN_MS = 500;   // stops re-triggering when scroll jitters around the edge
const MIN_AMP = 10;        // degrees at slow scroll
const MAX_AMP = 42;        // degrees at fast fling
const LAUNCH_AMP = 26;     // degrees when it appears without scrolling (first load)
const SLOW_SPEED = 0.1;    // px/ms  -> MIN_AMP
const FAST_SPEED = 2.5;    // px/ms  -> MAX_AMP

// ─── SCREEN LEVEL: one per ScrollView ────────────────────────────
// Everything here runs on the UI thread. No JS timers, no runOnUI.
export function useFlapScroll() {
    const scrollY = useSharedValue(0);
    const viewportH = useSharedValue(0);
    const velocity = useSharedValue(0); // px/ms, signed (+ = scrolling down)
    const lastY = useSharedValue(0);
    const lastT = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            const y = e.contentOffset.y;
            const now = Date.now();
            const dt = now - lastT.value;

            if (dt > 150) {
                // first event of a new gesture: no meaningful velocity yet
                velocity.value = 0;
                lastY.value = y;
                lastT.value = now;
            } else if (dt >= 8) {
                const instant = (y - lastY.value) / dt;
                velocity.value = velocity.value * 0.6 + instant * 0.4; // smooth
                lastY.value = y;
                lastT.value = now;
            }

            scrollY.value = y;
            if (viewportH.value === 0) viewportH.value = e.layoutMeasurement.height;
        },
        onMomentumEnd: () => {
            velocity.value = 0;
        },
    });

    const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
        viewportH.value = e.nativeEvent.layout.height;
    }, []);

    // call when the ScrollView is (re)mounted so stale offsets don't linger
    const reset = useCallback(() => {
        scrollY.value = 0;
        velocity.value = 0;
        lastY.value = 0;
        lastT.value = 0;
    }, []);

    return { scrollY, viewportH, velocity, scrollHandler, onViewportLayout, reset };
}

export type FlapScroll = ReturnType<typeof useFlapScroll>;

// ─── TITLE LEVEL: one per Animated.Text ──────────────────────────
export function useFlapTitle(scroll: FlapScroll) {
    const top = useSharedValue(0);      // y inside the ScrollView content
    const height = useSharedValue(0);
    const rotateX = useSharedValue(0);
    const opacity = useSharedValue(0);
    const lift = useSharedValue(14);
    const lastFlap = useSharedValue(0);
    const revealed = useSharedValue(false);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { y, height: h } = e.nativeEvent.layout;
        top.value = y;
        height.value = h;
    }, []);

    useAnimatedReaction(
        () => {
            const vh = scroll.viewportH.value;
            const h = height.value;
            if (vh === 0 || h === 0) return false;
            const y = scroll.scrollY.value;
            const t = top.value;
            return t < y + vh - ENTER_MARGIN && t + h > y;
        },
        (inView, wasInView) => {
            // fire only on the false -> true edge ("title just scrolled in")
            if (!inView || wasInView) return;

            if (!revealed.value) {
                revealed.value = true;
                opacity.value = withTiming(1, { duration: 400 });
                lift.value = withSpring(0, { damping: 18, stiffness: 180 });
            }

            const now = Date.now();
            if (now - lastFlap.value < COOLDOWN_MS) return;
            lastFlap.value = now;

            const v = scroll.velocity.value;
            const speed = Math.abs(v);
            const amp =
                speed < 0.02
                    ? LAUNCH_AMP
                    : interpolate(speed, [SLOW_SPEED, FAST_SPEED], [MIN_AMP, MAX_AMP], Extrapolation.CLAMP);
            const dir = v < 0 ? 1 : -1; // scrolling up kicks the other way

            // assigning cancels any spring still running, so no stacking
            rotateX.value = dir * amp;
            rotateX.value = withSpring(0, FLAP_SPRING);
        },
    );

    // identical transform to your original: hinge at the top edge
    const animatedStyle = useAnimatedStyle(() => {
        const half = height.value / 2;
        return {
            opacity: opacity.value,
            transform: [
                { perspective: 500 },
                { translateY: -half },
                { rotateX: `${rotateX.value}deg` },
                { translateY: half + lift.value },
            ],
        };
    });

    return { onLayout, animatedStyle };
}