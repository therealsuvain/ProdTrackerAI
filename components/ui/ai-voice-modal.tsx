import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  Modal,
  Portal,
  TextInput,
  Button,
  Text,
  ActivityIndicator,
} from "react-native-paper";
import { useVoiceInput } from "@/hooks/use-voice-input";
import LottieView from "lottie-react-native";

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

interface AIVoiceModalProps {
  visible: boolean;
  onDismiss: () => void;
  IntentProcessor: (transcript: string) => void;
}
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import LoadingIndicator from "../loading-indicator";

export default function AIVoiceModal({
  visible,
  onDismiss,
  IntentProcessor,
}: AIVoiceModalProps) {
  const {
    isLoading,
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    error,
    setTranscript,
  } = useVoiceInput({ IntentProcessor, onDismiss });

  // Animated rotation for spinner
  const rotate = useRef(new Animated.Value(0)).current;
  const playedSoundRef = useRef(false);
  const audioSource = require("../../assets/audio/record.wav");
  const player = useAudioPlayer(audioSource);


  // best-effort sound play (attempt expo-av) then fallback to haptics
  const playStartCue = async () => {
    if (playedSoundRef.current) return;
    playedSoundRef.current = true;
    try {
      // Best-effort haptic cue. If you want an audible cue, replace this with expo-av logic
      player.seekTo(0);
      player.play();
      await Haptics.selectionAsync();
    } catch (err) {
      /* ignore */
    }
  };

  // wrapper so we can play cue then start recording
  const handleStart = async () => {
    playedSoundRef.current = false;
    await playStartCue();
    startRecording();
  };

  const handleStop = () => {
    // stopRecording will call IntentProcessor and onDismiss (same logic as original hook usage)
    stopRecording();
  };

  // rotation interpolation
  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Portal>
      {isLoading && <LoadingIndicator />}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={styles.overlay}
        >
          <View style={styles.container}>
            <View style={styles.centerArea} pointerEvents="box-none">
              {isRecording && (
                <AnimatedLottieView
                  source={require("../../assets/lottie/GradientLoading.json")}
                  autoPlay
                  loop
                  style={{
                    width: 396,
                    height: 396,
                    position: "absolute",
                    marginBottom: 2.2,
                  }}
                />
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.micButton}
                onLongPress={handleStart}
                onPressOut={handleStop}
              >
                <Ionicons name="mic" style={styles.micIcon} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                label="Or type a command"
                mode="outlined"
                value={transcript}
                onChangeText={setTranscript}
                style={{ flex: 1, marginRight: 8 }}
                multiline
              />
            </View>
            <View style={styles.buttons}>
              <Button
                mode="contained"
                style={styles.button}
                buttonColor="#333"
                textColor="#fff"
                onPress={() => {
                  IntentProcessor(transcript);
                  onDismiss();
                }}
              >
                Process
              </Button>
              <Button
                mode="contained"
                style={styles.button}
                buttonColor="#333"
                textColor="#fff"
                onPress={() => {
                  onDismiss();
                }}
              >
                Cancel
              </Button>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "#0d0c0ea2",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
  container: {
    width: "100%",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centerArea: {
    height: 320,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    position: "absolute",
    height: 270,
    width: 270,
    borderRadius: 135,
    borderWidth: 50,
    opacity: 0.85,
  },
  micButton: {
    height: 210,
    width: 210,
    borderRadius: 105,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  micIcon: {
    fontSize: 100,
    color: "#fff",
  },
  inputRow: {
    marginTop: 24,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  buttons: {
    flexDirection: "row",
    marginTop: 16,
    width: "100%",
    justifyContent: "center",
    
  },
  button: {
    width:'50%',
    marginHorizontal: 8,
    borderWidth:2,
    borderColor: "#00000096"
  },
  loadingRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  errorText: { color: "#ff6b6b", marginTop: 8 },
});
