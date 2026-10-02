import { useChatStore } from "@/stores/use-chat-store";
import { Message } from "@/types/chat";
import { metricsEventBus } from "@/utils/Analytics/metrics-event-bus";

export async function addMessageWithEffects(message: Message): Promise<void> {
    await useChatStore.getState().addMessage(message);
    if (message.sender === "user")
        metricsEventBus.emit("metric:track", { keys: ["chatMessagesSent"], amount: 1 });
}

export async function editMessageWithEffects(message: Message): Promise<void> {
    await useChatStore.getState().editMessage(message);
}

export async function removeMessagesWithEffects(): Promise<void> {
    await useChatStore.getState().removeMessages();
}

export async function removeIndividualActionWithEffects(
    messageId: string,
    actionIndex: number,
): Promise<void> {
    await useChatStore.getState().removeIndividualAction(messageId, actionIndex);
}

export async function messageCountWithEffects(): Promise<number> {
    return useChatStore.getState().messageCount();
}

export async function getImmediateContextWithEffects() {
    return useChatStore.getState().getImmediateContext();
}

export async function getMoreContextWithEffects(args: {
    keywords: string[];
    daysBack?: number;
    actionTypeOnly?: boolean;
}) {
    return useChatStore.getState().getMoreContext(args);
}

export async function refreshMessagesWithEffects(): Promise<Message[]> {
    return useChatStore.getState().refreshMessages();
}

/**
 * Marks a pending action message as confirmed. Cancels its expiry timer
 * as a side effect of editMessage() detecting isConfirmed=true.
 */
export async function confirmActionMessageWithEffects(messageId: string): Promise<void> {
    const message = useChatStore.getState().messages.find((m) => m.id === messageId);
    if (!message || !message.pendingActions || message.isExpired) return;
    await useChatStore.getState().editMessage({ ...message, isConfirmed: true });
    metricsEventBus.emit("metric:track", { keys: ["chatActionsConfirmed"], amount: 1 });
}

/**
 * Marks a pending action message as cancelled (reuses isConfirmed=true to
 * disable its buttons, matching the original chat-screen.tsx behavior).
 * Cancels its expiry timer as a side effect of editMessage().
 */
export async function cancelActionMessageWithEffects(messageId: string): Promise<void> {
    const message = useChatStore.getState().messages.find((m) => m.id === messageId);
    if (!message) return;
    await useChatStore.getState().editMessage({ ...message, isConfirmed: true });
    metricsEventBus.emit("metric:track", { keys: ["chatActionsCancelled"], amount: 1 });
}

/**
 * Applies edited args to one pending action within a message's pendingActions
 * array and persists the whole message. Re-arms the message's expiry timer
 * (via editMessage) since the action is still unresolved.
 */
export async function updateActionArgsWithEffects(
    messageId: string,
    actionIndex: number,
    updatedArgs: any,
): Promise<void> {
    const target = useChatStore.getState().messages.find((m) => m.id === messageId);
    if (!target || !target.pendingActions) {
        console.warn(
            "Attempted to edit an action on a message that doesn't exist or has no actions.",
        );
        return;
    }
    const newActions = [...target.pendingActions];
    newActions[actionIndex] = { ...newActions[actionIndex], args: updatedArgs };
    await useChatStore.getState().editMessage({ ...target, pendingActions: newActions });
}