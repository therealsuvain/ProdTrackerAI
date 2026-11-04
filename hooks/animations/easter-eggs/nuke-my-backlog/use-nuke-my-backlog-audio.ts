import { useCallback, useEffect, useMemo, useRef } from "react";
import { setAudioModeAsync, useAudioPlayer, type AudioSource } from "expo-audio";

/**
 * Nuke My Backlog audio sources.
 *
 * Keep these as `null` until the user supplies the final sound files. Once ready,
 * replace each null with a static require(), for example:
 *   launch: require("@/assets/easter-eggs/audio/nuke-launch.mp3"),
 *
 * Static require() calls are intentional: Metro needs to discover each asset.
 */
export const NUKE_AUDIO_ASSETS: Record<
  "launch" | "flight" | "explosion" | "crash" | "screenCrack",
  AudioSource | null
> = {
  launch: require("@/assets/easter-eggs/nuke-backlog-assets/audio/launch.mp3"),
  flight: require("@/assets/easter-eggs/nuke-backlog-assets/audio/rocketthrust.mp3"),
  explosion: require("@/assets/easter-eggs/nuke-backlog-assets/audio/explosion.mp3"),
  crash: null,
  screenCrack: null,
};

export const NUKE_AUDIO_TUNING = {
  // One-shot launch sound. It plays from ignition and is allowed to finish naturally.
  launchVolume: 0.88,

  // The continuous flight sound starts once the rocket first leaves the screen.
  flightStartVolume: 0.72,
  flightStartFadeMs: 550,

  // When the rocket has been off-screen for 4.5 seconds, it sounds farther away.
  flightAwayVolume: 0.13,
  flightAwayFadeMs: 1450,

  // The loop gets louder as the rocket returns near the top of the screen.
  flightApproachVolume: 0.84,
  flightApproachFadeMs: 2400,

  // Keep the flight bed present but slightly quieter as it makes the second pass.
  flightSecondPassVolume: 0.68,
  flightSecondPassFadeMs: 650,

  // Volume for the later one-shot effects. These are independent so they can be tuned.
  explosionVolume: 1,
  crashVolume: 0.92,
  screenCrackVolume: 0.9,
};

type AudioKey = keyof typeof NUKE_AUDIO_ASSETS;
type Player = ReturnType<typeof useAudioPlayer>;
type FadeHandle = { frame: number; generation: number };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Audio controller shared by Nuke My Backlog's flight and aftermath acts. */
export function useNukeMyBacklogAudio() {
  // useAudioPlayer owns and releases these players with the hook lifecycle.
  const launchPlayer = useAudioPlayer(NUKE_AUDIO_ASSETS.launch);
  const flightPlayer = useAudioPlayer(NUKE_AUDIO_ASSETS.flight);
  const explosionPlayer = useAudioPlayer(NUKE_AUDIO_ASSETS.explosion);
  const crashPlayer = useAudioPlayer(NUKE_AUDIO_ASSETS.crash);
  const screenCrackPlayer = useAudioPlayer(NUKE_AUDIO_ASSETS.screenCrack);

  const fadeHandlesRef = useRef<Partial<Record<AudioKey, FadeHandle>>>({});
  const fadeGenerationRef = useRef<Partial<Record<AudioKey, number>>>({});

  useEffect(() => {
    // This effect configures sound effects to work in silent mode while mixing
    // with other audio. It does not request microphone or background permissions.
    if (!Object.values(NUKE_AUDIO_ASSETS).some(Boolean)) return;

    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
    }).catch((error) => {
      console.warn("[Nuke My Backlog] Could not configure audio mode.", error);
    });

    flightPlayer.loop = true;
    flightPlayer.volume = 0;

    return () => {
      Object.entries(fadeHandlesRef.current).forEach(([key, handle]) => {
        if (handle?.frame != null) cancelAnimationFrame(handle.frame);
        fadeGenerationRef.current[key as AudioKey] =
          (fadeGenerationRef.current[key as AudioKey] ?? 0) + 1;
      });
    };
  }, [flightPlayer]);

  const cancelFade = useCallback((key: AudioKey) => {
    const handle = fadeHandlesRef.current[key];
    if (handle) cancelAnimationFrame(handle.frame);
    delete fadeHandlesRef.current[key];
    fadeGenerationRef.current[key] = (fadeGenerationRef.current[key] ?? 0) + 1;
  }, []);

  const fadePlayerTo = useCallback(
    (key: AudioKey, player: Player, targetVolume: number, durationMs: number) => {
      cancelFade(key);
      const generation = fadeGenerationRef.current[key] ?? 0;
      const fromVolume = clamp01(player.volume);
      const toVolume = clamp01(targetVolume);

      if (durationMs <= 0) {
        player.volume = toVolume;
        return;
      }

      const startedAt = Date.now();
      const tick = () => {
        if (fadeGenerationRef.current[key] !== generation) return;
        const progress = clamp01((Date.now() - startedAt) / durationMs);
        // Smoothstep avoids an audible abrupt start/stop in the volume curve.
        const eased = progress * progress * (3 - 2 * progress);
        player.volume = fromVolume + (toVolume - fromVolume) * eased;

        if (progress < 1) {
          const frame = requestAnimationFrame(tick);
          fadeHandlesRef.current[key] = { frame, generation };
        } else {
          delete fadeHandlesRef.current[key];
        }
      };

      const frame = requestAnimationFrame(tick);
      fadeHandlesRef.current[key] = { frame, generation };
    },
    [cancelFade],
  );

  const playOneShot = useCallback(
    (key: Exclude<AudioKey, "flight">, player: Player, volume: number) => {
      // A null source is intentional until the corresponding asset is supplied.
      if (!NUKE_AUDIO_ASSETS[key]) return;
      cancelFade(key);
      void (async () => {
        try {
          player.volume = clamp01(volume);
          await player.seekTo(0);
          player.play();
        } catch (error) {
          console.warn(`[Nuke My Backlog] Could not play ${key} audio.`, error);
        }
      })();
    },
    [cancelFade],
  );

  const playLaunch = useCallback(() => {
    playOneShot("launch", launchPlayer, NUKE_AUDIO_TUNING.launchVolume);
  }, [launchPlayer, playOneShot]);

  const startFlightLoop = useCallback(() => {
    if (!NUKE_AUDIO_ASSETS.flight) return;
    cancelFade("flight");
    flightPlayer.loop = true;
    flightPlayer.volume = 0;
    void (async () => {
      try {
        await flightPlayer.seekTo(0);
        flightPlayer.play();
        fadePlayerTo(
          "flight",
          flightPlayer,
          NUKE_AUDIO_TUNING.flightStartVolume,
          NUKE_AUDIO_TUNING.flightStartFadeMs,
        );
      } catch (error) {
        console.warn("[Nuke My Backlog] Could not start flight loop.", error);
      }
    })();
  }, [cancelFade, fadePlayerTo, flightPlayer]);

  const fadeFlightTo = useCallback(
    (volume: number, durationMs: number) => {
      if (!NUKE_AUDIO_ASSETS.flight) return;
      fadePlayerTo("flight", flightPlayer, volume, durationMs);
    },
    [fadePlayerTo, flightPlayer],
  );

  const playExplosion = useCallback(() => {
    playOneShot("explosion", explosionPlayer, NUKE_AUDIO_TUNING.explosionVolume);
  }, [explosionPlayer, playOneShot]);

  const playCrash = useCallback(() => {
    playOneShot("crash", crashPlayer, NUKE_AUDIO_TUNING.crashVolume);
  }, [crashPlayer, playOneShot]);

  const playScreenCrack = useCallback(() => {
    playOneShot("screenCrack", screenCrackPlayer, NUKE_AUDIO_TUNING.screenCrackVolume);
  }, [playOneShot, screenCrackPlayer]);

  const stopAll = useCallback(() => {
    const activePlayers: Array<[AudioKey, Player]> = [
      ["launch", launchPlayer],
      ["flight", flightPlayer],
      ["explosion", explosionPlayer],
      ["crash", crashPlayer],
      ["screenCrack", screenCrackPlayer],
    ];

    activePlayers.forEach(([key, player]) => {
      cancelFade(key);
      if (!NUKE_AUDIO_ASSETS[key]) return;
      player.pause();
      player.volume = key === "flight" ? 0 : 1;
      if (key === "flight") player.loop = true;
      void player.seekTo(0).catch(() => undefined);
    });
  }, [cancelFade, crashPlayer, explosionPlayer, flightPlayer, launchPlayer, screenCrackPlayer]);

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
    [fadeFlightTo, playCrash, playExplosion, playLaunch, playScreenCrack, startFlightLoop, stopAll],
  );
}
