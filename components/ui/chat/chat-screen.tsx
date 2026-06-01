import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "expo-router";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";

import { DbErrorToast, useDbErrorToast } from "@/components/db-error-toast";
import { ThemeContext } from "@/context/ThemeContext";
import { useChat } from "@/hooks/use-chat";
import { useData } from "@/hooks/use-data";
import { useEvents } from "@/hooks/use-events";
import { useHabits } from "@/hooks/use-habits";
import { usePlaySound } from "@/hooks/use-play-sound";
import { useTasks } from "@/hooks/use-tasks";
import { useTimer } from "@/hooks/use-timer";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Message } from "@/types/chat";
import { agenticExecutor, processCommandAgentic } from "@/utils/ai-utils";
import { injectDaySeparators } from "@/utils/chat-utils";
import Ionicons from "@expo/vector-icons/build/Ionicons";
import { ChatInput } from "./chat-input";
import { DaySeparator } from "./day-seperator";
//import { LoadingBubble } from "./loading-bubble";
import { LoadingBubble } from "./loading-bubble-liquid";
//import { LoadingBubble } from "./loading-bubble-shimmer";

import { MessageBubble } from "./message-bubble";
import { Habit } from "@/types/habits";
import { Task } from "@/types/task";
import { CalendarEvent } from "@/types/calendar";
import { Category } from "@/types/category";
import {
  AgentPersona,
  getRandomProgressText,
} from "@/utils/AI-utils/agent-progess-persona";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}
/**
 * TODOOptim 43: use ThemeContext for colors
 * TODOOptim 44: maybe make chat-screen leaner by using chat-utils
 * TODO: Action expiry not working
 * TODOX 108: handle case where an unconfirmed action is modifiying an item, but the user manually edits as well, prevent confimation of that action
 * TODO : update Ui when all pending actions are removed, so pendingActions is empty
 */
const EXPIRY_THRESHOLD_MS = 30 * 60 * 1000; // 30 Minutes

export const ChatScreen = ({ visible, onDismiss }: Props) => {
  const headerHeight = useHeaderHeight();
  const { theme } = useContext(ThemeContext);
  const { setTitle, start, stop } = useTimer();
  const navigation = useNavigation();
  const { isLoading, startRecording, stopRecording, transcript, error } =
    useVoiceInput({});
  const { messages, setMessages, addMessage, editMessage } = useChat();
  const {
    trackMetric,
    categories,
    addCategory,
    updateUserCategory,
    incrementCategoryUsage,
    deleteUserCategory,
    getCategoryUsageForAll,
    tags,
    addTags,
    incrementTagUsage,
    updateUserTag,
    deleteUserTag,
    getTagUsageForAll,
  } = useData();
  const { tasks, addTask, editTask, removeTask, toggleTask } = useTasks();
  const { habits, addHabit, editHabit, removeHabit } = useHabits();
  const { events, addEvent, editEvent, removeEvent, deleteEventOccurrence } =
    useEvents();
  const { toastError, showToast, dismissToast } = useDbErrorToast();
  const [isThinking, setIsThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const audioSource = require("@/assets/audio/record.wav");
  const messageRef = useRef<Message[]>([]);
  const actionExpirationTimers = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const player = usePlaySound(audioSource);
  const curatedContext = {
    tasks,
    addTask,
    editTask,
    removeTask,
    toggleTask,
    habits,
    addHabit,
    editHabit,
    removeHabit,
    events,
    addEvent,
    editEvent,
    removeEvent,
    deleteEventOccurrence,
    categories,
    addCategory,
    updateUserCategory,
    incrementCategoryUsage,
    deleteUserCategory,
    getCategoryUsageForAll,
    tags,
    addTags,
    incrementTagUsage,
    updateUserTag,
    deleteUserTag,
    getTagUsageForAll,
  };
  const chatItems = useMemo(() => injectDaySeparators(messages), [messages]);
  const [agentProgress, setAgentProgress] = useState<string | null>(null);
  //const chatItems = injectDaySeparators(messages);
  //console.log(chatItems.map((m) => m.id));
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
  const playMicPressAudio = async () => {
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
    await playMicPressAudio();
    startRecording();
  };

  const handleStop = () => {
    stopRecording();
  };

  const removeIndividualAction = (messageId: string, actionIndex: number) => {
    //TODOX check this
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
  };

  const enrichAction = (call: any) => {
    const id = call.args.id || call.args.i;
    //let extraInfo = {};
    const category = call.args.category
      ? categories.find((c: any) => c.id === call.args.category)
      : undefined;
    const fallbackCategory = call.args.fallbackCategoryId
      ? categories.find((c: any) => c.id === call.args.fallbackCategoryId)
      : undefined;
    const colorMap: Record<string, string> = {
      Task: theme.taskBase,
      Habit: theme.habitBase,
      Event: theme.eventBase,
      Category: theme.blueDarkPrimary,
    };

    const color = Object.keys(colorMap).find((key) => call.name.includes(key));
    const entityMap: Record<
      string,
      {
        list: Task[] | Habit[] | CalendarEvent[] | Category[];
        pick: (item: any) => object;
      }
    > = {
      Task: {
        list: tasks,
        pick: (t) => ({
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          tags: t.tags,
        }),
      },
      Habit: {
        list: habits,
        pick: (h) => ({
          title: h.title,
          streak: h.streak,
          goal: h.goal,
          streakFreezes: h.streakFreezes,
          tags: h.tags,
        }),
      },
      Event: {
        list: events,
        pick: (e) => ({
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          startTime: e.startTime,
          endTime: e.endTime,
          tags: e.tags,
        }),
      },
      Category: {
        list: categories,
        pick: (c) => ({
          name: c.name,
          color: c.color,
          icon: c.icon,
        }),
      },
    };

    const matchedKey = Object.keys(entityMap).find((key) =>
      call.name.includes(key),
    );
    const entityInfo = matchedKey
      ? (() => {
          const { list, pick } = entityMap[matchedKey];
          let item;
          if (call.name.includes("Category")) {
            item = list.find((x: any) => x.id === id);
          } else item = list.find((x: any) => x.id.slice(0, 8) === id);
          return item ? pick(item) : {};
        })()
      : {};

    const extraInfo = {
      ...(category ? { category } : {}),
      ...(fallbackCategory ? { fallbackCategory } : {}),
      ...entityInfo,
    };

    return {
      ...call,
      color: color ? colorMap[color] : "",
      ...(Object.keys(extraInfo).length > 0 ? { extraInfo } : {}),
    };
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
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addMessage(userMsg);
    //setMessages((prev) => [userMsg, ...prev]); // Inverted list
    setAgentProgress(getRandomProgressText(AgentPersona.WAKING_UP));
    setIsThinking(true);

    try {
      const { response, calls } = await processCommandAgentic(
        text,
        {
          ...curatedContext,
          setTitle,
          start,
          stop,
          navigation,
        },
        (status) => setAgentProgress(status),
      );

      console.log("Final Accumulated Function Calls:", calls);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        type: calls && calls.length > 0 ? "action" : "text",
        text:
          (calls && calls.length > 0) || response
            ? response
              ? response
              : ""
            : "Sorry, something went wrong. Please try again.",
        pendingActions: calls,
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (aiMsg.type === "action") {
        const msgTime = new Date(aiMsg.timestamp).getTime();
        //const expiresAt = msgTime + EXPIRY_THRESHOLD_MS;
        //const expiresIn = EXPIRY_THRESHOLD_MS;
        const timer = setTimeout(() => {
          markActionExpired(aiMsg.id);
          actionExpirationTimers.current.delete(aiMsg.id);
          console.log("Timer set for : ", EXPIRY_THRESHOLD_MS);
        }, EXPIRY_THRESHOLD_MS);
        actionExpirationTimers.current.set(aiMsg.id, timer);
      }

      console.log("AI msg:", aiMsg);
      await addMessage(aiMsg);
      //setMessages((prev) => [aiMsg, ...prev]);
      trackMetric(["chatMessagesSent"], 1);
    } catch (err) {
      // Handle error UI
    } finally {
      setIsThinking(false);
      setAgentProgress(null);
    }
  };

  const markActionExpired = async (messageId: string) => {
    console.log("markActionExpired", messageId, new Date().getTime());
    const expiredMessage = messageRef.current.find((m) => m.id === messageId);
    if (!expiredMessage || !expiredMessage.pendingActions) return;
    console.log("PASSED");
    await editMessage({
      ...expiredMessage,
      isExpired: true,
      text: "This action has expired. Please try again.",
    });
    await trackMetric(["chatActionsExpired"], 1);
  };
  // 2. Handle Action Confirmation (Hardcoded Success Message)
  const handleConfirmAction = async (msgId: string, actions: any[]) => {
    // A. Disable buttons in that bubble
    const message = messages.find((m) => m.id === msgId);
    if (!message || !message.pendingActions || message.isExpired) return;
    const t = actionExpirationTimers.current.get(message.id);
    if (t) {
      clearTimeout(t);
      actionExpirationTimers.current.delete(message.id);
    }

    /*     // 1. Check for Expiry
    const isExpired =
      Date.now() - new Date(message.timestamp).getTime() > EXPIRY_THRESHOLD_MS;

    if (isExpired) {
      // Update the specific bubble to an 'expired' state
      const expiredMessage = messages.find((m) => m.id === msgId);
      if (!expiredMessage) return;
      await editMessage({ ...expiredMessage, isExpired: true });
      //  setMessages((prev) =>
      //   prev.map((m) => (m.id === msgId ? { ...m, isExpired: true } : m)),
      // ); 

      // Add a helpful AI feedback message
      const feedbackMsg: Message = {
        id: Date.now().toString(),
        sender: "ai",
        type: "text",
        text: "This action request has expired to prevent errors.⏳",
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addMessage(feedbackMsg);
      //setMessages((prev) => [feedbackMsg, ...prev]);
      trackMetric(["chatActionsExpired"], 1);
      return;
    } */
    const confirmedMessage = messages.find((m) => m.id === msgId);
    if (!confirmedMessage) return;
    await editMessage({ ...confirmedMessage, isConfirmed: true });
    /* setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m)),
    ); */
    try {
      // B. Run the background logic
      const response = await agenticExecutor(actions, {
        ...curatedContext,
        setTitle,
        start,
        stop,
        navigation,
      });
      // C. Add Hardcoded Success Message
      const successMsg: Message = {
        id: Date.now().toString(),
        sender: "ai",
        type: "text",
        text: response || "Actions confirmed! ✅",
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addMessage(successMsg);
      //setMessages((prev) => [successMsg, ...prev]);
      trackMetric(["chatActionsConfirmed"], 1);
    } catch (err) {}
  };

  const handleCancelAction = async (msgId: string) => {
    const canclledMessage = messages.find((m) => m.id === msgId);
    if (!canclledMessage) return;
    await editMessage({ ...canclledMessage, isConfirmed: true });
    /*  setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isConfirmed: true } : m)),
    ); */

    const cancelMsg: Message = {
      id: Date.now().toString(),
      sender: "ai",
      type: "text",
      text: "No problem, I've cancelled those actions. ✋",
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addMessage(cancelMsg);
    //setMessages((prev) => [cancelMsg, ...prev]);
    trackMetric(["chatActionsCancelled"], 1);
  };

  // chat-screen.tsx

  const handleUpdateActionArgs = async (
    messageId: string,
    actionIndex: number,
    updatedArgs: any,
  ) => {
    // 1. Find the target message in your current 'messages' state
    const targetMessage = messages.find((m) => m.id === messageId);

    if (!targetMessage || !targetMessage.pendingActions) {
      console.warn(
        "Attempted to edit an action on a message that doesn't exist or has no actions.",
      );
      return;
    }

    // 2. Clone the pending actions to respect immutability
    const newActions = [...targetMessage.pendingActions];
    newActions[actionIndex] = {
      ...newActions[actionIndex],
      args: updatedArgs, // Inject the mutated args from the modal
    };

    // 3. Construct the fully updated Message object
    const updatedMessage = {
      ...targetMessage,
      pendingActions: newActions,
    };

    // 4. Dispatch through your DAO layer for optimistic UI + SQLite persistence
    await editMessage(updatedMessage);
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

  //! TEMP FUCNTION FOR ANIMATION TESTING

  // Temporary function to test the 3D Text Transitioner
  const runAnimationTest = async () => {
    const dummyStates = [
      "Waking up the agent...",
      "Analyzing complex request...",
      "Choosing weapons...",
      "Scouring the database...",
      "Spraying in Consistency...",
      "Double-checking the math...",
    ];

    for (let i = 0; i < dummyStates.length; i++) {
      // Set the text to trigger the 3D spring
      setAgentProgress(dummyStates[i]);

      // Wait for 2.5 seconds before triggering the next one
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    // Optional: clear it at the end to simulate completion
    setAgentProgress(null);
  };

  useEffect(() => {
    messageRef.current = messages;
  }, [messages]);
  if (!visible) return null;
  return (
    <KeyboardProvider>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
        style={{ flex: 1, backgroundColor: theme.modalBase, marginBottom: 0 }}
      >
        <FlatList
          ListEmptyComponent={EmptyState}
          keyboardShouldPersistTaps="handled"
          ref={flatListRef}
          data={chatItems}
          inverted // WhatsApp/iMessage start from bottom
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.type === "day_separator") {
              return <DaySeparator date={item.date} />;
            }
            return (
              <MessageBubble
                message={item}
                onActionConfirm={(actions) =>
                  handleConfirmAction(item.id, actions)
                }
                onActionCancel={() => handleCancelAction(item.id)}
                onRemoveIndividualAction={(actionIndex) =>
                  removeIndividualAction(item.id, actionIndex)
                }
                onEnrichAction={enrichAction}
                onUpdateAction={handleUpdateActionArgs}
              />
            );
          }}
          /*  ListHeaderComponent={
            isThinking || isLoading ? (
              <LoadingBubble isUser={isLoading} agentProgress={agentProgress} />
            ) : null
          }  */
          ListHeaderComponent={
            <LoadingBubble
              isUser={false}
              agentProgress={"agentic Progess is Key"}
            />
          }
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
          //onPress={onDismiss}
          onPress={runAnimationTest}
        >
          <Ionicons size={24} name="close-outline" color="#fff"></Ionicons>
        </Pressable>
        <DbErrorToast error={toastError} onDismiss={dismissToast} />
      </KeyboardAvoidingView>
    </KeyboardProvider>
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
