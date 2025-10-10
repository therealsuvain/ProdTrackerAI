import { useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from 'expo-file-system';
import { transcribeAudio } from "@/utils/ai-utils";
import { randomUUID } from 'expo-crypto';

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recording = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = newRecording;
      setIsRecording(true);
    } catch (err) {
      setError("Failed to start recording");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recording.current) return;
    await recording.current.stopAndUnloadAsync();
    const uri = recording.current.getURI();
    console.log("uri")
    console.log(uri)
    if (uri) {
      try {
            
        const text = await transcribeAudio(uri);
        console.log("RECORD")
        console.log(text)
        setTranscript(text);
      } catch (err) {
        setError("Transcription failed");
      }
    }
    recording.current = null;
  };
  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    error,
    setTranscript,
  };
};
