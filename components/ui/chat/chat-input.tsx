import React, { useState, useEffect, useContext } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import {ThemeContext} from "@/context/ThemeContext";

interface Props {
  onSend: (text: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isLoading: boolean;
  transcript?: string;
}

export const ChatInput = ({
  onSend,
  onVoiceStart,
  onVoiceStop,
  isLoading,
  transcript
}: Props) => {
  const [text, setText] = useState("");
  const { theme } = useContext(ThemeContext);
  useEffect(() => {
    if (transcript) {
      setText(transcript);
    }
  }, [transcript]);
  return (
    <View style={[styles.container,{backgroundColor: theme.greyBaseSecondary}]}>
      <TextInput
        style={styles.input}
        defaultValue={text}
        onChangeText={setText}
        placeholder="Type a message..."
        multiline
      />
      <View style={styles.buttonCluster}>
        <TouchableOpacity
          onLongPress={onVoiceStart}
          onPressOut={onVoiceStop}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="microphone" size={24} color="#0084FF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            onSend(text);
            setText("");
          }}
          style={styles.iconBtn}
          disabled={!text.trim() || isLoading}
        >
          <MaterialCommunityIcons
            name="send"
            size={24}
            color={text.trim() ? "#0084FF" : "#CCC"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end", // Aligns buttons to the bottom as input grows
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    paddingBottom: Platform.OS === "ios" ? 25 : 10, // Adjust for notch
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120, // Prevents input from taking over the whole screen
    backgroundColor: "#d8d8d8",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: "#000",
    marginRight: 8,
  },
  buttonCluster: {
    flexDirection: "row",
    alignItems: "center",
    height: 40, // Match initial input height
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
});
