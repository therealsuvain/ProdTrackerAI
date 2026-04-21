import { AIActionContext, AIHandler } from "../../types/ai-handler";
import { SearchItemsHandler, getProductivityStats } from './additional-handlers';
import { AddEventHandler, DeleteEventHandler, DeleteEventSingleOccurrenceHandler, EditEventHandler, QueryEventsHandler } from "./event-handler";
import { AddHabitHandler, CheckInHabitHandler, DeleteHabitHandler, QueryHabitsHandler } from "./habit-handler";
import { AddTaskHandler, CompleteTaskHandler, DeleteTaskHandler, EditTaskHandler, QueryTasksHandler } from "./task-handler";
import { QueryTimerLogsHandler, StartTimerHandler, StopTimerHandler } from "./timer-handler";

/**  
 * TODOAdd 51 : Handler that allows the AI to add a additonal custom System prompt instruction curated by the user
 * TODOAdd 52 : Handler that allows the AI to trigger a custom notification with a personalized message to the user (for reminders, encouragement, etc)
 * TODOAdd 53 : Add a "reasoning" field to the handler calls, so that when we log them, we can also log the AI's reasoning for why it called that tool, which will be helpful for debugging and future training/fine-tuning
 * TODOAdd 55 : Add error handling and edge case handling for each handler, and log any errors that occur during execution, so that we can identify common failure points and improve the system over time.
 * TODOAdd 56 :  Confidence field like response and reasoning
 * TODOAdd 57 : Add a handler so AI can access chat history and use it as context for future responses
 * TODOAdd 66 : - delete-event_instance(id, date[]), - freeze-habit(id) handlers
 */
export const SilentHandlerList: string[] = [
    "searchItems",
    "getStats",
    "queryTasks",
    "queryHabits",
    "queryEvents",
    "queryTimerLogs"
]
export const ActionRegistry: Record<string, AIHandler> = {
    "addTask": AddTaskHandler,
    "editTask": EditTaskHandler,
    "deleteTask": DeleteTaskHandler,
    "completeTask": CompleteTaskHandler,
    "addHabit": AddHabitHandler,
    "deleteHabit": DeleteHabitHandler,
    "checkinHabit": CheckInHabitHandler,
    "addEvent": AddEventHandler,
    "editEvent": EditEventHandler,
    "deleteEvent": DeleteEventHandler,
    "deleteSingleEvent": DeleteEventSingleOccurrenceHandler,
    "startTimer": StartTimerHandler,
    "stopTimer": StopTimerHandler,
    "queryTasks": QueryTasksHandler,
    "queryHabits": QueryHabitsHandler,
    "queryEvents": QueryEventsHandler,
    "queryTimerLogs": QueryTimerLogsHandler,
    "searchItems": SearchItemsHandler,
    "getStats": getProductivityStats
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

