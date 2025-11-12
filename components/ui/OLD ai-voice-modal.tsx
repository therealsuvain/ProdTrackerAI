import { useIntentProcessor } from "@/hooks/use-intent-processor";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Text, View, StyleSheet } from "react-native";
import { Modal, TextInput, Portal, Button, ActivityIndicator } from "react-native-paper";
import LoadingIndicator from "../loading-indicator";

interface AIVoiceModalProps {
  visible: boolean;
  onDismiss: () => void;
  IntentProcessor: (transcript: string) => void;
}

export function AIVoiceModal({
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
  } = useVoiceInput({IntentProcessor, onDismiss});

  const handleSubmit = () => {
    IntentProcessor(transcript);
    onDismiss();
  };

  return (
    <Portal>
      {isLoading && <LoadingIndicator/>}
      <View style={styles.container}>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          contentContainerStyle={styles.modal}
        >
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 24, color: "#ffff" }}>
              {isRecording ? "Recording..." : "Speak or type command"}
            </Text>
            <Button
              mode="contained"
              buttonColor="#999999ff"
              textColor="white"
              style={{ marginVertical: 4 }}
              onLongPress={startRecording}
              onPressOut = {()=>{stopRecording()}}
            >
              {isRecording ? "Stop" : "Start"}
            </Button>
            <TextInput
              placeholder="Or type here"
              value={transcript}
              onChangeText={setTranscript}
              mode="outlined"
              multiline
            />
            {error && <Text>Error : {error}</Text>}
            <Button
              mode="contained"
              style={{ marginVertical: 4 }}
              buttonColor="#999999ff"
              textColor="white"
              onPress={handleSubmit}
            >
              {"Process"}
            </Button>
          </View>
        </Modal>
      </View>
    </Portal>
  );
}
const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
  },
  modal: {
    backgroundColor: "#0d0c0ec5",
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
});
