import React, { useEffect } from "react";

import { AchievementToast } from "@/components/ui/achievements/achievement-toast";
import { usePlaySound } from "@/hooks/use-play-sound";
import { useAchievementStore } from "@/stores/use-achievement-store";

const audioSource = require("@/assets/audio/achievement-unlocked.mp3");

export function AchievementToastHost() {
    const badge = useAchievementStore((s) => s.activeBadge);
    const player = usePlaySound(audioSource);

    useEffect(() => {
        if (!badge) return;
        try {
            player.seekTo(0);
            player.play();
        } catch { }
    }, [badge]);

    return <AchievementToast badge={ badge } />;
}