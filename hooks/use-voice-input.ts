import { useRef, useState, useEffect } from "react";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions
} from "expo-audio";
import { transcribeAudio } from "@/utils/ai-utils";
import { Alert } from "react-native";

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const recordingOptions: RecordingOptions = {
 extension: '.wav',
  sampleRate: 44100,
  numberOfChannels: 2,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

  const audioRecorder = useAudioRecorder(recordingOptions);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission to access microphone was denied");
        setError("Microphone permission not granted");
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);
const startRecording = async () => {
    try {
      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsLoading(true)
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        const text = await transcribeAudio(uri);
        setTranscript(text);
        setIsLoading(false)
      } else {
        setError('No recording URI available');
      }
    } catch (err) {
      setError('Transcription failed');
    }
  };

  return {
    isLoading,
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    error,
    setTranscript,
  };
};
