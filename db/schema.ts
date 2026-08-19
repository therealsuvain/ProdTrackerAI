/**
 * db/schema.ts
 *
 * Drizzle ORM schema for Expo SQLite.
 * This is the single source of truth for the database structure.
 *
 * Design decisions documented inline. Read before modifying.
 *
 * Column naming: snake_case in DB (SQL convention),
 * camelCase in TypeScript (via Drizzle's column mapping).
 *
 * Date storage strategy
 * ──────────────────────
 * - createdAt / updatedAt / completedAt / archivedAt → TEXT, ISO 8601 string.
 *   Reason: these are set in JS and compared as strings. ISO strings sort
 *   lexicographically correctly so range queries work without conversion.
 * - dueDate / reminderDate → INTEGER, unix milliseconds.
 *   Reason: these come from Date objects and are used in date arithmetic.
 *   Storing as ms avoids timezone ambiguity and converts trivially:
 *   new Date(row.dueDate) ↔ date.getTime()
 * - startTime / endTime on TimerLog → TEXT, ISO 8601.
 *   Reason: they were already strings in the original type and the UI
 *   uses them as strings (split('T')[0] etc). No conversion needed.
 */

import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Reusable audit column set.
 * Every table that represents user data includes these.
 * Call spread into your table definition: ...auditFields
 */
const auditFields = {
    createdAt: text("created_at")
        .notNull()
        .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text("updated_at")
        .notNull()
        .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    syncedAt: text("synced_at"),
};

// ─── tasks ────────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
    "tasks",
    {
        id: text("id").primaryKey(),                    // UUID v4
        title: text("title").notNull(),
        description: text("description"),
        category: text("category").references(() => categories.id, { onDelete: 'set null' }),
        // Stored as unix ms; converted to/from Date at the repository layer
        dueDate: text("due_date").notNull(),
        reminderDate: text("reminder_date"),
        reminder: integer("reminder", { mode: "boolean" }).notNull().default(false),
        notificationId: text("notification_id"),
        // Drizzle doesn't have an enum type for SQLite — use text + app-level validation
        priority: text("priority", { enum: ["low", "medium", "high"] })
            .notNull()
            .default("medium"),
        completed: integer("completed", { mode: "boolean" }).notNull().default(false),
        completedAt: text("completed_at"),              // ISO 8601, null until completed
        // Arrays stored as JSON blobs — small, not queried individually
        tags: text("tags"),                             // JSON: string[]
        embedding: text("embedding"),                   // JSON: number[] — large, blob is fine
        ...auditFields,
    },
    (table) => ([
        // Indexes for the most common query patterns
        index("tasks_completed_idx").on(table.completed),
        index("tasks_due_date_idx").on(table.dueDate),
        index("tasks_category_idx").on(table.category),
    ]),
);

// ─── habits ───────────────────────────────────────────────────────────────────

export const habits = sqliteTable(
    "habits",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        description: text("description"),
        frequency: text("frequency", { enum: ["daily", "weekly"] })
            .notNull()
            .default("daily"),
        reminder: integer("reminder", { mode: "boolean" }).notNull().default(false),
        reminderDate: text("reminder_date"),         // ISO 8601
        // Small array, never individually queried — JSON blob is correct here
        targetDays: text("target_days"),               // JSON: number[] e.g. [1,3,5]
        streak: integer("streak").notNull().default(0),
        longestStreak: integer("longest_streak").notNull().default(0),
        streakFreezes: integer("streak_freezes").notNull().default(1),             // ISO 8601
        goal: integer("goal").notNull().default(7),
        // Pending reset is a transient coordination flag — text date or null
        pendingStreakResetAfter: text("pending_streak_reset_after"),
        notificationId: text("notification_id"),
        category: text("category").references(() => categories.id, { onDelete: 'set null' }),
        tags: text("tags"),                            // JSON: string[]
        embedding: text("embedding"),                  // JSON: number[]
        ...auditFields,
    },
    (table) => ([
        index("habits_frequency_idx").on(table.frequency),
    ]),
);

/**
 * habit_check_ins — normalised child table for Habit.history
 *
 * Why a child table instead of a JSON blob?
 * - streak calculations: COUNT(*) WHERE habit_id = ? AND date >= ?
 * - "did I check in today?": SELECT 1 WHERE habit_id = ? AND date = ?
 * - heatmap data: JOIN with daily_metrics on date
 * These queries are frequent and benefit from an index on (habit_id, date).
 */
export const habitCheckIns = sqliteTable(
    "habit_check_ins",
    {
        id: text("id").primaryKey(),                   // UUID v4
        habitId: text("habit_id")
            .notNull()
            .references(() => habits.id, { onDelete: "cascade" }),
        // Date only, no time — 'YYYY-MM-DD'. Check-in is a daily boolean.
        date: text("date").notNull(),
    },
    (table) => ([
        index("habit_check_ins_habit_date_idx").on(
            table.habitId,
            table.date,
        ),
    ]),
);

/**
 * habit_freeze_history — normalised child table for Habit.freezeHistory
 * Same reasoning as check_ins — freeze queries are per-habit and date-ranged.
 */
export const habitFreezeHistory = sqliteTable(
    "habit_freeze_history",
    {
        id: text("id").primaryKey(),
        habitId: text("habit_id")
            .notNull()
            .references(() => habits.id, { onDelete: "cascade" }),
        date: text("date").notNull(),                  // 'YYYY-MM-DD'
    },
    (table) => ([
        index("habit_freeze_history_habit_idx").on(table.habitId),
    ]),
);

/**
 * habit_goal_completions — normalised child table for Habit.goalCompletions
 * Queried for "how many times has this habit hit its goal" and for the
 * GoalCompletionModal which needs the history.
 */
export const habitGoalCompletions = sqliteTable(
    "habit_goal_completions",
    {
        id: text("id").primaryKey(),
        habitId: text("habit_id")
            .notNull()
            .references(() => habits.id, { onDelete: "cascade" }),
        completedAt: text("completed_at").notNull(),   // ISO 8601
        goal: integer("goal").notNull(),               // goal value at completion time
    },
    (table) => ([
        index("habit_goal_completions_habit_idx").on(table.habitId),
    ]),
);

// ─── calendar events ──────────────────────────────────────────────────────────

export const calendarEvents = sqliteTable(
    "calendar_events",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        // Stored as ISO strings — calendar UI already works with strings
        startDate: text("start_date").notNull(),
        startTime: text("start_time").notNull(),
        endTime: text("end_time").notNull(),
        endDate: text("end_date"),
        description: text("description"),
        reminder: integer("reminder", { mode: "boolean" }).notNull().default(false),
        recurrence: text("recurrence", { enum: ["none", "daily", "weekly"] }).notNull().default("none"),
        category: text("category").references(() => categories.id, { onDelete: 'set null' }),
        tags: text("tags"),
        embedding: text("embedding"),                  // JSON: number[]
        ...auditFields,
    },
    (table) => ([
        index("calendar_events_start_date_idx").on(table.startDate),
    ]),
);

/**
 * event_deleted_occurrences — child table for CalendarEvent.deletedOccurrences
 * Recurrence exceptions. Small table, queried per-event when expanding
 * recurring events for display.
 */
export const eventDeletedOccurrences = sqliteTable(
    "event_deleted_occurrences",
    {
        id: text("id").primaryKey(),
        eventId: text("event_id")
            .notNull()
            .references(() => calendarEvents.id, { onDelete: "cascade" }),
        date: text("date").notNull(),                  // 'YYYY-MM-DD' of the skipped occurrence
    },
    (table) => ([
        index("event_deleted_occurrences_event_idx").on(table.eventId),
    ]),
);

/**
 * event_notification_ids — child table for CalendarEvent.notificationIds
 * Each recurring occurrence can have its own notification.
 * { id: string, date: string }[] → normalised rows.
 */
export const eventNotificationIds = sqliteTable(
    "event_notification_ids",
    {
        id: text("id").primaryKey(),                   // The notification ID itself
        eventId: text("event_id")
            .notNull()
            .references(() => calendarEvents.id, { onDelete: "cascade" }),
        date: text("date").notNull(),                  // 'YYYY-MM-DD' this notification fires for
    },
    (table) => ([
        index("event_notification_ids_event_idx").on(table.eventId),
    ]),
);

// ─── timer logs ───────────────────────────────────────────────────────────────

export const timerLogs = sqliteTable(
    "timer_logs",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        startTime: text("start_time").notNull(),        // ISO 8601
        endTime: text("end_time"),                      // ISO 8601
        duration: integer("duration"),                  // seconds
        category: text("category").references(() => categories.id, { onDelete: 'set null' }),
        tags: text("tags"),
        laps: text("laps"),                            // JSON: number[]
        isPartial: integer("is_partial", { mode: "boolean" }).default(false),
        ...auditFields,
    },
    (table) => ([
        index("timer_logs_category_idx").on(table.category),
        index("timer_logs_start_time_idx").on(table.startTime),
    ]),
);

// ─── messages (AI chat history) ───────────────────────────────────────────────

export const messages = sqliteTable(
    "messages",
    {
        id: text("id").primaryKey(),
        sender: text("sender", { enum: ["user", "ai"] }).notNull(),
        type: text("type", { enum: ["text", "loading", "action"] }).notNull(),
        text: text("text").notNull(),
        timestamp: text("timestamp").notNull(),         // ISO 8601 — creation time
        updatedAt: text("updated_at").notNull(),        // ISO 8601 — updated on confirm/expire
        pendingActions: text("pending_actions"),        // JSON: any[]
        isConfirmed: integer("is_confirmed", { mode: "boolean" }),
        isExpired: integer("is_expired", { mode: "boolean" }),
    },
    (table) => ([
        index("messages_timestamp_idx").on(table.timestamp),
        index("messages_sender_idx").on(table.sender),
    ]),
);
// ---  JUNCTION TABLES for Tags (M:N Relationships) ---

export const taskTags = sqliteTable('task_tags', {
    taskId: text('task_id')
        .notNull()
        .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) =>
    // Composite Primary Key prevents duplicate tag assignments on the exact same task
    [primaryKey({ columns: [t.taskId, t.tagId] })],
);

export const habitTags = sqliteTable('habit_tags', {
    habitId: text('habit_id')
        .notNull()
        .references(() => habits.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.habitId, t.tagId] })],
);

export const eventTags = sqliteTable('event_tags', {
    eventId: text('event_id')
        .notNull()
        .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.eventId, t.tagId] })],
);

export const timerTags = sqliteTable('timer_tags', {
    logId: text('log_id')
        .notNull()
        .references(() => timerLogs.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.logId, t.tagId] })],
);

// ─── metrics ──────────────────────────────────────────────────────────────────

/**
 * global_metrics — single-row table for AppMetrics.global
 *
 * Always upsert with id = 1. Never insert a second row.
 * Using a table instead of a key-value store gives us type-safe columns
 * and makes adding new metric keys a schema migration (intentional — forces
 * you to think about it) rather than a silent JSON key addition.
 */
export const globalMetrics = sqliteTable("global_metrics", {
    id: integer("id").primaryKey().default(1),       // Always 1
    tasksAdded: integer("tasks_added").notNull().default(0),       // Always 1
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksAbandoned: integer("tasks_abandoned").notNull().default(0),
    tasksMissed: integer("tasks_missed").notNull().default(0),
    tasksDeleted: integer("tasks_deleted").notNull().default(0),
    habitsAdded: integer("habits_added").notNull().default(0),
    habitsWithWeeklyGoals: integer("habits_with_weekly_goals").notNull().default(0),
    habitsWithDailyGoals: integer("habits_with_daily_goals").notNull().default(0),
    habitsAbandoned: integer("habits_abandoned").notNull().default(0),
    habitsCheckedIn: integer("habits_checked_in").notNull().default(0),
    habitsCheckedInBefore8am: integer("habits_checked_in_before_8am").notNull().default(0),
    habitsCheckedInAfter10pm: integer("habits_checked_in_after_10pm").notNull().default(0),
    habitsGoalsCompleted: integer("habits_goals_completed").notNull().default(0),
    habitGoalsRestarted: integer("habit_goals_restarted").notNull().default(0),
    habitCheckInsMissed: integer("habit_check_ins_missed").notNull().default(0),
    habitsStreakMaxDaily: integer("habits_streak_max_daily").notNull().default(0),
    habitsStreakMaxWeekly: integer("habits_streak_max_weekly").notNull().default(0),
    habitsFrozen: integer("habits_frozen").notNull().default(0),
    habitsAutoFrozen: integer("habits_auto_frozen").notNull().default(0),
    habitsDeleted: integer("habits_deleted").notNull().default(0),
    eventsAdded: integer("events_added").notNull().default(0),
    eventsDeleted: integer("events_deleted").notNull().default(0),
    eventsEarlymorning: integer("events_earlymorning").notNull().default(0),
    eventsLatenight: integer("events_latenight").notNull().default(0),
    eventsOvernight: integer("events_overnight").notNull().default(0),
    eventsDaily: integer("events_daily").notNull().default(0),
    eventsWeekly: integer("events_weekly").notNull().default(0),
    eventsSingleton: integer("events_singleton").notNull().default(0),
    eventsInfinite: integer("events_infinite").notNull().default(0),
    timeTracked: integer("time_tracked").notNull().default(0),
    chatMessagesSent: integer("chat_messages_sent").notNull().default(0),
    chatActionsConfirmed: integer("chat_actions_confirmed").notNull().default(0),
    chatActionsExpired: integer("chat_actions_expired").notNull().default(0),
    chatActionsCancelled: integer("chat_actions_cancelled").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    tagsAssigned: integer("tags_assigned").notNull().default(0),
    tagsDeleted: integer("tags_deleted").notNull().default(0),
    categoriesAdded: integer("categories_added").notNull().default(0),
    categoriesAssigned: integer("categories_assigned").notNull().default(0),
    categoriesDeleted: integer("categories_deleted").notNull().default(0),
    logsAdded: integer("logs_added").notNull().default(0),
    logsDeleted: integer("logs_deleted").notNull().default(0),
    tasksEdited: integer("tasks_edited").notNull().default(0),
    habitsEdited: integer("habits_edited").notNull().default(0),
    eventsEdited: integer("events_edited").notNull().default(0),
    logsEdited: integer("logs_edited").notNull().default(0),
    tagsEdited: integer("tags_edited").notNull().default(0),
    categoriesEdited: integer("categories_edited").notNull().default(0),
    syncedAt: text("synced_at"),
    updatedAt: text("updated_at"),
    syncedSnapshot: text("synced_snapshot")         // ISO 8601
});

/**
 * daily_metrics — one row per calendar day for AppMetrics.daily
 *
 * Primary key is the date string 'YYYY-MM-DD'.
 * Replaces the { [date: string]: DailyMetrics } object in AsyncStorage.
 * Range queries for heatmaps: SELECT * FROM daily_metrics WHERE date >= ?
 */
export const dailyMetrics = sqliteTable("daily_metrics", {
    date: text("date").primaryKey(),                 // 'YYYY-MM-DD'
    tasksAdded: integer("tasks_added").notNull().default(0),
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksAbandoned: integer("tasks_abandoned").notNull().default(0),
    tasksMissed: integer("tasks_missed").notNull().default(0),
    tasksDeleted: integer("tasks_deleted").notNull().default(0),
    habitsAdded: integer("habits_added").notNull().default(0),
    habitsWithWeeklyGoals: integer("habits_with_weekly_goals").notNull().default(0),
    habitsWithDailyGoals: integer("habits_with_daily_goals").notNull().default(0),
    habitsAbandoned: integer("habits_abandoned").notNull().default(0),
    habitsCheckedIn: integer("habits_checked_in").notNull().default(0),
    habitsCheckedInBefore8am: integer("habits_checked_in_before_8am").notNull().default(0),
    habitsCheckedInAfter10pm: integer("habits_checked_in_after_10pm").notNull().default(0),
    habitsGoalsCompleted: integer("habits_goals_completed").notNull().default(0),
    habitGoalsRestarted: integer("habit_goals_restarted").notNull().default(0),
    habitCheckInsMissed: integer("habit_check_ins_missed").notNull().default(0),
    habitsStreakMaxDaily: integer("habits_streak_max_daily").notNull().default(0),
    habitsStreakMaxWeekly: integer("habits_streak_max_weekly").notNull().default(0),
    habitsFrozen: integer("habits_frozen").notNull().default(0),
    habitsAutoFrozen: integer("habits_auto_frozen").notNull().default(0),
    habitsDeleted: integer("habits_deleted").notNull().default(0),
    eventsAdded: integer("events_added").notNull().default(0),
    eventsDeleted: integer("events_deleted").notNull().default(0),
    eventsEarlymorning: integer("events_earlymorning").notNull().default(0),
    eventsLatenight: integer("events_latenight").notNull().default(0),
    eventsOvernight: integer("events_overnight").notNull().default(0),
    eventsDaily: integer("events_daily").notNull().default(0),
    eventsWeekly: integer("events_weekly").notNull().default(0),
    eventsSingleton: integer("events_singleton").notNull().default(0),
    eventsInfinite: integer("events_infinite").notNull().default(0),
    timeTracked: integer("time_tracked").notNull().default(0),
    chatMessagesSent: integer("chat_messages_sent").notNull().default(0),
    chatActionsConfirmed: integer("chat_actions_confirmed").notNull().default(0),
    chatActionsExpired: integer("chat_actions_expired").notNull().default(0),
    chatActionsCancelled: integer("chat_actions_cancelled").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    tagsAssigned: integer("tags_assigned").notNull().default(0),
    tagsDeleted: integer("tags_deleted").notNull().default(0),
    categoriesAdded: integer("categories_added").notNull().default(0),
    categoriesAssigned: integer("categories_assigned").notNull().default(0),
    categoriesDeleted: integer("categories_deleted").notNull().default(0),
    logsAdded: integer("logs_added").notNull().default(0),
    logsDeleted: integer("logs_deleted").notNull().default(0),
    tasksEdited: integer("tasks_edited").notNull().default(0),
    habitsEdited: integer("habits_edited").notNull().default(0),
    eventsEdited: integer("events_edited").notNull().default(0),
    logsEdited: integer("logs_edited").notNull().default(0),
    tagsEdited: integer("tags_edited").notNull().default(0),
    categoriesEdited: integer("categories_edited").notNull().default(0),
    syncedAt: text("synced_at"),
    updatedAt: text("updated_at"),
    syncedSnapshot: text("synced_snapshot")
});

export const globalMetricsAI = sqliteTable("global_metrics_ai", {
    id: integer("id").primaryKey().default(1),       // Always 1
    tasksAdded: integer("tasks_added").notNull().default(0),       // Always 1
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksAbandoned: integer("tasks_abandoned").notNull().default(0),
    tasksMissed: integer("tasks_missed").notNull().default(0),
    tasksDeleted: integer("tasks_deleted").notNull().default(0),
    habitsAdded: integer("habits_added").notNull().default(0),
    habitsWithWeeklyGoals: integer("habits_with_weekly_goals").notNull().default(0),
    habitsWithDailyGoals: integer("habits_with_daily_goals").notNull().default(0),
    habitsAbandoned: integer("habits_abandoned").notNull().default(0),
    habitsCheckedIn: integer("habits_checked_in").notNull().default(0),
    habitsCheckedInBefore8am: integer("habits_checked_in_before_8am").notNull().default(0),
    habitsCheckedInAfter10pm: integer("habits_checked_in_after_10pm").notNull().default(0),
    habitsGoalsCompleted: integer("habits_goals_completed").notNull().default(0),
    habitGoalsRestarted: integer("habit_goals_restarted").notNull().default(0),
    habitCheckInsMissed: integer("habit_check_ins_missed").notNull().default(0),
    habitsStreakMaxDaily: integer("habits_streak_max_daily").notNull().default(0),
    habitsStreakMaxWeekly: integer("habits_streak_max_weekly").notNull().default(0),
    habitsFrozen: integer("habits_frozen").notNull().default(0),
    habitsAutoFrozen: integer("habits_auto_frozen").notNull().default(0),
    habitsDeleted: integer("habits_deleted").notNull().default(0),
    eventsAdded: integer("events_added").notNull().default(0),
    eventsDeleted: integer("events_deleted").notNull().default(0),
    eventsEarlymorning: integer("events_earlymorning").notNull().default(0),
    eventsLatenight: integer("events_latenight").notNull().default(0),
    eventsOvernight: integer("events_overnight").notNull().default(0),
    eventsDaily: integer("events_daily").notNull().default(0),
    eventsWeekly: integer("events_weekly").notNull().default(0),
    eventsSingleton: integer("events_singleton").notNull().default(0),
    eventsInfinite: integer("events_infinite").notNull().default(0),
    timeTracked: integer("time_tracked").notNull().default(0),
    chatMessagesSent: integer("chat_messages_sent").notNull().default(0),
    chatActionsConfirmed: integer("chat_actions_confirmed").notNull().default(0),
    chatActionsExpired: integer("chat_actions_expired").notNull().default(0),
    chatActionsCancelled: integer("chat_actions_cancelled").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    tagsAssigned: integer("tags_assigned").notNull().default(0),
    tagsDeleted: integer("tags_deleted").notNull().default(0),
    categoriesAdded: integer("categories_added").notNull().default(0),
    categoriesAssigned: integer("categories_assigned").notNull().default(0),
    categoriesDeleted: integer("categories_deleted").notNull().default(0),
    logsAdded: integer("logs_added").notNull().default(0),
    logsDeleted: integer("logs_deleted").notNull().default(0),
    tasksEdited: integer("tasks_edited").notNull().default(0),
    habitsEdited: integer("habits_edited").notNull().default(0),
    eventsEdited: integer("events_edited").notNull().default(0),
    logsEdited: integer("logs_edited").notNull().default(0),
    tagsEdited: integer("tags_edited").notNull().default(0),
    categoriesEdited: integer("categories_edited").notNull().default(0),
    syncedAt: text("synced_at"),          // ISO 8601
    updatedAt: text("updated_at"),
    syncedSnapshot: text("synced_snapshot")
});


export const dailyMetricsAI = sqliteTable("daily_metrics_ai", {
    date: text("date").primaryKey(),                 // 'YYYY-MM-DD'
    tasksAdded: integer("tasks_added").notNull().default(0),
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksAbandoned: integer("tasks_abandoned").notNull().default(0),
    tasksMissed: integer("tasks_missed").notNull().default(0),
    tasksDeleted: integer("tasks_deleted").notNull().default(0),
    habitsAdded: integer("habits_added").notNull().default(0),
    habitsWithWeeklyGoals: integer("habits_with_weekly_goals").notNull().default(0),
    habitsWithDailyGoals: integer("habits_with_daily_goals").notNull().default(0),
    habitsAbandoned: integer("habits_abandoned").notNull().default(0),
    habitsCheckedIn: integer("habits_checked_in").notNull().default(0),
    habitsCheckedInBefore8am: integer("habits_checked_in_before_8am").notNull().default(0),
    habitsCheckedInAfter10pm: integer("habits_checked_in_after_10pm").notNull().default(0),
    habitsGoalsCompleted: integer("habits_goals_completed").notNull().default(0),
    habitGoalsRestarted: integer("habit_goals_restarted").notNull().default(0),
    habitCheckInsMissed: integer("habit_check_ins_missed").notNull().default(0),
    habitsStreakMaxDaily: integer("habits_streak_max_daily").notNull().default(0),
    habitsStreakMaxWeekly: integer("habits_streak_max_weekly").notNull().default(0),
    habitsFrozen: integer("habits_frozen").notNull().default(0),
    habitsAutoFrozen: integer("habits_auto_frozen").notNull().default(0),
    habitsDeleted: integer("habits_deleted").notNull().default(0),
    eventsAdded: integer("events_added").notNull().default(0),
    eventsDeleted: integer("events_deleted").notNull().default(0),
    eventsEarlymorning: integer("events_earlymorning").notNull().default(0),
    eventsLatenight: integer("events_latenight").notNull().default(0),
    eventsOvernight: integer("events_overnight").notNull().default(0),
    eventsDaily: integer("events_daily").notNull().default(0),
    eventsWeekly: integer("events_weekly").notNull().default(0),
    eventsSingleton: integer("events_singleton").notNull().default(0),
    eventsInfinite: integer("events_infinite").notNull().default(0),
    timeTracked: integer("time_tracked").notNull().default(0),
    chatMessagesSent: integer("chat_messages_sent").notNull().default(0),
    chatActionsConfirmed: integer("chat_actions_confirmed").notNull().default(0),
    chatActionsExpired: integer("chat_actions_expired").notNull().default(0),
    chatActionsCancelled: integer("chat_actions_cancelled").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    tagsAssigned: integer("tags_assigned").notNull().default(0),
    tagsDeleted: integer("tags_deleted").notNull().default(0),
    categoriesAdded: integer("categories_added").notNull().default(0),
    categoriesAssigned: integer("categories_assigned").notNull().default(0),
    categoriesDeleted: integer("categories_deleted").notNull().default(0),
    logsAdded: integer("logs_added").notNull().default(0),
    logsDeleted: integer("logs_deleted").notNull().default(0),
    tasksEdited: integer("tasks_edited").notNull().default(0),
    habitsEdited: integer("habits_edited").notNull().default(0),
    eventsEdited: integer("events_edited").notNull().default(0),
    logsEdited: integer("logs_edited").notNull().default(0),
    tagsEdited: integer("tags_edited").notNull().default(0),
    categoriesEdited: integer("categories_edited").notNull().default(0),
    syncedAt: text("synced_at"),
    updatedAt: text("updated_at"),
    syncedSnapshot: text("synced_snapshot")
});

export const achievementGlobalMetrics = sqliteTable("achievement_global_metrics", {
    id: integer("id").primaryKey().default(1),
    tasksAdded: integer("tasks_added").notNull().default(0),       // Always 1
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    tasksAbandoned: integer("tasks_abandoned").notNull().default(0),
    tasksMissed: integer("tasks_missed").notNull().default(0),
    tasksDeleted: integer("tasks_deleted").notNull().default(0),
    habitsAdded: integer("habits_added").notNull().default(0),
    habitsWithWeeklyGoals: integer("habits_with_weekly_goals").notNull().default(0),
    habitsWithDailyGoals: integer("habits_with_daily_goals").notNull().default(0),
    habitsAbandoned: integer("habits_abandoned").notNull().default(0),
    habitsCheckedIn: integer("habits_checked_in").notNull().default(0),
    habitsCheckedInBefore8am: integer("habits_checked_in_before_8am").notNull().default(0),
    habitsCheckedInAfter10pm: integer("habits_checked_in_after_10pm").notNull().default(0),
    habitsGoalsCompleted: integer("habits_goals_completed").notNull().default(0),
    habitGoalsRestarted: integer("habit_goals_restarted").notNull().default(0),
    habitCheckInsMissed: integer("habit_check_ins_missed").notNull().default(0),
    habitsStreakMaxDaily: integer("habits_streak_max_daily").notNull().default(0),
    habitsStreakMaxWeekly: integer("habits_streak_max_weekly").notNull().default(0),
    habitsFrozen: integer("habits_frozen").notNull().default(0),
    habitsAutoFrozen: integer("habits_auto_frozen").notNull().default(0),
    habitsDeleted: integer("habits_deleted").notNull().default(0),
    eventsAdded: integer("events_added").notNull().default(0),
    eventsDeleted: integer("events_deleted").notNull().default(0),
    eventsEarlymorning: integer("events_earlymorning").notNull().default(0),
    eventsLatenight: integer("events_latenight").notNull().default(0),
    eventsOvernight: integer("events_overnight").notNull().default(0),
    eventsDaily: integer("events_daily").notNull().default(0),
    eventsWeekly: integer("events_weekly").notNull().default(0),
    eventsSingleton: integer("events_singleton").notNull().default(0),
    eventsInfinite: integer("events_infinite").notNull().default(0),
    timeTracked: integer("time_tracked").notNull().default(0),
    chatMessagesSent: integer("chat_messages_sent").notNull().default(0),
    chatActionsConfirmed: integer("chat_actions_confirmed").notNull().default(0),
    chatActionsExpired: integer("chat_actions_expired").notNull().default(0),
    chatActionsCancelled: integer("chat_actions_cancelled").notNull().default(0),
    tagsAdded: integer("tags_added").notNull().default(0),
    tagsAssigned: integer("tags_assigned").notNull().default(0),
    tagsDeleted: integer("tags_deleted").notNull().default(0),
    categoriesAdded: integer("categories_added").notNull().default(0),
    categoriesAssigned: integer("categories_assigned").notNull().default(0),
    categoriesDeleted: integer("categories_deleted").notNull().default(0),
    logsAdded: integer("logs_added").notNull().default(0),
    logsDeleted: integer("logs_deleted").notNull().default(0),
    tasksEdited: integer("tasks_edited").notNull().default(0),
    habitsEdited: integer("habits_edited").notNull().default(0),
    eventsEdited: integer("events_edited").notNull().default(0),
    logsEdited: integer("logs_edited").notNull().default(0),
    tagsEdited: integer("tags_edited").notNull().default(0),
    categoriesEdited: integer("categories_edited").notNull().default(0),
    syncedAt: text("synced_at"),
    updatedAt: text("updated_at"),
    syncedSnapshot: text("synced_snapshot")        // ISO 8601
});

export const unlockedAchievements = sqliteTable("unlocked_achievements", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    unlockedDescription: text("unlocked_description").notNull(),
    tier: text("tier", { enum: ["bronze", "silver", "gold", "platinum", "diamond"] }).notNull(),
    target: integer("target").notNull(),
    unlockedAt: text("unlocked_at").notNull(),
    syncedAt: text("synced_at"),
})

export const tags = sqliteTable(
    "tags",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull().unique(),
        count: integer("count").notNull().default(0), // Added for usage-based ranking
        ...auditFields,
    },
    (table) => ([
        index("user_tags_name_idx").on(table.name),
        index("user_tags_count_idx").on(table.count), // Optimize sorting by frequency
    ])
);

export const categories = sqliteTable(
    "categories",
    {
        id: text("id").primaryKey(),             // UUID v4
        name: text("name").notNull().unique(),   // e.g., "Work"
        color: text("color").notNull(),          // Hex code e.g., "#3b82f6"
        icon: text("icon").notNull(),
        count: integer("count").notNull().default(0), // Usage tracking for ranking
        ...auditFields,
    },
    (table) => ([
        index("categories_name_idx").on(table.name),
        index("categories_count_idx").on(table.count),
    ])
);



// ─── Drizzle inferred types ───────────────────────────────────────────────────
// These are the raw DB row shapes — used internally by repositories.
// Your application code works with the interfaces in types/*.ts, not these.

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;

export type HabitRow = typeof habits.$inferSelect;
export type HabitInsert = typeof habits.$inferInsert;

export type HabitCheckInRow = typeof habitCheckIns.$inferSelect;
export type HabitFreezeRow = typeof habitFreezeHistory.$inferSelect;
export type HabitGoalCompletionRow = typeof habitGoalCompletions.$inferSelect;

export type CalendarEventRow = typeof calendarEvents.$inferSelect;
export type CalendarEventInsert = typeof calendarEvents.$inferInsert;

export type EventDeletedOccurrenceRow = typeof eventDeletedOccurrences.$inferSelect;
export type EventNotificationIdRow = typeof eventNotificationIds.$inferSelect;

export type TimerLogRow = typeof timerLogs.$inferSelect;
export type TimerLogInsert = typeof timerLogs.$inferInsert;

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

export type GlobalMetricsRow = typeof globalMetrics.$inferSelect;
export type GlobalMetricsInsert = typeof globalMetrics.$inferInsert;

export type GlobalMetricsAIRow = typeof globalMetricsAI.$inferSelect;
export type GlobalMetricsAIInsert = typeof globalMetricsAI.$inferInsert;

export type DailyMetricsRow = typeof dailyMetrics.$inferSelect;
export type DailyMetricsInsert = typeof dailyMetrics.$inferInsert;

export type DailyMetricsAIRow = typeof dailyMetricsAI.$inferSelect;
export type DailyMetricsAIInsert = typeof dailyMetricsAI.$inferInsert;


export type AchievementGlobalMetricsRow = typeof achievementGlobalMetrics.$inferSelect
export type AchievementGlobalMetricsInsert = typeof achievementGlobalMetrics.$inferInsert

export type UnlockedAchievementsRow = typeof unlockedAchievements.$inferSelect
export type UnlockedAchievementsInsert = typeof unlockedAchievements.$inferInsert

export type TagRow = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;