// screens/ChatScreen.tsx
import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigation } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { useHeaderHeight } from "@react-navigation/elements";

import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  BackHandler,
} from "react-native";

import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Message } from "@/types/chat";
import { LoadingBubble } from "./loading-bubble";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { processCommandAgentic, agenticExecutor } from "@/utils/ai-utils";
import Ionicons from "@expo/vector-icons/build/Ionicons";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}
/**
 * TODO 1: Expire unconfirmed actions automatically
 * TODO 2: use ThemeContext for colors
 * TODO 3: maybe make chat-screen leaner by using chat-utils
 * TODO 4: Deleted items need better placeholder data for the chat message
 */
const EXPIRY_THRESHOLD_MS = 30 * 60 * 1000; // 30 Minutes

export const ChatScreen = ({ visible, onDismiss }: Props) => {
  const headerHeight = useHeaderHeight();
  const { theme } = useContext(ThemeContext);
  const context = useData();
  const { setTitle, start, stop } = useTimer();
  const navigation = useNavigation();
  const { isLoading, startRecording, stopRecording, transcript, error } =
    useVoiceInput({});
  const { messages, setMessages } = context;
  const [isThinking, setIsThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const playedSoundRef = useRef(false);
  const audioSource = require("@/assets/audio/record.wav");
  const player = useAudioPlayer(audioSource);

  useEffect(() => {
    // Add the event listener when the component mounts or when isPortalOpen changes
    const backButtonListener = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    // Remove the event listener when the component unmounts
    return () => {
      backButtonListener.remove();
    };
  }, [visible]);
  const playStartCue = async () => {
    if (playedSoundRef.current) return;
    playedSoundRef.current = true;
    try {
      player.seekTo(0);
      player.play();
    } catch (err) {
      /* ignore */
    }
  };
  const handleBackPress = () => {
    if (visible) {
      onDismiss();
      return true; // Indicate that the event has been handled
    }
    return false; // Let the default back button behavior proceed (e.g., pop screen, exit app)
  };

  const handleStart = async () => {
    playedSoundRef.current = false;
    await playStartCue();
    startRecording();
  };

  const handleStop = () => {
    stopRecording();
  };

  const removeIndividualAction = (messageId: string, actionIndex: number) => {
    console.log(messages.filter((m) => m.id === messageId)[0].pendingActions);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId && m.pendingActions) {
          const updatedActions = [...m.pendingActions];
          updatedActions.splice(actionIndex, 1);

          // If no actions left, maybe convert the bubble to plain text or remove it
          return { ...m, pendingActions: updatedActions };
        }
        return m;
      }),
    );
    console.log(messages.filter((m) => m.id === messageId)[0].pendingActions);
  };

  const enrichAction = (call: any) => {
    const type = call.name.split("-")[1] || "task"; // e.g., 'add-habit' -> 'habit'
    const id = call.args.id || call.args.i;
    let color: string = "";
    let extraInfo = {};
    if (call.name.includes("task")) {
      color = theme.taskBase;
      const task = context.tasks.find((h: any) => h.id.slice(0, 8) === id);
      if (task) {
        extraInfo = {
          title: task.title,
          dueDate: task.dueDate,
          priority: task.priority,
        };
      }
    } else if (call.name.includes("habit")) {
      color = theme.habitBase;
      const habit = context.habits.find((h: any) => h.id.slice(0, 8) === id);
      if (habit) {
        extraInfo = {
          title: habit.title,
          streak: habit.streak,
          goal: habit.goal,
          streakFreezes: habit.streakFreezes,
        };
      }
    } else if (call.name.includes("event")) {
      color = theme.eventBase;
      const event = context.events.find((h: any) => h.id.slice(0, 8) === id);
      if (event) {
        extraInfo = {
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
        };
      }
    }
    if (Object.keys(extraInfo).length === 0) {
      return { ...call, color };
    }
    return { ...call, color, extraInfo };
  };
  // 1. Handle sending new commands
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      type: "text",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [userMsg, ...prev]); // Inverted list

    setIsThinking(true);

    try {
      const { response, calls } = await processCommandAgentic(text, {
        ...context,
        setTitle,
        start,
        stop,
        navigation,
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        type: calls && calls.length > 0 ? "action" : "text",
        text: response,
        pendingActions: calls,
        timestamp: new Date(),
      };

      setMessages((prev) => [aiMsg, ...prev]);
      context.trackMetric("chatMessagesSent", 1);
    } catch (err) {
      // Handle error UI
    } finally {
      setIsThinking(false);
    }
  };

  // 2. Handle Action Confirmation (Hardcoded Success Message)
  const handleConfirmAction = async (msgId: string, actions: any[]) => {
    // A. Disable buttons in that bubble
    const message = messages.find((m) => m.id === msgId);
    if (!message || !message.pendingActions) return;

    // 1. Check for Expiry
    const isExpired =
      Date.now() - new Date(message.timestamp).getTime() > EXPIRY_THRESHOLD_MS;

    if (isExpired) {
      // Update the specific bubble to an 'expired' state
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isExpired: true } : m)),
      );

      // Add a helpful AI feedback message
      const feedbackMsg: Message = {
        id: Date.now().toString(),
        sender: "ai",
        type: "text",
        text: "This action request has expired to prevent errors.⏳",
        timestamp: new Date(),
      };
      setMessages((prev) => [feedbackMsg, ...prev]);
      context.trackMetric("chatActionsExpired", 1);
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m)),
    );
    try {
      // B. Run the background logic
      await agenticExecutor(actions, {
        ...context,
        setTitle,
        start,
        stop,
        navigation,
      });
      //TODO: old timestamp updation
      // C. Add Hardcoded Success Message
      const successMsg: Message = {
        id: Date.now().toString(),
        sender: "ai",
        type: "text",
        text: "Actions confirmed! ✅",
        timestamp: new Date(),
      };
      setMessages((prev) => [successMsg, ...prev]);
      context.trackMetric("chatActionsConfirmed", 1);
    } catch (err) {}
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m)),
    );

    const cancelMsg: Message = {
      id: Date.now().toString(),
      sender: "ai",
      type: "text",
      text: "No problem, I've cancelled those actions. ✋",
      timestamp: new Date(),
    };
    setMessages((prev) => [cancelMsg, ...prev]);
    context.trackMetric("chatActionsCancelled", 1);
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="diamond-outline" size={60} color="#CCC" />
      <Text style={styles.emptyTitle}>Hello! I'm your AI Assistant.</Text>
      <Text style={styles.emptySubtitle}>
        You can type or use your voice to manage tasks, start timers, or check
        your habits.
      </Text>
      <View style={styles.suggestionBox}>
        <Text style={styles.suggestionText}>
          "Add a task to buy groceries at 5pm"
        </Text>
        <Text style={styles.suggestionText}>
          "Start a focus timer for 25 minutes"
        </Text>
      </View>
    </View>
  );

  if (!visible) return null;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
      style={{ flex: 1, backgroundColor: theme.modalBase, marginBottom: 0 }}
    >
      <FlatList
        ListEmptyComponent={EmptyState}
        ref={flatListRef}
        data={messages}
        inverted // WhatsApp/iMessage start from bottom
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            onActionConfirm={(actions) => handleConfirmAction(item.id, actions)}
            onActionCancel={() => handleCancelAction(item.id)}
            onRemoveIndividualAction={(actionIndex) =>
              removeIndividualAction(item.id, actionIndex)
            }
            onEnrichAction={enrichAction}
          />
        )}
        ListHeaderComponent={
          isThinking || isLoading ? <LoadingBubble isUser={isLoading} /> : null
        } // "Thinking" at the very bottom
        //ListHeaderComponentStyle={isLoading?{ alignItems: "right"}:{alignItems: "left"}}
        contentContainerStyle={{ paddingVertical: 20 }}
      />

      <ChatInput
        onSend={handleSendMessage}
        onVoiceStart={handleStart}
        onVoiceStop={handleStop}
        isLoading={isThinking}
        transcript={transcript}
      />
      <Pressable
        style={({ pressed }: { pressed: boolean }) => [
          styles.button,
          { transform: [{ scale: pressed ? 0.75 : 1 }] },
        ]}
        onPress={onDismiss}
      >
        <Ionicons size={24} name="close-outline" color="#fff"></Ionicons>
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#5f5c5c",
    zIndex: 1,
    position: "absolute",
    top: 20,
    right: 20,
    height: 30,
    width: 30,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    marginTop: "40%", // Keeps it centered in the upper-middle
    transform: [{ scale: -1 }], // Flip the entire empty state
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 20,
    textAlign: "center",
    transform: [{ scaleY: -1 }],
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
    //transform:[{ scale: -1 }],
  },
  suggestionBox: {
    marginTop: 30,
    width: "100%",
    backgroundColor: "#F9F9F9",
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    transform: [{ scale: -1 }],
  },
  suggestionText: {
    fontSize: 13,
    color: "#0084FF",
    fontStyle: "italic",
    marginVertical: 5,
    textAlign: "center",
    transform: [{ scale: -1 }],
  },
});
