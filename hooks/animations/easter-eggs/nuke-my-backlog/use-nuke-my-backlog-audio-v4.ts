import { useCallback, useEffect, useMemo, useRef } from "react";
import { setAudioModeAsync, useAudioPlayer, type AudioSource } from "expo-audio";

const AUDIO_ASSETS: {
  launch: AudioSource;
  flight: AudioSource;
  explosion: AudioSource;
  crash: AudioSource | null;
  screenCrack: AudioSource | null;
} = {
  launch: require("@/assets/easter-eggs/nuke-backlog-assets/audio/launch.mp3"),
  flight: require("@/assets/easter-eggs/nuke-backlog-assets/audio/rocketthrust.mp3"),
  explosion: require("@/assets/easter-eggs/nuke-backlog-assets/audio/explosion.mp3"),
  crash: null,
  screenCrack: null,
};

export const NUKE_AUDIO_TUNING = {
  launchVolume: 0.9,
  flightStartVolume: 0.78,
  flightAwayVolume: 0.12,
  flightAwayFadeMs: 1600,
  flightApproachVolume: 0.84,
  flightApproachFadeMs: 2100,
  fadeTickMs: 40,
};

type Player = ReturnType<typeof useAudioPlayer>;

export function useNukeMyBacklogAudio() {
  const launchPlayer = useAudioPlayer(AUDIO_ASSETS.launch);
  const flightPlayer = useAudioPlayer(AUDIO_ASSETS.flight);
  const explosionPlayer = useAudioPlayer(AUDIO_ASSETS.explosion);
  const crashPlayer = useAudioPlayer(AUDIO_ASSETS.crash);
  const screenCrackPlayer = useAudioPlayer(AUDIO_ASSETS.screenCrack);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioModeReadyRef = useRef(false);

  const prepareAudioMode = useCallback(async () => {
    if (audioModeReadyRef.current) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      });
      audioModeReadyRef.current = true;
    } catch (error) {
      console.warn("[Nuke My Backlog] Could not configure audio mode.", error);
    }
  }, []);

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = null;
  }, []);

  const playOneShot = useCallback(
    async (player: Player, volume = 1) => {
      await prepareAudioMode();
      try {
        player.pause();
        await player.seekTo(0);
        player.loop = false;
        player.volume = volume;
        player.play();
      } catch (error) {
        console.warn("[Nuke My Backlog] Could not play an audio cue.", error);
      }
    },
    [prepareAudioMode],
  );

  const playLaunch = useCallback(async () => {
    await playOneShot(launchPlayer, NUKE_AUDIO_TUNING.launchVolume);
  }, [launchPlayer, playOneShot]);

  const startFlightLoop = useCallback(async () => {
    await prepareAudioMode();
    try {
      clearFade();
      flightPlayer.pause();
      await flightPlayer.seekTo(0);
      flightPlayer.loop = true;
      flightPlayer.volume = NUKE_AUDIO_TUNING.flightStartVolume;
      flightPlayer.play();
    } catch (error) {
      console.warn("[Nuke My Backlog] Could not start the flight loop.", error);
    }
  }, [clearFade, flightPlayer, prepareAudioMode]);

  const fadeFlightTo = useCallback(
    (targetVolume: number, durationMs: number) => {
      clearFade();
      const from = flightPlayer.volume;
      const to = Math.max(0, Math.min(1, targetVolume));
      const startedAt = Date.now();
      const duration = Math.max(1, durationMs);
      fadeTimerRef.current = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        flightPlayer.volume = from + (to - from) * eased;
        if (progress >= 1) clearFade();
      }, NUKE_AUDIO_TUNING.fadeTickMs);
    },
    [clearFade, flightPlayer],
  );

  const playExplosion = useCallback(() => {
    void playOneShot(explosionPlayer, 1);
  }, [explosionPlayer, playOneShot]);
  const playCrash = useCallback(() => {
    if (AUDIO_ASSETS.crash) void playOneShot(crashPlayer, 1);
  }, [crashPlayer, playOneShot]);
  const playScreenCrack = useCallback(() => {
    if (AUDIO_ASSETS.screenCrack) void playOneShot(screenCrackPlayer, 1);
  }, [screenCrackPlayer, playOneShot]);

  const stopAll = useCallback(() => {
    clearFade();
    [launchPlayer, flightPlayer, explosionPlayer, crashPlayer, screenCrackPlayer].forEach((player) => {
      player.pause();
      player.volume = 1;
      void player.seekTo(0).catch(() => undefined);
    });
  }, [clearFade, launchPlayer, flightPlayer, explosionPlayer, crashPlayer, screenCrackPlayer]);

  useEffect(() => stopAll, [stopAll]);

  // The animation hook depends on this object in cleanup/callback effects.
  // Keep its identity stable so ordinary React state updates cannot trigger
  // an accidental cleanup and cancel a flight that is still running.
  return useMemo(
    () => ({
      playLaunch,
      startFlightLoop,
      fadeFlightTo,
      playExplosion,
      playCrash,
      playScreenCrack,
      stopAll,
    }),
    [
      playLaunch,
      startFlightLoop,
      fadeFlightTo,
      playExplosion,
      playCrash,
      playScreenCrack,
      stopAll,
    ],
  );
}
