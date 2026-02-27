import { AIHandler, AIActionContext } from "../../types/ai-handler";
import { AddTaskHandler, EditTaskHandler, DeleteTaskHandler, CompleteTaskHandler } from "./task-handler";
import { AddHabitHandler, DeleteHabitHandler, CheckInHabitHandler } from "./habit-handler";
import { AddEventHandler, EditEventHandler, DeleteEventHandler } from "./event-handler";
import { StartTimerHandler, StopTimerHandler } from "./timer-handler";

// This will eventually hold all our handlers
const SearchTasksHandler= {
  execute: async (params:any, context:AIActionContext) => {
    // Return the actual search results so Gemini can "see" them
    return context.tasks.filter(t => t.title.toLowerCase().includes(params.query.toLowerCase()));
  }
};


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
    "search-tasks": SearchTasksHandler,
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


const EditTaskHandlerHUH = {
  execute: async (params:any, context:AIActionContext) => {
    context.setTasks(prev => prev.map(t => t.id === params.id ? { ...t, ...params } : t));
    return { success: true, updatedId: params.id };
  }
}