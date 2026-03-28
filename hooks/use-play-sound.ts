import { AudioSource, useAudioPlayer } from "expo-audio";
import { useEffect } from "react";

export const usePlaySound = (
  source: AudioSource,
  volume = 1,
  loop = false,
) => {

  const audioPlayer = useAudioPlayer(source);

  useEffect(() => {
    audioPlayer.volume = volume;
    audioPlayer.loop = loop;
  }, [volume, loop]);

  return audioPlayer;
};