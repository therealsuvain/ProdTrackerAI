import { usePlaySound } from "@/hooks/use-play-sound";
import { useCallback } from "react";
import { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";


export function useHabitDeniedFeedback() {
    const shakeX = useSharedValue(0);
    const deniedAudioSource = require("@/assets/audio/habit-denied.m4a");
    const deniedPlayer = usePlaySound(deniedAudioSource, 0.2);

    const playDeniedFeedback = useCallback(async () => {
        // Shake: 7 rapid left-right swings with decaying amplitude
        // withSequence chains withTiming calls on the UI thread — no setState,
        // no re-renders, pure animation.
        shakeX.value = withSequence(
            withTiming(-10, { duration: 60, easing: Easing.linear }),
            withTiming(10, { duration: 60, easing: Easing.linear }),
            withTiming(-8, { duration: 60, easing: Easing.linear }),
            withTiming(8, { duration: 60, easing: Easing.linear }),
            withTiming(-5, { duration: 60, easing: Easing.linear }),
            withTiming(5, { duration: 55, easing: Easing.linear }),
            withTiming(-3, { duration: 50, easing: Easing.linear }),
            withTiming(0, { duration: 50, easing: Easing.linear }),
        );

        // Sound
        try {
            deniedPlayer.seekTo(0);
            deniedPlayer.play();
        } catch (_) { }
    }, [shakeX, deniedPlayer]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeX.value }],
    }));

    return { playDeniedFeedback, animatedStyle };
}
