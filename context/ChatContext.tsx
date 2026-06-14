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
  getRecentContext,
  searchHistoricalActions,
} from "@/db/repositories/chat-message-repository";

import { Message } from "@/types/chat";
import { useData } from "@/hooks/context-hooks/use-data";

interface ChatContextType {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (task: Message) => Promise<void>;
  editMessage: (task: Message) => Promise<void>;
  removeMessages: () => Promise<void>;
  messageCount: () => Promise<number>;
  getImmediateContext: () => Promise<any>;
  getMoreContext: (args: any) => Promise<any>;
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

  const getImmediateContext = useCallback(async () => {
    const rawMessages = await getRecentContext();
    return rawMessages.reverse().map((row) => ({
      who: row.sender,
      said: row.text,
      time: row.timestamp,
      // Full payload preserved for immediate "Undo" requests
      executedActions: row.pendingActions
        ? JSON.parse(row.pendingActions)
        : null,
    }));
  }, []);

  const getMoreContext = useCallback(
    async (args: {
      keywords: string[];
      daysBack?: number;
      actionTypeOnly?: boolean;
    }) => {
      const daysBack = args.daysBack || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const rawMessages = await searchHistoricalActions(
        args.keywords || [],
        cutoffDate.toISOString(),
        !!args.actionTypeOnly,
      );

      return rawMessages.map((row) => {
        let truncatedActions = null;

        if (row.pendingActions) {
          const parsed = JSON.parse(row.pendingActions);
          // TRUNCATION: Protect the LLM Context Window
          truncatedActions = parsed.map((act: any) => ({
            tool: act.tool,
            id:
              act.result?.task?.id ||
              act.result?.habit?.id ||
              act.result?.event?.id,
            title: act.args?.title || act.args?.name,
          }));
        }

        return {
          time: row.timestamp,
          context: row.text,
          actions: truncatedActions,
        };
      });
    },
    [],
  );
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
        getImmediateContext,
        getMoreContext,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
