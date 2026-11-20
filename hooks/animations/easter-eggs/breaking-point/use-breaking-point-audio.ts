import { useCallback, useEffect, useRef } from "react";
import { useAudioPlayer } from "expo-audio";

import { BREAKING_POINT_TUNING } from "./breaking-point-config";

const CRACK_SOURCES = [
  require("@/assets/easter-eggs/breaking-point/crack-01.mp3"),
  require("@/assets/easter-eggs/breaking-point/crack-02.mp3"),
  require("@/assets/easter-eggs/breaking-point/crack-03.mp3"),
  require("@/assets/easter-eggs/breaking-point/crack-04.mp3"),
  require("@/assets/easter-eggs/breaking-point/crack-05.mp3"),
] as const;

const SHATTER_SOURCE = require("@/assets/easter-eggs/breaking-point/shatter.mp3");

/**
 * Keeps all six short clips loaded while the search screen is mounted, so a
 * tap does not have to create/load a native audio player at playback time.
 * Expo Audio owns player cleanup when this hook's component unmounts.
 */
export function useBreakingPointAudio() {
  const crack01 = useAudioPlayer(CRACK_SOURCES[0]);
  const crack02 = useAudioPlayer(CRACK_SOURCES[1]);
  const crack03 = useAudioPlayer(CRACK_SOURCES[2]);
  const crack04 = useAudioPlayer(CRACK_SOURCES[3]);
  const crack05 = useAudioPlayer(CRACK_SOURCES[4]);
  const shatter = useAudioPlayer(SHATTER_SOURCE);

  const previousCrackIndexRef = useRef(-1);

  useEffect(() => {
    const smallCrackVolume = BREAKING_POINT_TUNING.audio.smallCrackVolume;
    const shatterVolume = BREAKING_POINT_TUNING.audio.shatterVolume;
    crack01.volume = smallCrackVolume;
    crack02.volume = smallCrackVolume;
    crack03.volume = smallCrackVolume;
    crack04.volume = smallCrackVolume;
    crack05.volume = smallCrackVolume;
    shatter.volume = shatterVolume;
  }, [crack01, crack02, crack03, crack04, crack05, shatter]);

  const replay = useCallback(async (player: ReturnType<typeof useAudioPlayer>) => {
    try {
      await player.seekTo(0);
      player.play();
    } catch (error) {
      console.warn("[Breaking Point] Audio playback failed.", error);
    }
  }, []);

  const playSmallCrack = useCallback(() => {
    const players = [crack01, crack02, crack03, crack04, crack05] as const;
    let index = Math.floor(Math.random() * players.length);
    // Avoid hearing the same variation twice in a row when possible.
    if (index === previousCrackIndexRef.current) {
      index = (index + 1 + Math.floor(Math.random() * (players.length - 1))) % players.length;
    }
    previousCrackIndexRef.current = index;
    void replay(players[index]);
  }, [crack01, crack02, crack03, crack04, crack05, replay]);

  const playShatter = useCallback(() => {
    void replay(shatter);
  }, [replay, shatter]);

  return { playSmallCrack, playShatter };
}
