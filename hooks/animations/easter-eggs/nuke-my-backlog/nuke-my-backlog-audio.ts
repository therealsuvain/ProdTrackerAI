import { useCallback, useEffect, useRef } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  type AudioSource,
} from "expo-audio";

/**
 * Nuke My Backlog audio sources.
 *
 * Keep these as null until the final audio files are selected. Once supplied,
 * replace each null with a static require(), for example:
 * launch: require("@/assets/easter-eggs/nuke-backlog-assets/audio/launch.mp3")
 *
 * Static requires are intentional: Metro needs to discover local assets at build time.
 */
const AUDIO_ASSETS: {
  launch: AudioSource | null;
  flight: AudioSource | null;
  explosion: AudioSource | null;
  crash: AudioSource | null;
  screenCrack: AudioSource | null;
} = {
  launch: require("@/assets/easter-eggs/nuke-backlog-assets/audio/launch.mp3"),
  flight: require("@/assets/easter-eggs/nuke-backlog-assets/audio/rocketthrust.mp3"),
  explosion: require("@/assets/easter-eggs/nuke-backlog-assets/audio/explosion.mp3"),
  crash: null,
  screenCrack: null,
};

const DEFAULTS = {
  launchVolume: 0.9,
  flightVolume: 0.82,
  fadeTickMs: 50,
};

type Player = ReturnType<typeof useAudioPlayer>;

export function useNukeMyBacklogAudio() {
  // Players are created once and automatically released by expo-audio on unmount.
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
    async (player: Player, source: AudioSource | null, volume = 1) => {
      if (!source) return;
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

  const playLaunch = useCallback(() => {
    void playOneShot(launchPlayer, AUDIO_ASSETS.launch, DEFAULTS.launchVolume);
  }, [launchPlayer, playOneShot]);

  const startFlightLoop = useCallback(async () => {
    if (!AUDIO_ASSETS.flight) return;
    await prepareAudioMode();
    try {
      clearFade();
      flightPlayer.pause();
      await flightPlayer.seekTo(0);
      flightPlayer.loop = true;
      flightPlayer.volume = DEFAULTS.flightVolume;
      flightPlayer.play();
    } catch (error) {
      console.warn("[Nuke My Backlog] Could not start the flight loop.", error);
    }
  }, [clearFade, flightPlayer, prepareAudioMode]);

  /** Smoothly change the looping flight bed without restarting it. */
  const fadeFlightTo = useCallback(
    (targetVolume: number, durationMs: number) => {
      if (!AUDIO_ASSETS.flight) return;
      clearFade();
      const from = flightPlayer.volume;
      const to = Math.max(0, Math.min(1, targetVolume));
      const startedAt = Date.now();
      const duration = Math.max(1, durationMs);

      fadeTimerRef.current = setInterval(() => {
        const progress = Math.min(1, (Date.now() - startedAt) / duration);
        // Smoothstep easing avoids an abrupt linear-feeling volume ramp.
        const eased = progress * progress * (3 - 2 * progress);
        flightPlayer.volume = from + (to - from) * eased;
        if (progress >= 1) clearFade();
      }, DEFAULTS.fadeTickMs);
    },
    [clearFade, flightPlayer],
  );

  const playExplosion = useCallback(() => {
    void playOneShot(explosionPlayer, AUDIO_ASSETS.explosion, 1);
  }, [explosionPlayer, playOneShot]);

  const playCrash = useCallback(() => {
    void playOneShot(crashPlayer, AUDIO_ASSETS.crash, 1);
  }, [crashPlayer, playOneShot]);

  const playScreenCrack = useCallback(() => {
    void playOneShot(screenCrackPlayer, AUDIO_ASSETS.screenCrack, 1);
  }, [screenCrackPlayer, playOneShot]);

  const stopAll = useCallback(() => {
    clearFade();
    [
      launchPlayer,
      flightPlayer,
      explosionPlayer,
      crashPlayer,
      screenCrackPlayer,
    ].forEach((player) => {
      player.pause();
      player.volume = 1;
      void player.seekTo(0).catch(() => undefined);
    });
  }, [
    clearFade,
    launchPlayer,
    flightPlayer,
    explosionPlayer,
    crashPlayer,
    screenCrackPlayer,
  ]);

  useEffect(() => stopAll, [stopAll]);

  return {
    playLaunch,
    startFlightLoop,
    fadeFlightTo,
    playExplosion,
    playCrash,
    playScreenCrack,
    stopAll,
  };
}
