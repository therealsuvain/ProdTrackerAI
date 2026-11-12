import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAudioPlayer, type AudioSource } from "expo-audio";

export type LightningAudioSources = {
  /** Sharp electrical crack / strike transient. */
  strike?: AudioSource | null;
  /** Lower, delayed thunder rumble. */
  thunder?: AudioSource | null;
};

/**
 * Audio is optional until final recordings are selected. Pass static Metro
 * require() values when the assets are ready; null sources safely remain silent.
 */
export function useLightningStrikerAudio(sources: LightningAudioSources = {}) {
  const strikeSource = sources.strike ?? null;
  const thunderSource = sources.thunder ?? null;
  const strikePlayer = useAudioPlayer(strikeSource);
  const thunderPlayer = useAudioPlayer(thunderSource);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const schedule = useCallback(
    (
      player: typeof strikePlayer,
      source: AudioSource | null,
      delayMs: number,
      volume: number,
    ) => {
      if (!source) return;

      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        try {
          player.volume = Math.max(0, Math.min(1, volume));
          void player.seekTo(0).then(() => player.play()).catch(() => player.play());
        } catch {
          // Audio is decorative; a playback failure must not interrupt the egg.
        }
      }, Math.max(0, delayMs));

      timersRef.current.add(timer);
    },
    [],
  );

  const playStrike = useCallback(
    (delayMs: number, volume = 0.9) =>
      schedule(strikePlayer, strikeSource, delayMs, volume),
    [schedule, strikePlayer, strikeSource],
  );

  const playThunder = useCallback(
    (delayMs: number, volume = 0.65) =>
      schedule(thunderPlayer, thunderSource, delayMs, volume),
    [schedule, thunderPlayer, thunderSource],
  );

  const stopAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    try {
      strikePlayer.pause();
      thunderPlayer.pause();
      void strikePlayer.seekTo(0).catch(() => undefined);
      void thunderPlayer.seekTo(0).catch(() => undefined);
    } catch {
      // Ignore cleanup errors from players without a loaded source.
    }
  }, [strikePlayer, thunderPlayer]);

  useEffect(() => stopAll, [stopAll]);

  return useMemo(
    () => ({ playStrike, playThunder, stopAll }),
    [playStrike, playThunder, stopAll],
  );
}
