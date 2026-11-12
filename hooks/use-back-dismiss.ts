import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Intercepts the Android hardware/gesture back button when `isOpen` is true
 * and runs `onClose` instead of navigating back in the router.
 */
export function useBackDismiss(isOpen: boolean, onClose: () => void) {
    useEffect(() => {
        if (!isOpen || Platform.OS !== "android") return;

        const subscription = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onClose();
                return true; // `true` stops the event from bubbling to Expo Router!
            }
        );

        return () => subscription.remove();
    }, [isOpen, onClose]);
}