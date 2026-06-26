import { cancelReminder, scheduleReminderEvents, scheduleReminderHabits, scheduleReminderTasks } from '@/hooks/use-notifications';
import { AIActionContext, AIHandler } from '@/types/ai-handler';
import { InverseAction } from '@/types/ai-undo-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Module-scoped state for encapsulated O(1) LIFO queue access
const MEMORY_STORAGE_KEY = '@prodtracker_ai_undo_stack';
const MAX_UNDO_DEPTH = 10;
let undoStack: Array<InverseAction> = [];

const persistStackToDisk = async () => {
    try {
        const serialized = JSON.stringify(undoStack);
        await AsyncStorage.setItem(MEMORY_STORAGE_KEY, serialized);
    } catch (error) {
        console.error("AI Memory Write-Behind Failed:", error);
    }
};

export const AIActionMemory = {
    init: async () => {
        try {
            const stored = await AsyncStorage.getItem(MEMORY_STORAGE_KEY);
            if (stored) {
                undoStack = JSON.parse(stored);
            }
        } catch (error) {
            console.error("Failed to hydrate AI Memory from disk:", error);
            undoStack = []; // Fallback to safe state
        }
    },
    /**
     * Pushes a deterministic reversal payload to the memory stack.
     * Enforces a strict boundary to prevent memory leaks in long sessions.
     */
    push: (action: InverseAction) => {
        if (undoStack.length >= MAX_UNDO_DEPTH) {
            undoStack.shift(); // Evict oldest
        }
        // SOTA: Use structuredClone to ensure we save by value, not by reference.
        // This guarantees the history snapshot remains immutable.
        undoStack.push(structuredClone(action));
        // Fire and forget persistence
        persistStackToDisk();
    },

    /** O(1) retrieval of the last action */
    pop: (): InverseAction | null => {
        const lastAction = undoStack.pop() || null;

        if (lastAction) persistStackToDisk(); // Update disk to reflect the pop

        return lastAction;
    },

    getDepth: () => undoStack.length,

    clear: () => {
        undoStack = [];
        persistStackToDisk();
    }
};

export const RevertLastActionHandler: AIHandler = {
    execute: async (params, context: AIActionContext) => {
        let stepsToUndo = Math.max(1, Math.min(params.steps || 1, 10));

        const availableDepth = AIActionMemory.getDepth();
        if (availableDepth === 0) {
            return { output: "There is nothing in the recent memory to undo." };
        }

        // Cap steps if the user asks to undo more than what's available
        if (stepsToUndo > availableDepth) {
            stepsToUndo = availableDepth;
        }
        let successfulUndos = 0;
        // SOTA: Deterministic execution. The LLM does NOT reason about how to undo.
        try {
            for (let i = 0; i < stepsToUndo; i++) {
                const lastAction = AIActionMemory.pop();

                if (!lastAction) {
                    break;
                }
                switch (lastAction.type) {
                    case 'DELETE_TASK':
                        if (lastAction.payload.task.notificationId) {
                            await cancelReminder(lastAction.payload.task.notificationId);
                        }
                        await context.removeTask(lastAction.payload.task.id);
                        break;
                    case 'ADD_DELETED_TASK':
                        if (lastAction.payload.task.notificationId) {
                            lastAction.payload.task.notificationId = await scheduleReminderTasks(lastAction.payload.task);
                        }
                        await context.addTask(lastAction.payload.task);
                        break;
                    case 'REVERT_UPDATE_TASK':
                        if (lastAction.payload.task.notificationId) {
                            await cancelReminder(lastAction.payload.task.notificationId);
                            lastAction.payload.task.notificationId = await scheduleReminderTasks(lastAction.payload.task);
                        }
                        await context.editTask(lastAction.payload.task);
                        break;
                    case 'BATCH_REVERT_TASKS':
                        await context.batchRestoreTasks(lastAction.payload.originalTasks);
                        break;
                    case 'DELETE_HABIT':
                        if (lastAction.payload.habit.notificationId) {
                            await cancelReminder(lastAction.payload.habit.notificationId);
                        }
                        await context.removeHabit(lastAction.payload.habit.id);
                        break;
                    case 'ADD_DELETED_HABIT':
                        if (lastAction.payload.habit.notificationId) {
                            await cancelReminder(lastAction.payload.habit.notificationId);
                            lastAction.payload.habit.notificationId = await scheduleReminderHabits(lastAction.payload.habit);
                        }
                        await context.addHabit(lastAction.payload.habit);
                        break;
                    case 'REVERT_UPDATE_HABIT':
                        if (lastAction.payload.habit.notificationId) {
                            lastAction.payload.habit.notificationId = await scheduleReminderHabits(lastAction.payload.habit);
                        }
                        await context.editHabit(lastAction.payload.habit);
                        break;
                    case 'BATCH_REVERT_HABITS':
                        await context.batchRestoreHabits(lastAction.payload.originalHabits);
                        break;
                    case 'DELETE_EVENT':
                        if (lastAction.payload.event.notificationIds?.length) {
                            const cancelPromises = lastAction.payload.event.notificationIds.map((n) =>
                                cancelReminder(n.id)
                            );
                            await Promise.all(cancelPromises);
                        }
                        await context.removeEvent(lastAction.payload.event.id);
                        break;
                    case 'ADD_DELETED_EVENT':
                        if (lastAction.payload.event.reminder) {
                            try {
                                lastAction.payload.event.notificationIds = await scheduleReminderEvents(lastAction.payload.event);
                            } catch (error) {
                                console.warn("Failed to schedule event notifications:", error);
                                return { status: "partial_success", reason: "Failed to schedule notification", event: lastAction.payload.event };
                            }
                        }
                        await context.addEvent(lastAction.payload.event);
                        break;
                    case 'REVERT_UPDATE_EVENT':
                        if (lastAction.payload.event.notificationIds?.length) {
                            const cancelPromises = lastAction.payload.event.notificationIds.map((n) =>
                                cancelReminder(n.id)
                            );
                            await Promise.all(cancelPromises);
                            lastAction.payload.event.notificationIds = await scheduleReminderEvents(lastAction.payload.event);
                        }
                        await context.editEvent(lastAction.payload.event);
                        break;
                    case 'BATCH_REVERT_EVENTS':
                        await context.batchRestoreEvents(lastAction.payload.originalEvents);
                        break;
                    default:
                        console.warn("Unhandled inverse action type:", (lastAction as any).type);
                        return { error: "Could not process the undo command for this specific action type." };
                }
                successfulUndos++;
            }
            return {
                output: successfulUndos === 1
                    ? "Action successfully reverted."
                    : `Successfully reverted the last ${successfulUndos} actions.`
            };
        } catch (error) {
            console.error("Undo execution failed:", error);
            return { error: "Failed to revert the action due to a database error." };
        }
    }
};