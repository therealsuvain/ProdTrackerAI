import { AIHandler, AIActionContext } from "../../types/ai-handler";
import { AddTaskHandler, EditTaskHandler, DeleteTaskHandler, CompleteTaskHandler, QueryTasksHandler } from "./task-handler";
import { AddHabitHandler, DeleteHabitHandler, CheckInHabitHandler, QueryHabitsHandler } from "./habit-handler";
import { AddEventHandler, EditEventHandler, DeleteEventHandler, QueryEventsHandler } from "./event-handler";
import { QueryTimerLogsHandler, StartTimerHandler, StopTimerHandler } from "./timer-handler";
import { SearchItemsHandler, getProductivityStats } from './additional-handlers';

/**  
 * TODO 50 : Add more handlers, summaries, searchs for various types of requests, maybe simple analytics 
 * TODO 51 : Handler that allows the AI to add a additonal custom System prompt instruction curated by the user
 * TODO 52 : Handler that allows the AI to trigger a custom notification with a personalized message to the user (for reminders, encouragement, etc)
 * TODO 53 : Add a "reasoning" field to the handler calls, so that when we log them, we can also log the AI's reasoning for why it called that tool, which will be helpful for debugging and future training/fine-tuning
 * TODO 54 : Add a "response" field to the handler calls, which is the raw response from the tool, so that we can log it for debugging and training/fine-tuning purposes. This is especially important for tools like "search-items" where the AI might be relying on the output to make further decisions, so having that context in the logs will be crucial.
 * TODO 55 : Add error handling and edge case handling for each handler, and log any errors that occur during execution, so that we can identify common failure points and improve the system over time.
 * TODO 56 :  Confidence field like response and reasoning
 * TODO 57 : Add a handler so AI can access chat history and use it as context for future responses
 * TODO 58 : Update handlers based on DB and type changes
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
    "query-tasks": QueryTasksHandler,
    "add-habit": AddHabitHandler,
    "delete-habit": DeleteHabitHandler,
    "checkin-habit": CheckInHabitHandler,
    "query-habits": QueryHabitsHandler,
    "add-event": AddEventHandler,
    "edit-event": EditEventHandler,
    "delete-event": DeleteEventHandler,
    "query-events": QueryEventsHandler,
    "start-timer": StartTimerHandler,
    "stop-timer": StopTimerHandler,
    "query-timer-logs": QueryTimerLogsHandler,
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

