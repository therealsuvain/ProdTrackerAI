import {
    AddTaskSchema, EditTaskSchema, DeleteTaskSchema, CompleteTaskSchema,
    AddHabitSchema, CheckInHabitSchema, DeleteHabitSchema, EditHabitSchema, FreezeHabitSchema,
    AddEventSchema, EditEventSchema, DeleteEventSchema, DeleteSingleEventSchema,
    StartTimerSchema, StopTimerSchema,
    AddCategorySchema, EditCategorySchema, DeleteCategorySchema,
    AddTagSchema, EditTagSchema, DeleteTagSchema,
    QueryTasksSchema, QueryHabitsSchema, QueryEventsSchema, QueryTimerLogsSchema,
    SearchItemsSchema, SearchTaxonomySchema,
    GetStatsSchema, GetTaxonomyStatsSchema,
    GetImmediateContextSchema, SearchHistoricalActionsSchema,
    BatchEventsUpdateSchema, BatchHabitsUpdateSchema, BatchTasksUpdateSchema,
    UndoActionsSchema, TriageOverdueHandlerSchema
} from "../../agentic-tool-router/tool-schemas";



export const validateCall = (name: string, args: any) => {
    switch (name) {
        case 'addTask': return AddTaskSchema.parse(args);
        case 'editTask': return EditTaskSchema.parse(args);
        case 'deleteTask': return DeleteTaskSchema.parse(args);
        case 'completeTask': return CompleteTaskSchema.parse(args);
        case 'addHabit': return AddHabitSchema.parse(args);
        case 'editHabit': return EditHabitSchema.parse(args);
        case 'checkinHabit': return CheckInHabitSchema.parse(args);
        case 'freezeHabit': return FreezeHabitSchema.parse(args);
        case 'deleteHabit': return DeleteHabitSchema.parse(args);
        case 'addEvent': return AddEventSchema.parse(args);
        case 'editEvent': return EditEventSchema.parse(args);
        case 'deleteEvent': return DeleteEventSchema.parse(args);
        case 'deleteSingleEvent': return DeleteSingleEventSchema.parse(args);
        case 'startTimer': return StartTimerSchema.parse(args);
        case 'stopTimer': return StopTimerSchema.parse(args);
        case 'addCategory': return AddCategorySchema.parse(args);
        case 'editCategory': return EditCategorySchema.parse(args);
        case 'deleteCategory': return DeleteCategorySchema.parse(args);
        case 'addTag': return AddTagSchema.parse(args);
        case 'editTag': return EditTagSchema.parse(args);
        case 'deleteTag': return DeleteTagSchema.parse(args);
        case 'queryTasks': return QueryTasksSchema.parse(args);
        case 'queryHabits': return QueryHabitsSchema.parse(args);
        case 'queryEvents': return QueryEventsSchema.parse(args);
        case 'queryTimerLogs': return QueryTimerLogsSchema.parse(args);
        case 'searchItems': return SearchItemsSchema.parse(args);
        case 'searchTaxonomy': return SearchTaxonomySchema.parse(args);
        case 'getStats': return GetStatsSchema.parse(args);
        case 'getTaxonomyStats': return GetTaxonomyStatsSchema.parse(args);
        case 'getImmediateContext': return GetImmediateContextSchema.parse(args);
        case 'searchHistoricalActions': return SearchHistoricalActionsSchema.parse(args);
        case 'undoActions': return UndoActionsSchema.parse(args);
        case 'batchTasksUpdate': return BatchTasksUpdateSchema.parse(args);
        case 'batchEventsUpdate': return BatchEventsUpdateSchema.parse(args);
        case 'batchHabitsUpdate': return BatchHabitsUpdateSchema.parse(args);
        case 'triageOverdueItems': return TriageOverdueHandlerSchema.parse(args);
        default: throw new Error(`No schema found for ${name}`);
    }
};