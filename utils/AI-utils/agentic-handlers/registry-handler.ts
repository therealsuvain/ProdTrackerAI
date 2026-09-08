import { AIActionContext, AIHandler } from "@/types/ai-handler";
import { SearchItemsHandler, getProductivityStats, getImmediateContext, searchHistoricalActions } from './additional-handlers';
import { AddEventHandler, DeleteEventHandler, DeleteEventSingleOccurrenceHandler, EditEventHandler, QueryEventsHandler, BatchMutateEventsHandler } from "./event-handler";
import { AddHabitHandler, EditHabitHandler, CheckInHabitHandler, FreezeHabitHandler, DeleteHabitHandler, QueryHabitsHandler, BatchMutateHabitsHandler } from "./habit-handler";
import { AddTaskHandler, CompleteTaskHandler, DeleteTaskHandler, EditTaskHandler, QueryTasksHandler, BatchMutateTasksHandler } from "./task-handler";
import { QueryTimerLogsHandler, StartTimerHandler, StopTimerHandler } from "./timer-handler";
import { SearchTaxonomyHandler, AddCategoryHandler, EditCategoryHandler, DeleteCategoryHandler, AddTagHandler, EditTagHandler, DeleteTagHandler, GetTaxonomyStatsHandler } from "./tags-and-categories-handlers"
import { RevertLastActionHandler } from "./ai-action-undo-handlers"
import { TriageOverdueHandler } from "./triage-overdue-tasks-handler"


export const SilentHandlerList: string[] = [
    "searchItems",
    "searchTaxonomy",
    "getStats",
    "queryTasks",
    "queryHabits",
    "queryEvents",
    "queryTimerLogs",
    "getTaxonomyStats",
    "getImmediateContext",
    "searchHistoricalActions",
    "undoActions"
]

export const ActionRegistry: Record<string, AIHandler> = {
    "addTask": AddTaskHandler,
    "editTask": EditTaskHandler,
    "deleteTask": DeleteTaskHandler,
    "completeTask": CompleteTaskHandler,
    "batchTasksUpdate": BatchMutateTasksHandler,
    "addHabit": AddHabitHandler,
    "editHabit": EditHabitHandler,
    "deleteHabit": DeleteHabitHandler,
    "checkinHabit": CheckInHabitHandler,
    "freezeHabit": FreezeHabitHandler,
    "batchHabitsUpdate": BatchMutateHabitsHandler,
    "addEvent": AddEventHandler,
    "editEvent": EditEventHandler,
    "deleteEvent": DeleteEventHandler,
    "deleteSingleEvent": DeleteEventSingleOccurrenceHandler,
    "BatchEventsUpdate": BatchMutateEventsHandler,
    "addCategory": AddCategoryHandler,
    "editCategory": EditCategoryHandler,
    "deleteCategory": DeleteCategoryHandler,
    "addTag": AddTagHandler,
    "editTag": EditTagHandler,
    "deleteTag": DeleteTagHandler,
    "startTimer": StartTimerHandler,
    "stopTimer": StopTimerHandler,
    "queryTasks": QueryTasksHandler,
    "queryHabits": QueryHabitsHandler,
    "queryEvents": QueryEventsHandler,
    "queryTimerLogs": QueryTimerLogsHandler,
    "searchItems": SearchItemsHandler,
    "searchTaxonomy": SearchTaxonomyHandler,
    "getStats": getProductivityStats,
    "getTaxonomyStats": GetTaxonomyStatsHandler,
    "getImmediateContext": getImmediateContext,
    "searchHistoricalActions": searchHistoricalActions,
    "undoActions": RevertLastActionHandler,
    "triageOverdueItems": TriageOverdueHandler,
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

