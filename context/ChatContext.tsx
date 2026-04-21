import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import {
  getAllMessages,
  insertMessage,
  updateMessage,
  countMessages,
  deleteAllMessages,
} from "@/db/repositories/chat-message-repository";

import { Message } from "@/types/chat";
import { useData } from "@/hooks/use-data";

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (task: Message) => Promise<void>;
  editMessage: (task: Message) => Promise<void>;
  removeMessages: () => Promise<void>;
  messageCount: () => Promise<number>;
}

export const ChatContext = createContext<ChatContextType | undefined>(
  undefined,
);

export default function ChatProvider({ children }: { children: ReactNode }) {
  const { dispatchError, trackMetric } = useData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);

  const optimisticMessageMutation = useCallback(
    async (
      optimisticUpdate: (prev: Message[]) => Message[],
      dbWrite: () => Promise<void> | Promise<Message>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: Message[] = [];
      setMessages((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setMessages(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[DataContext] Message DB write failed, rolling back:",
          err,
        );
        setMessages(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addMessage = useCallback(
    async (message: Message): Promise<void> => {
      await optimisticMessageMutation(
        (prev) => [message, ...prev],
        () => insertMessage(message),
      );
    },
    [optimisticMessageMutation],
  );

  const editMessage = useCallback(
    async (message: Message): Promise<void> => {
      console.log("Editing into expiry:", message.type, message.isExpired, message.id);
      await optimisticMessageMutation(
        (prev) => prev.map((m) => (m.id === message.id ? message : m)),
        () => updateMessage(message),
      );
    },
    [optimisticMessageMutation],
  );

  const removeMessages = useCallback(async () => {
    await deleteAllMessages();
    setMessages([]);
  }, []);

  const messageCount = useCallback(async (): Promise<number> => {
    const result = await countMessages();
    return result ?? 0;
  }, []);

  const auditExpiredActions = async (messages: Message[]) => {
    const now = Date.now();
    const processedMessages = [];
    const expiredMessages = 0;
    for (const message of messages) {
      if (
        message.type === "action" &&
        !message.isConfirmed &&
        !message.isExpired &&
        message.pendingActions &&
        new Date(message.timestamp).getTime() + 30 * 60 * 1000 < now
      ) {
        await editMessage({
          ...message,
          isExpired: true,
          text: "This action has expired. Please try again.",
        });
      }
      processedMessages.push(message);
    }
    if (expiredMessages > 0) {
      await trackMetric(["chatActionsExpired"], expiredMessages);
    }
    return processedMessages;
  };
  useEffect(() => {
    const loadMessages = async () => {
      try {
        let loadedMessages = await getAllMessages();
        loadedMessages = await auditExpiredActions(loadedMessages);
        setMessages(loadedMessages);
      } catch (err) {
        console.error("[DataContext] Failed to initialise database:", err);
        dispatchError(
          `Failed to initialise database: ${err instanceof Error ? err.message : String(err)}`,
          "fatal",
        );
      } finally {
        // mark that initial load finished so save effects don't overwrite storage during startup
        setLoaded(true);
      }
    };
    loadMessages();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        addMessage,
        editMessage,
        removeMessages,
        messageCount,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
