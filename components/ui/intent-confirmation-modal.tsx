import { AIIntent } from "@/types/ai-intent";
import { useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Modal, Portal } from "react-native-paper";
import { Button } from "react-native-paper";

interface IntentConfirmationModalProps {
  intent: AIIntent | null;
  onConfirm: () => void;
}

export function IntentConfirmationModal({
  intent,
  onConfirm,
}: IntentConfirmationModalProps) {
  const [visible, setVisible] = useState(true);
  if (intent == null) return null;
  return (
    <Portal>
      <View style={styles.container}>
        <Modal
          visible={visible}
          onDismiss={() => setVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={{ padding: 3 }}>
            <Text style={{ color: "#ffffff" }}>Intent: {intent.intent}</Text>
            <Text style={{ color: "#ffffff" }}>
              Params: {JSON.stringify(intent.params, null, 2)}
            </Text>
            <Button
              mode="contained"
              buttonColor="#999999ff"
              textColor="white"
              style={{ marginVertical: 4 }}
              onPress={onConfirm}
            >
              {"Confirm"}
            </Button>
            <Button
              mode="contained"
              buttonColor="#999999ff"
              textColor="white"
              style={{ marginVertical: 4 }}
              onPress={() => setVisible(false)}
            >
              {"Cancel"}
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#0d0c0ec5",
    padding: 20,
    margin: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1c20ff",
  },
});
