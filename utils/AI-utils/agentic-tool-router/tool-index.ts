import { TaskTools, HabitTools, EventTools, TimerTools, GeneralTools, TaxonomyTools, MemoryTools } from "./tool-def-buckets";

// The lightweight dictionary the Router LLM will read
export const MasterToolIndex: Record<string, string> = {
  // Tasks
  "addTask": "Creates a new task with due dates, priorities, categories, and tags.",
  "editTask": "Modifies an existing task's properties like due date, priority, or name.",
  "deleteTask": "Removes an existing task entirely.",
  "completeTask": "Marks a task as completed or uncompleted.",

  // Habits
  "addHabit": "Creates a new habit with specific frequencies and goals.",
  "editHabit": "Modifies an existing habit's properties except for frequency, goal or targetDays",
  "deleteHabit": "Removes an existing habit.",
  "checkinHabit": "Logs progress or completes a daily/weekly check-in for a habit.",

  // Events
  "addEvent": "Schedules a new calendar event with start and end times.",
  "editEvent": "Modifies an existing calendar event's time or details.",
  "deleteEvent": "Deletes a calendar event, or all occurrences of a recurring event.",
  "deleteSingleEvent": "Deletes only a specific single occurrence of a recurring calendar event.",

  // Taxonomy (Categories & Tags)
  "addCategory": "Creates a new category with a specific hex color and icon.",
  "editCategory": "Modifies an existing category's color, icon, or name.",
  "deleteCategory": "Removes an existing category.",
  "addTag": "Creates a new tag for categorizing items.",
  "editTag": "Modifies an existing tag.",
  "deleteTag": "Removes an existing tag.",

  // Timers
  "startTimer": "Starts a focus timer or time-tracking session.",
  "stopTimer": "Stops an active focus timer or time-tracking session.",

  // Queries & Search (Read Operations)
  "queryTasks": "Retrieves lists of tasks based on filters like date, priority, or completion status.",
  "queryHabits": "Retrieves habits and their current streak or progress status.",
  "queryEvents": "Retrieves calendar events for a specific timeframe.",
  "queryTimerLogs": "Retrieves historical logs of completed focus timers and time tracked.",
  "searchItems": "Searches across tasks, habits, and events by text keyword.",
  "searchTaxonomy": "Looks up database UUIDs for categories and tags based on text names.",

  // Analytics
  "getStats": "Retrieves general productivity statistics, completion rates, and active streaks.",
  "getTaxonomyStats": "Retrieves usage statistics and time tracked for specific categories and tags.",

  //Memory
  "getImmediateContext": "Retrieves the last few conversational messages and recently executed actions. Call this IMMEDIATELY if the user says 'undo that', 'edit that', or uses pronouns like 'it' or 'that' referring to a recent action.",
  "searchHistoricalActions": "Searches deep conversational history for past projects, tasks, or workflows. Use this when the user refers to specific past events (e.g., 'the Japan trip', 'tasks from yesterday').",
};

// A mapping of the string names back to your actual JSON schema objects
// Assuming you have an array/object importing all your tool definitions
export const AllToolSchemas: Record<string, any> = {
  "addTask": TaskTools.find(t => t.name === "addTask"),
  "editTask": TaskTools.find(t => t.name === "editTask"),
  "deleteTask": TaskTools.find(t => t.name === "deleteTask"),
  "completeTask": TaskTools.find(t => t.name === "completeTask"),
  "addHabit": HabitTools.find(t => t.name === "addHabit"),
  "editHabit": HabitTools.find(t => t.name === "editHabit"),
  "deleteHabit": HabitTools.find(t => t.name === "deleteHabit"),
  "checkinHabit": HabitTools.find(t => t.name === "checkinHabit"),
  "freezeHabit": HabitTools.find(t => t.name === "freezeHabit"),
  "addEvent": EventTools.find(t => t.name === "addEvent"),
  "editEvent": EventTools.find(t => t.name === "editEvent"),
  "deleteEvent": EventTools.find(t => t.name === "deleteEvent"),
  "deleteSingleEvent": EventTools.find(t => t.name === "deleteSingleEvent"),
  "startTimer": TimerTools.find(t => t.name === "startTimer"),
  "stopTimer": TimerTools.find(t => t.name === "stopTimer"),
  "addTag": TaxonomyTools.find(t => t.name === "addTag"),
  "editTag": TaxonomyTools.find(t => t.name === "editTag"),
  "deleteTag": TaxonomyTools.find(t => t.name === "deleteTag"),
  "addCategory": TaxonomyTools.find(t => t.name === "addCategory"),
  "editCategory": TaxonomyTools.find(t => t.name === "editCategory"),
  "deleteCategory": TaxonomyTools.find(t => t.name === "deleteCategory"),
  "searchItems": GeneralTools.find(t => t.name === "searchItems"),
  "getStats": GeneralTools.find(t => t.name === "getStats"),
  "queryTasks": GeneralTools.find(t => t.name === "queryTasks"),
  "queryHabits": GeneralTools.find(t => t.name === "queryHabits"),
  "queryEvents": GeneralTools.find(t => t.name === "queryEvents"),
  "queryTimerLogs": GeneralTools.find(t => t.name === "queryTimerLogs"),
  "getTaxonomyStats": TaxonomyTools.find(t => t.name === "getTaxonomyStats"),
  "searchTaxonomy": TaxonomyTools.find(t => t.name === "searchTaxonomy"),
  "getImmediateContext": MemoryTools.find(t => t.name === "getImmediateContext"),
  "searchHistoricalActions": MemoryTools.find(t => t.name === "searchHistoricalActions"),
  // ... map the rest of your tools here
};