import { create } from "zustand";

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
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

const EXPIRY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

type ChatStoreState = {
    messages: Message[];
    loaded: boolean;

    addMessage: (message: Message) => Promise<void>;
    editMessage: (message: Message) => Promise<void>;
    removeMessages: () => Promise<void>;
    removeIndividualAction: (messageId: string, actionIndex: number) => Promise<void>;

    messageCount: () => Promise<number>;
    getImmediateContext: () => Promise<
        { who: string; said: string; time: string; executedActions: any }[]
    >;
    getMoreContext: (args: {
        keywords: string[];
        daysBack?: number;
        actionTypeOnly?: boolean;
    }) => Promise<{ time: string; context: string; actions: any }[]>;

    refreshMessages: () => Promise<Message[]>;
};

// ─── module-level expiry scheduling ──────────────────────────────────────────
// Lives in the JS module's closure, NOT in any component. Created once when
// this file is first imported, and persists for the entire app process
// lifetime — completely independent of whether chat-screen.tsx is mounted.
// This replaces both the old per-component setTimeout/Map in chat-screen.tsx
// and the old one-shot auditExpiredActions() in ChatContext.
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearExpiry(messageId: string): void {
    const timer = expiryTimers.get(messageId);
    if (timer) {
        clearTimeout(timer);
        expiryTimers.delete(messageId);
    }
}

function isPendingUnresolvedAction(message: Message): boolean {
    return (
        message.type === "action" &&
        !!message.pendingActions &&
        !message.isConfirmed &&
        !message.isExpired
    );
}

async function expireMessageWithEffects(messageId: string): Promise<void> {
    expiryTimers.delete(messageId);
    const message = useChatStore.getState().messages.find((m) => m.id === messageId);
    if (!message || !isPendingUnresolvedAction(message)) return;
    await useChatStore.getState().editMessage({
        ...message,
        isExpired: true,
        text: "This action has expired. Please try again.",
    });
    metricsEventBus.emit("metric:track", { keys: ["chatActionsExpired"], amount: 1 });
}

function scheduleExpiry(message: Message): void {
    if (!isPendingUnresolvedAction(message)) return;
    clearExpiry(message.id); // avoid duplicate timers if called twice for the same id

    const expiresAt = new Date(message.timestamp).getTime() + EXPIRY_THRESHOLD_MS;
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) {
        // Already overdue (e.g. reconciled during refreshMessages after a cold start).
        // Defer to a microtask so callers iterating over a message list aren't
        // re-entered synchronously by an editMessage call mid-iteration.
        queueMicrotask(() => expireMessageWithEffects(message.id));
        return;
    }

    const timer = setTimeout(() => expireMessageWithEffects(message.id), remaining);
    expiryTimers.set(message.id, timer);
}

// ─── store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStoreState>((set, get) => {
    const applyOptimisticMutation = async (
        optimisticUpdate: (prev: Message[]) => Message[],
        dbWrite: () => Promise<unknown>,
    ): Promise<void> => {
        let snapshot: Message[] = [];
        set((state) => {
            snapshot = state.messages;
            return { messages: optimisticUpdate(state.messages) };
        });

        try {
            await dbWrite();
        } catch (err) {
            console.error("[useChatStore] Message DB write failed, rolling back:", err);
            set({ messages: snapshot });
            throw err;
        }
    };

    return {
        messages: [],
        loaded: false,

        addMessage: async (message) => {
            await applyOptimisticMutation(
                (prev) => [message, ...prev],
                () => insertMessage(message),
            );
            scheduleExpiry(message);
        },

        editMessage: async (message) => {
            await applyOptimisticMutation(
                (prev) => prev.map((m) => (m.id === message.id ? message : m)),
                () => updateMessage(message),
            );
            if (message.isConfirmed || message.isExpired) {
                clearExpiry(message.id); // resolved one way or another — no timer needed anymore
            } else {
                scheduleExpiry(message); // covers edits to pendingActions (e.g. handleUpdateActionArgs)
            }
        },

        removeMessages: async () => {
            expiryTimers.forEach((timer) => clearTimeout(timer));
            expiryTimers.clear();
            await deleteAllMessages();
            set({ messages: [] });
        },

        removeIndividualAction: async (messageId, actionIndex) => {
            const target = get().messages.find((m) => m.id === messageId);
            if (!target || !target.pendingActions) return;
            const updatedActions = [...target.pendingActions];
            updatedActions.splice(actionIndex, 1);
            const updatedMessage = { ...target, pendingActions: updatedActions };

            await applyOptimisticMutation(
                (prev) => prev.map((m) => (m.id === messageId ? updatedMessage : m)),
                () => updateMessage(updatedMessage), // now actually persisted — previous setMessages-only version was not
            );
        },

        messageCount: async () => (await countMessages()) ?? 0,

        getImmediateContext: async () => {
            const rawMessages = await getRecentContext();
            return rawMessages.reverse().map((row) => ({
                who: row.sender,
                said: row.text,
                time: row.timestamp,
                executedActions: row.pendingActions ? JSON.parse(row.pendingActions) : null,
            }));
        },

        getMoreContext: async (args) => {
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
                    truncatedActions = parsed.map((act: any) => ({
                        tool: act.tool,
                        id: act.result?.task?.id || act.result?.habit?.id || act.result?.event?.id,
                        title: act.args?.title || act.args?.name,
                    }));
                }
                return { time: row.timestamp, context: row.text, actions: truncatedActions };
            });
        },

        // Runs once per app launch (called from wherever dBloaded fires, mirroring
        // ChatContext's old useEffect). Reconciles any actions that went overdue
        // while the app process was fully closed (timers don't survive that — only
        // wall-clock reconciliation can catch it), then re-arms live timers for
        // anything still pending. After this, zero polling for the rest of the session.
        refreshMessages: async () => {
            const loadedMessages = await getAllMessages();
            const now = Date.now();
            const reconciled: Message[] = [];
            for (const message of loadedMessages) {
                if (isPendingUnresolvedAction(message)) {
                    const expiresAt = new Date(message.timestamp).getTime() + EXPIRY_THRESHOLD_MS;
                    if (expiresAt <= now) {
                        const expired: Message = {
                            ...message,
                            isExpired: true,
                            text: "This action has expired. Please try again.",
                        };
                        await updateMessage(expired);
                        reconciled.push(expired);
                        continue;
                    }
                    reconciled.push(message);
                    scheduleExpiry(message);
                } else {
                    reconciled.push(message);
                }
            }
            set({ messages: reconciled, loaded: true });
            return reconciled;
        },
    };
});