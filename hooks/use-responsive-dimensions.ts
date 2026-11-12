import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export function useResponsive() {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const safeHeight = height - insets.top - insets.bottom;

    // Screen size groups (Breakpoints)
    const isSmallScreen = width < 375 || safeHeight < 680;
    const isTablet = width >= 600;

    // Clamped horizontal & vertical scalers (prevents absurdly huge UI on tablets or tiny UI on SE)
    const scaleWidth = (size: number, min = size * 0.85, max = size * 1.15) => {
        const scaled = (width / BASE_WIDTH) * size;
        return Math.round(Math.min(Math.max(scaled, min), max));
    };

    const scaleHeight = (size: number, min = size * 0.8, max = size * 1.15) => {
        const scaled = (safeHeight / (BASE_HEIGHT - 80)) * size;
        return Math.round(Math.min(Math.max(scaled, min), max));
    };

    return {
        width,
        height,
        safeHeight,
        insets,
        isSmallScreen,
        isTablet,
        scaleWidth,
        scaleHeight,
    };
}