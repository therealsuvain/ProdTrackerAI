import { useState } from "react";

import { TimerDisplayProps } from "./time-display";
export const useTimerDisplayBusiness = ({ mode,isRunning }: TimerDisplayProps) => {
    const [pickerVisible, setPickerVisible] = useState(false);

    const handleTap = () => {
        if (mode === "countdown" && !isRunning) setPickerVisible(true);
    };

    return { pickerVisible, setPickerVisible, handleTap };
};