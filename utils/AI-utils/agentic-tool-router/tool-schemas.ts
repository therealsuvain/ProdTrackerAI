import { act } from 'react';
import { z } from 'zod';
import id from 'zod/v4/locales/id.cjs';

//NOTE: Task Schemas
export const AddTaskSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']),
    dueDate: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    reminder: z.boolean().optional(),
    reminderDate: z.string().optional(),
});

export const EditTaskSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().optional(),
    category: z.string().optional(),
    addTagIds: z.array(z.string()).optional(),
    removeTagIds: z.array(z.string()).optional(),
    reminder: z.boolean().optional(),
    reminderDate: z.string().optional(),
})

export const CompleteTaskSchema = z.object({
    id: z.string(),
})

export const DeleteTaskSchema = z.object({
    id: z.string(),
})

//NOTE: Habit Schemas
export const AddHabitSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    frequency: z.enum(['daily', 'weekly']),
    targetDays: z.array(z.number()).optional(),
    goal: z.number(),
    reminder: z.boolean().optional(),
    reminderDate: z.string().optional(),
});

export const EditHabitSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    addTagIds: z.array(z.string()).optional(),
    removeTagIds: z.array(z.string()).optional(),
    reminder: z.boolean().optional(),
    reminderDate: z.string().optional(),
})
export const CheckInHabitSchema = z.object({
    id: z.string(),
})

export const FreezeHabitSchema = z.object({
    id: z.string(),
})

export const DeleteHabitSchema = z.object({
    id: z.string(),
})

//NOTE: Event Schemas
export const AddEventSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    recurrence: z.enum(['none', 'daily', 'weekly']),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    reminder: z.boolean().optional(),
});

export const EditEventSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    recurrence: z.enum(['none', 'daily', 'weekly']).optional(),
    category: z.string().optional(),
    addTagIds: z.array(z.string()).optional(),
    removeTagIds: z.array(z.string()).optional(),
    reminder: z.boolean().optional(),
})

export const DeleteEventSchema = z.object({
    id: z.string(),
})

export const DeleteSingleEventSchema = z.object({
    id: z.string(),
    date: z.string(),
})

//NOTE: Timer Schemas

export const StartTimerSchema = z.object({
    title: z.string(),
})

export const StopTimerSchema = z.object({})

//NOTE: Taxonomy Schemas

export const AddCategorySchema = z.object({
    name: z.string(),
    hexColor: z.string().optional(),
    proposedIconConcept: z.string().optional(),
    isPrerequisite: z.boolean(),
})

export const EditCategorySchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    hexColor: z.string().optional(),
    proposedIconConcept: z.string().optional(),
})

export const DeleteCategorySchema = z.object({
    id: z.string(),
    fallbackCategoryId: z.string(),
})

export const AddTagSchema = z.object({
    names: z.array(z.string()),
    isPrerequisite: z.boolean(),
})

export const EditTagSchema = z.object({
    id: z.string(),
    name: z.string(),
})

export const DeleteTagSchema = z.object({
    id: z.string(),
    fallbackTagId: z.string().optional(),
})

export const GetTaxonomyStatsSchema = z.object({
    type: z.enum(['category', 'tag']),
    scope: z.enum(['top10', 'recent10', 'all', 'specific']),
    specificId: z.string().optional(),
})

export const SearchTaxonomySchema = z.object({
    query: z.array(z.string()),
    type: z.enum(['category', 'tag', 'both']).optional(),
})

//NOTE : Entity Query and Search Schemas

export const GetStatsSchema = z.object({})

export const SearchItemsSchema = z.object({
    query: z.string(),
    type: z.enum(['task', 'event', 'habit', 'all']).optional(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
})

export const QueryTasksSchema = z.object({
    status: z.enum(['pending', 'completed', 'overdue', 'all']),
    priority: z.enum(['low', 'medium', 'high', 'all']).optional(),
    timeRange: z.enum(['last_month', 'last_week', 'yesterday', 'today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'next_month', 'all']),
    sortBy: z.enum(['oldest_first', 'newest_first', 'priority_desc', 'priority_asec']).optional(),
    specificTaskId: z.string().optional(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
})

export const QueryHabitsSchema = z.object({
    frequency: z.enum(['daily', 'weekly', 'all']),
    stateFilter: z.enum(["needs_checkin", "streak_lost", "currently_frozen", "all"]).optional(),
    sortBy: z.enum(["highest_streak", "lowest_streak", "longest_streak_ever", "highest_goal", "newest_checkin", "oldest_checkin", "none"]).optional(),
    specificHabitId: z.string().optional(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
})

export const QueryEventsSchema = z.object({
    timeRange: z.enum(['last_month', 'last_week', 'yesterday', 'today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'next_month', 'all']),
    timeOfDay: z.enum(["morning", "afternoon", "evening", "all"]).optional(),
    specificEventId: z.string().optional(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
})

export const QueryTimerLogsSchema = z.object({
    minDurationMinutes: z.number().optional(),
    maxDurationMinutes: z.number().optional(),
    sortBy: z.enum(["duration_desc", "duration_asc", "newest_first", "oldest_first"]).optional(),
    specificTimerLogId: z.string().optional(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
})


export const GetImmediateContextSchema = z.object({})

export const SearchHistoricalActionsSchema = z.object({
    keyword: z.string(),
    daysBack: z.number().optional,
    actionTypeOnly: z.boolean().optional
})