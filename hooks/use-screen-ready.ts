import { useFocusEffect } from "@react-navigation/native";
import { InteractionManager } from "react-native";
import { useCallback, useRef, useState } from "react";

export const useScreenReady = () => {
    const [isReady, setIsReady] = useState(false);
    const hasBeenReady = useRef(false); // never reset after first ready

    useFocusEffect(
        useCallback(() => {
            if (hasBeenReady.current) return; // already ready — skip entirely
            setIsReady(false);
            const task = InteractionManager.runAfterInteractions(() => {
                hasBeenReady.current = true;
                setIsReady(true);
            });
            return () => task.cancel();
        }, [])
    );

    return isReady;
};