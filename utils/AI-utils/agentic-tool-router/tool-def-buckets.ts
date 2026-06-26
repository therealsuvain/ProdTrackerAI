import { FunctionDeclaration, Type } from '@google/genai';
import { desc } from 'drizzle-orm';

//TODO : remove required field fallbackCategoryId to optional
// 1. Task Domain
export const TaskTools: FunctionDeclaration[] = [
    {
        name: "addTask",
        description: "Adds a new task to the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the task" },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                category: { type: Type.STRING, description: "ID of the category" },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of the tag" },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" },
                reminderDate: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of dueDate and convert the user's local time,  to UTC using the offset provided in the system context. cater for both 12hr and 24hr local time formats conversion to UTC," }
            },
            required: ["title", "priority", "dueDate"]
        }
    },
    {
        name: "editTask",
        description: "Edits an existing task.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique task ID" },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                category: { type: Type.STRING, description: "ID of the category" },
                addTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to ADD to the item."
                },
                removeTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to REMOVE from the item."
                },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" },
                reminderDate: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of dueDate and convert the user's local time to UTC using the offset provided in the system context." }
            },
            required: ["id"]
        }
    },
    {
        name: "completeTask",
        description: "Marks a task as complete.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique task ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "deleteTask",
        description: "Deletes an existing task.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique task ID" },
            },
            required: ["id"]
        }
    },
];

// 2. Habit Domain
export const HabitTools: FunctionDeclaration[] = [
    {
        name: "addHabit",
        description: "Adds a new habit to the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the habit" },
                description: { type: Type.STRING },
                category: { type: Type.STRING, description: "ID of the category" },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of the tag" },
                frequency: { type: Type.STRING, enum: ["daily", "weekly"] },
                targetDays: { type: Type.ARRAY, items: { type: Type.NUMBER, minimum: 0, maximum: 6 }, description: "when frequency is weekly - an array of day numbers (0 = Sunday, .... 6 = Saturday)" },
                goal: { type: Type.NUMBER, description: "The target goal for the habit (e.g., 10 pushups, 8 glasses of water)" },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" },
                reminderDate: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of today's date and convert the user's local time to UTC using the offset provided in the system context." }
            },
            required: ["title", "frequency", "goal"]
        }
    },
    {
        name: "editHabit",
        description: "Edits an existing habit.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique habit ID" },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING, description: "ID of the category" },
                addTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to ADD to the item."
                },
                removeTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to REMOVE from the item."
                },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" },
                reminderDate: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of today's date and convert the user's local time to UTC using the offset provided in the system context." }
            }
        }
    },
    {
        name: "checkinHabit",
        description: "Marks a habit as checked in.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique habit ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "freezeHabit",
        description: "Freezes a habit streak.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique habit ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "deleteHabit",
        description: "Deletes an existing habit.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique habit ID" },
            },
            required: ["id"]
        }
    },
];

// 3. Event Domain
export const EventTools: FunctionDeclaration[] = [
    {
        name: "addEvent",
        description: "Adds a new eventto the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the event" },
                description: { type: Type.STRING },
                startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                endDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                startTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                endTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly"] },
                category: { type: Type.STRING, description: "ID of the category" },
                tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs of the tag" },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["title", "startDate", "startTime", "endTime", "recurrence"]
        }
    },
    {
        name: "editEvent",
        description: "Edits an existing event.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique event ID" },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                endDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                startTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                endTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly"] },
                category: { type: Type.STRING, description: "ID of the category" },
                addTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to ADD to the item."
                },
                removeTagIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of Tag IDs to REMOVE from the item."
                },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["id"]
        }
    },
    {
        name: "deleteEvent",
        description: "Deletes an existing event.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique event ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "deleteSingleEvent",
        description: "Deletes an occurence from an existing event.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique event ID" },
                date: { type: Type.STRING, description: "The date of the occurence to be deleted in ISO date string (YYYY-MM-DD)" },
            },
            required: ["id", "date"]
        }
    },
];

// 4. Timer Domain
export const TimerTools: FunctionDeclaration[] = [
    {
        name: "startTimer",
        description: "Starts a focus timer with a specific title.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "What the user is focusing on" }
            },
            required: ["title"]
        }
    },
    {
        name: "stopTimer",
        description: "Stops a currently running focus timer.",
        parameters: {
            type: Type.OBJECT,
        }
    },
];

// 5. Taxonomy & Stats Domain (The new ones)
export const TaxonomyTools: FunctionDeclaration[] = [
    {
        name: "searchTaxonomy",
        description: "Search for existing Categories or Tags by name. Use this to find the exact IDs of categories or tags before applying them to items. Accepts an array of queries to search for multiple items at once.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                // CHANGED to an Array of Strings
                queries: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    minItems: '1',
                    description: "A list of category/tag names or concepts to search for (e.g., ['fitness', 'urgent', 'groceries'])."
                },
                type: { type: Type.STRING, enum: ["category", "tag", "both"] }
            },
            required: ["queries"]
        }
    },
    {
        name: "addCategory",
        description: "Creates a new category. Provide a general concept for the icon (e.g., 'money', 'health', 'dog') and the system will auto-assign the best matching visual icon. RETURNS: The exact UUID of the new category. CRITICAL: Once you receive the new UUID from this tool, DO NOT call searchTaxonomy to verify it. You MUST immediately use the returned UUID in your next tool call (like addTask).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "The display name of the category" },
                hexColor: { type: Type.STRING, description: "A valid 6-character hex color code starting with # (e.g., #FF0000)" },
                proposedIconConcept: { type: Type.STRING, description: "A semantic keyword representing the category's visual theme (e.g., 'fitness', 'car', 'education')" },
                isPrerequisite: {
                    type: Type.BOOLEAN,
                    description: "Set to TRUE ONLY if you are creating this category strictly to attach it to a Task/Habit/Event in this EXACT SAME turn. If the user explicitly requested to create this category, it MUST be FALSE so they can confirm it in the UI."
                }
            },
            required: ["name", "isPrerequisite"]
        }
    },
    {
        name: "editCategory",
        description: "Edits an existing category's name, color, or icon concept.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The exact UUID of the category" },
                name: { type: Type.STRING },
                hexColor: { type: Type.STRING },
                proposedIconConcept: { type: Type.STRING }
            },
            required: ["id"]
        }
    },
    {
        name: "deleteCategory",
        description: "Deletes a category. You MUST provide a fallbackCategoryId to safely reassign all associated items. Never leave items orphaned.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The ID of the category to delete" },
                fallbackCategoryId: { type: Type.STRING, description: "The ID of the category that will inherit the deleted category's items" }
            },
            required: ["id", "fallbackCategoryId"]
        }
    },
    {
        name: "addTag",
        description: "Creates new organizational tags. You can add multiple tags at once. RETURNS: An array of the new tags and their UUIDs. CRITICAL: Once you receive the new UUIDs, DO NOT call searchTaxonomy to verify them. You MUST immediately use the returned UUIDs in your next tool call (like addTask)..",
        parameters: {
            type: Type.OBJECT,
            properties: {
                // CHANGED to an Array of Strings
                names: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "An array of tag names (even a single tag should be in an array) to create (without the # symbol). E.g., ['urgent', 'health', 'finance']"
                },
                isPrerequisite: {
                    type: Type.BOOLEAN,
                    description: "Set to TRUE ONLY if you are creating this tag strictly to attach it to a Task/Habit/Event in this EXACT SAME turn. If the user explicitly requested to create this tag, it MUST be FALSE so they can confirm it in the UI."
                }
            },
            required: ["names", "isPrerequisite"]
        }
    },
    {
        name: "editTag",
        description: "Edits an existing tag's name.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The exact UUID of the tag" },
                name: { type: Type.STRING }
            },
            required: ["id", "name"]
        }
    },
    {
        name: "deleteTag",
        description: "Deletes a tag. Provide a fallbackTagId to reassign items, or leave it empty to simply remove the tag from all items.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The ID of the tag to delete" },
                fallbackTagId: { type: Type.STRING, description: "Optional: The ID of the tag to replace it with." }
            },
            required: ["id"]
        }
    },
    {
        name: "getTaxonomyStats",
        description: "Retrieves usage statistics for categories or tags. Can fetch the top 10 most used, the 10 most recently created, the grand total, or stats for a specific ID.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ["category", "tag"] },
                scope: { type: Type.STRING, enum: ["top10", "recent10", "all", "specific"] },
                specificId: { type: Type.STRING, description: "Required only if scope is 'specific'." }
            },
            required: ["type", "scope"]
        }
    }
];

// 6. General/Global Tools
export const GeneralTools: FunctionDeclaration[] = [
    {
        name: "getStats",
        description: "Get completion rates, habit streaks, and category breakdowns for coaching.",
        parameters: { type: Type.OBJECT, properties: {} }
    },
    {
        name: "searchItems",
        description: "Use this to semantically search for existing tasks, habits, and events, allowing filtering by category and tags. Finds items by meaning, not just exact keywords. Do NOT use this for exact regex matches, date filtering, or meta-queries (e.g., do NOT search 'tasks with a weekday'). Instead, search for the core concept (e.g., 'health', 'car repair', 'groceries'). If you need to find tasks by specific dates or string matching, look at the raw data provided in your system prompt instead.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "The semantic concept to search for. Must be a meaning or topic, not a database command"
                },
                type: {
                    type: Type.STRING,
                    enum: ["task", "event", "habit", "all"],
                    description: "The type of items to search for. 'all' will search across all item types."
                },
                categoryName: { type: Type.STRING, description: "Category Name to filter by" },
                tagNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tag Names to filter by" }
            },
            required: ["query"]
        }
    },
    {
        name: "queryTasks",
        description: "Advanced search for tasks using filters like status, priority, relative time, category and tags. Use this to answer questions about pending, completed, or missed tasks. Intelligently beautify the results of tool and then only present to the user",
        parameters: {
            type: Type.OBJECT,
            properties: {
                status: {
                    type: Type.STRING,
                    enum: ["pending", "completed", "overdue", "all"],
                    description: "Filter by task state."
                },
                priority: {
                    type: Type.STRING,
                    enum: ["high", "medium", "low", "all"]
                },
                timeRange: {
                    type: Type.STRING,
                    enum: ["last_month", "last_week", "yesterday", "today", "tomorrow", "this_week", "next_week", "this_month", "next_month", "all"],
                    description: "Relative time range based on the current date."
                },
                sortBy: {
                    type: Type.STRING,
                    enum: ["oldest_first", "newest_first", "priority_desc", "priority_asec"]
                },
                specificTaskId: { type: Type.STRING, description: "If the user asks about a specific task's details then pass the ID here." },
                categoryName: { type: Type.STRING, description: "Category Name to filter by" },
                tagNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tag Names to filter by" }
            },
            required: ["timeRange", "status"]
        }
    },
    {
        name: "queryHabits",
        description: "Advanced search for habits. Can find habits that need checking in today, habits with lost streaks, frozen habits, sort by streak lengths and goals, filter by categories and tags",
        parameters: {
            type: Type.OBJECT,
            properties: {
                frequency: { type: Type.STRING, enum: ["daily", "weekly", "all"] },
                stateFilter: { type: Type.STRING, enum: ["needs_checkin", "streak_lost", "currently_frozen", "all"], description: "Filter by the current status of the user's streak." },
                sortBy: { type: Type.STRING, enum: ["highest_streak", "lowest_streak", "longest_streak_ever", "highest_goal", "newest_checkin", "oldest_checkin", "none"] },
                specificHabitId: { type: Type.STRING, description: "If the user asks about a specific habit's details then pass the ID here." },
                categoryName: { type: Type.STRING, description: "Category Name to filter by" },
                tagNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tag Names to filter by" }
            },
            required: ["frequency"] // Default to "all" when calling
        }
    },
    {
        name: "queryEvents",
        description: "Search calendar events. Can filter by time of day (e.g., morning/evening), time range,  fetch deep details about a specific recurring event (like remaining instances and deleted occurrences), or filter by tags and categories.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                timeRange: { type: Type.STRING, enum: ["last_month", "last_week", "yesterday", "today", "tomorrow", "this_week", "next_week", "this_month", "next_month", "all"] },
                timeOfDay: { type: Type.STRING, enum: ["morning", "afternoon", "evening", "all"], description: "Filters by the start time of the event, ignoring the date." },
                specificEventId: { type: Type.STRING, description: "If the user asks about a specific event's details (like recurrences left or deleted instances), pass the ID here." },
                categoryName: { type: Type.STRING, description: "Category Name to filter by" },
                tagNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tag Names to filter by" }
            },
            required: ["timeRange"]
        }
    },
    {
        name: "queryTimerLogs",
        description: "Retrieve tracked time. Can filter by duration (e.g., logs over 5 hours, or under 1 hour) and/or category and tags. Default to no limits if minDurationMinutes or maxDurationMinutes are not provided",
        parameters: {
            type: Type.OBJECT,
            properties: {
                minDurationMinutes: { type: Type.NUMBER, description: "Minimum duration in minutes." },
                maxDurationMinutes: { type: Type.NUMBER, description: "Maximum duration in minutes." },
                sortBy: { type: Type.STRING, enum: ["duration_desc", "duration_asc", "newest_first", "oldest_first"] },
                speificTimerLogId: { type: Type.STRING, description: "If the user asks about a specific timer log's details then pass the ID here" },
                categoryName: { type: Type.STRING, description: "Category Name to filter by" },
                tagNames: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tag Names to filter by" }
            },
            required: ["minDurationMinutes", "maxDurationMinutes"] // Default to no limits if not provided
        }
    },
];
export const MemoryTools: FunctionDeclaration[] = [
    {
        name: "getImmediateContext",
        description: "Retrieves the last few conversational messages and recently executed actions. Call this IMMEDIATELY if the user says 'undo that', 'edit that', or uses pronouns like 'it' or 'that' referring to a recent action.",
        parameters: {
            type: Type.OBJECT,
            properties: {} // No parameters needed. It automatically grabs the recent past.
        }
    },
    {
        name: "searchHistoricalActions",
        description: "Searches deep conversational history for past projects, tasks, or workflows. Use this when the user refers to specific past events (e.g., 'the Japan trip', 'tasks from yesterday').",
        parameters: {
            type: Type.OBJECT,
            properties: {
                keywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Specific words to search for. Keep it to 1 or 2 core nouns/verbs."
                },
                daysBack: {
                    type: Type.NUMBER,
                    description: "How many days back to search. Default is 7."
                },
                actionTypeOnly: {
                    type: Type.BOOLEAN,
                    description: "Set to true to only search messages where an action (task, habit, etc.) was successfully created."
                }
            },
            required: ["keywords"]
        }
    },
    {
        name: "undoActions",
        description: "Instantly undoes the most recent actions taken by the AI. Call this immediately when the user says 'undo', 'revert that', or 'go back'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                steps: {
                    type: Type.NUMBER,
                    description: "The number of previous actions to undo. Maximum is 10. Default is 1 if unspecified."
                }
            },
            // steps is optional; handler will default to 1
        }
    }
];


export const BatchTools: FunctionDeclaration[] = [
    {
        name: "batchTasksUpdate",
        description: "Bulk update multiple tasks simultaneously. Use semanticQuery to find tasks by meaning, or exact filters like status and priority.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                searchFilters: {
                    type: Type.OBJECT,
                    description: "Filters to determine WHICH tasks to modify.",
                    properties: {
                        semanticQuery: { type: Type.STRING, description: "A semantic concept to find tasks (e.g., 'things related to cars' or 'urgent emails')." },
                        status: { type: Type.STRING, enum: ["pending", "completed", "overdue", "all"] },
                        priority: { type: Type.STRING, enum: ["high", "medium", "low", "all"] },
                        categoryName: { type: Type.STRING, description: "Category Name to filter by" }
                    },
                    required: ["semanticQuery", "status"]
                },
                mutationPayload: {
                    type: Type.OBJECT,
                    description: "The new values to apply to all matched tasks.",
                    properties: {
                        description: { type: Type.STRING },
                        priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                        dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                        category: { type: Type.STRING, description: "Assign a new category to these tasks" },
                        completed: { type: Type.BOOLEAN, description: "Whether task is completed or not" }
                    }
                }
            },
            required: ["searchFilters", "mutationPayload"]
        }
    },
    {
        name: "batchEventsUpdate",
        description: "Bulk update multiple calendar events simultaneously.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                searchFilters: {
                    type: Type.OBJECT,
                    properties: {
                        semanticQuery: { type: Type.STRING },
                        timeRange: { type: Type.STRING, enum: ["last_month", "last_week", "yesterday", "today", "tomorrow", "this_week", "next_week", "this_month", "next_month", "all"] },
                        recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "all"] },
                        categoryName: { type: Type.STRING }
                    }
                },
                mutationPayload: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                        endDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                        startTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                        endTime: { type: Type.STRING, description: "ISO 8601 string in UTC timezone (e.g., '2026-03-24T14:30:00Z'). Use ISO date string (YYYY-MM-DD) value of startDate and convert the user's local time to UTC using the offset provided in the system context." },
                        recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly"] },
                        category: { type: Type.STRING, description: "Assign a new category to these events." },
                    }
                }
            },
            required: ["searchFilters", "mutationPayload"]
        }
    },
    {
        name: "batchHabitsUpdate",
        description: "Bulk update multiple habits simultaneously.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                searchFilters: {
                    type: Type.OBJECT,
                    properties: {
                        semanticQuery: { type: Type.STRING },
                        status: { type: Type.STRING, enum: ["needs_checkin", "streak_lost", "currently_frozen", "all"] },
                        frequency: { type: Type.STRING, enum: ["daily", "weekly", "all"] },
                        categoryName: { type: Type.STRING }
                    }
                },
                mutationPayload: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        category: { type: Type.STRING, description: "Assign a new category to these habits" },
                    }
                }
            },
            required: ["searchFilters", "mutationPayload"]
        }
    },
];

export const OtherTools: FunctionDeclaration[] = [
    {
        name: "triageOverdueItems",
        description: "Automatically rescues the user's day by gathering all overdue pending tasks, calculating the available free time in their calendar over the next few days, and semantically rescheduling the tasks into those free gaps. Call this when the user says they are overwhelmed, behind schedule, or ask you to 'fix my schedule'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                daysToSpread: {
                    type: Type.NUMBER,
                    description: "The number of days into the future to spread the overdue tasks. Default is 3. Max is 7."
                }
            }
            // No required parameters; it is highly autonomous.
        }
    },
]
// The "Fallback" array (just in case)
export const AllTools = [...TaskTools, ...HabitTools, ...EventTools, ...TimerTools, ...TaxonomyTools, ...GeneralTools, ...MemoryTools, ...BatchTools, ...OtherTools];