import { FunctionDeclaration, Type } from '@google/genai'

export const aiTools: FunctionDeclaration[] = [
    {
        name: "add-task",
        description: "Adds a new task to the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the task" },
                priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                category: { type: Type.STRING },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["title", "priority", "dueDate"]
        }
    },
    {
        name: "edit-task",
        description: "Edits an existing task.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique task ID" },
                title: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
                dueDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                category: { type: Type.STRING },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" },
                completed: { type: Type.BOOLEAN }
            },
            required: ["id"]
        }
    },
    {
        name: "complete-task",
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
        name: "delete-task",
        description: "Deletes an existing task.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique task ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "add-event",
        description: "Adds a new eventto the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the event" },
                startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                endDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                startTime: { type: Type.STRING, description: "Time string (HH:mm)" },
                endTime: { type: Type.STRING, description: "Time string (HH:mm)" },
                recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "monthly"] },
                category: { type: Type.STRING },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["title", "startDate", "endDate", "startTime", "endTime", "recurrence"]
        }
    },
    {
        name: "edit-event",
        description: "Edits an existing event.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique event ID" },
                title: { type: Type.STRING },
                startDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                endDate: { type: Type.STRING, description: "ISO date string (YYYY-MM-DD)" },
                startTime: { type: Type.STRING, description: "Time string (HH:mm)" },
                endTime: { type: Type.STRING, description: "Time string (HH:mm)" },
                recurrence: { type: Type.STRING, enum: ["none", "daily", "weekly", "monthly"] },
                category: { type: Type.STRING },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["id"]
        }
    },
    {
        name: "delete-event",
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
        name: "add-habit",
        description: "Adds a new habit to the user's list.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: "The title of the habit" },
                description: { type: Type.STRING },
                category: { type: Type.STRING },
                frequency: { type: Type.STRING, enum: ["daily", "weekly"] },
                goal: { type: Type.NUMBER, description: "The target goal for the habit (e.g., 10 pushups, 8 glasses of water)" },
                reminder: { type: Type.BOOLEAN, description: "whether the user wants a notification reminder" }
            },
            required: ["title", "frequency", "goal"]
        }
    },
    {
        name: "checkin-habit",
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
        name: "delete-habit",
        description: "Deletes an existing habit.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING, description: "The unique habit ID" },
            },
            required: ["id"]
        }
    },
    {
        name: "start-timer",
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
        name: "stop-timer",
        description: "Stops a currently running focus timer.",
        parameters: {
            type: Type.OBJECT,
        }
    },
    {
        name: "get-stats",
        description: "Get completion rates, habit streaks, and category breakdowns for coaching.",
        parameters: { type: Type.OBJECT, properties: {} }
    },
    {
        name: "search-items",
        description: "Use this to semantically search for existing tasks, habits, or events. Finds items by meaning, not just exact keywords. Do NOT use this for exact regex matches, date filtering, or meta-queries (e.g., do NOT search 'tasks with a weekday'). Instead, search for the core concept (e.g., 'health', 'car repair', 'groceries'). If you need to find tasks by specific dates or string matching, look at the raw data provided in your system prompt instead.",
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
                }
            },
            required: ["query"]
        }
    },
    {
        name: "query-tasks",
        description: "Advanced search for tasks using filters like status, priority, and relative time. Use this to answer questions about pending, completed, or missed tasks. Intelligently beautify the results of tool and then only present to the user",
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
                    enum: ["last_week", "yesterday", "today", "tomorrow", "this_week", "next_week", "all"],
                    description: "Relative time range based on the current date."
                },
                sortBy: {
                    type: Type.STRING,
                    enum: ["oldest_first", "newest_first", "priority_desc", "priority_asec"]
                },
                specificTaskId: { type: Type.STRING, description: "If the user asks about a specific task's details then pass the ID here." }
            },
            required: ["timeRange", "status"]
        }
    },
    {
        name: "query-habits",
        description: "Advanced search for habits. Can find habits that need checking in today, habits with lost streaks, frozen habits, or sort by streak lengths and goals.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                frequency: { type: Type.STRING, enum: ["daily", "weekly", "all"] },
                stateFilter: { type: Type.STRING, enum: ["needs_checkin", "streak_lost", "currently_frozen", "all"], description: "Filter by the current status of the user's streak." },
                sortBy: { type: Type.STRING, enum: ["highest_streak", "lowest_streak", "longest_streak_ever", "highest_goal", "newest_checkin", "oldest_checkin", "none"] },
                specificHabitId: { type: Type.STRING, description: "If the user asks about a specific habit's details then pass the ID here." }
            },
            required: ["frequency"] // Default to "all" when calling
        }
    },
    {
        name: "query-events",
        description: "Search calendar events. Can filter by time of day (e.g., morning/evening), time range, or fetch deep details about a specific recurring event (like remaining instances and deleted occurrences).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                timeRange: { type: Type.STRING, enum: ["today", "tomorrow", "this_week", "next_week", "yesterday", "last_week", "all"] },
                timeOfDay: { type: Type.STRING, enum: ["morning", "afternoon", "evening", "all"], description: "Filters by the start time of the event, ignoring the date." },
                specificEventId: { type: Type.STRING, description: "If the user asks about a specific event's details (like recurrences left or deleted instances), pass the ID here." }
            },
            required: ["timeRange"]
        }
    },
    {
        name: "query-timer-logs",
        description: "Retrieve tracked time. Can filter by duration (e.g., logs over 5 hours, or under 1 hour). Default to no limits if minDurationMinutes or maxDurationMinutes are not provided",
        parameters: {
            type: Type.OBJECT,
            properties: {
                minDurationMinutes: { type: Type.NUMBER, description: "Minimum duration in minutes." },
                maxDurationMinutes: { type: Type.NUMBER, description: "Maximum duration in minutes." },
                sortBy: { type: Type.STRING, enum: ["duration_desc", "duration_asc", "newest_first", "oldest_first"] },
                speificTimerLogId: { type: Type.STRING, description: "If the user asks about a specific timer log's details then pass the ID here"}
            },
            required: ["minDurationMinutes", "maxDurationMinutes"] // Default to no limits if not provided
        }
    }
];