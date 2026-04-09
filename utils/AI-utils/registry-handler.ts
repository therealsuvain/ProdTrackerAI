import { AIHandler, AIActionContext } from "../../types/ai-handler";
import { AddTaskHandler, EditTaskHandler, DeleteTaskHandler, CompleteTaskHandler, QueryTasksHandler } from "./task-handler";
import { AddHabitHandler, DeleteHabitHandler, CheckInHabitHandler, QueryHabitsHandler } from "./habit-handler";
import { AddEventHandler, EditEventHandler, DeleteEventHandler, QueryEventsHandler } from "./event-handler";
import { QueryTimerLogsHandler, StartTimerHandler, StopTimerHandler } from "./timer-handler";
import { SearchItemsHandler, getProductivityStats } from './additional-handlers';

/**  
 * TODOAdd 50 : Add more handlers, summaries, searchs for various types of requests, maybe simple analytics 
 * TODOAdd 51 : Handler that allows the AI to add a additonal custom System prompt instruction curated by the user
 * TODOAdd 52 : Handler that allows the AI to trigger a custom notification with a personalized message to the user (for reminders, encouragement, etc)
 * TODOAdd 53 : Add a "reasoning" field to the handler calls, so that when we log them, we can also log the AI's reasoning for why it called that tool, which will be helpful for debugging and future training/fine-tuning
 * TODOAdd 54 : Add a "response" field to the handler calls, which is the raw response from the tool, so that we can log it for debugging and training/fine-tuning purposes. This is especially important for tools like "search-items" where the AI might be relying on the output to make further decisions, so having that context in the logs will be crucial.
 * TODOAdd 55 : Add error handling and edge case handling for each handler, and log any errors that occur during execution, so that we can identify common failure points and improve the system over time.
 * TODOAdd 56 :  Confidence field like response and reasoning
 * TODOAdd 57 : Add a handler so AI can access chat history and use it as context for future responses
 * TODOAdd 66 : - delete-event_instance(id, date[]), - freeze-habit(id) handlers
 * TODOAdd 67 : Add success/error feedback for all handlers
 */
export const SilentHandlerList: string[] = [
    "search-items",
    "get-stats",
    "query-tasks",
    "query-habits",
    "query-events",
    "query-timer-logs"
]
export const ActionRegistry: Record<string, AIHandler> = {
    "add-task": AddTaskHandler,
    "edit-task": EditTaskHandler,
    "delete-task": DeleteTaskHandler,
    "complete-task": CompleteTaskHandler,
    "add-habit": AddHabitHandler,
    "delete-habit": DeleteHabitHandler,
    "checkin-habit": CheckInHabitHandler,
    "add-event": AddEventHandler,
    "edit-event": EditEventHandler,
    "delete-event": DeleteEventHandler,
    "start-timer": StartTimerHandler,
    "stop-timer": StopTimerHandler,
    "query-timer-logs": QueryTimerLogsHandler,
    "query-tasks": QueryTasksHandler,
    "query-habits": QueryHabitsHandler,
    "query-events": QueryEventsHandler,
    "search-items": SearchItemsHandler,
    "get-stats": getProductivityStats
};

export const executeActions = async (
    intents: any | any[],
    context: AIActionContext
) => {
    const intentList = Array.isArray(intents) ? intents : [intents];

    for (const item of intentList) {
        const handler = ActionRegistry[item.intent];
        if (handler) {
            console.log(`Executing: ${item.intent} with reasoning: ${item.reasoning}`);
            await handler.execute(item.params, context);
        } else {
            console.warn(`No handler found for: ${item.intent}`);
        }
    }
};

