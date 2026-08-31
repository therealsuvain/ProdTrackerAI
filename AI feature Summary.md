You have access to my repo, it has a AI feature which can manage the app, for managing we have handlers that it can run, these handlers are converted into tool-definitions accodring to FunctionDeclaration Schema so that LLM can understand. We currently have 25-30 handlers. We need to add more , a lot more so the LLM feature can manage almost everything and we need to make it extremely powerful.

We currently have these handlers :

# Tasks

1. "addTask": "Creates a new task with due dates, priorities, categories, and tags.",
2. "editTask": "Modifies an existing task's properties like due date, priority, or name.",
3. "deleteTask": "Removes an existing task entirely.",
4. "completeTask": "Marks a task as completed or uncompleted.",

# Habits

5. "addHabit": "Creates a new habit with specific frequencies and goals.",
6. "editHabit": "Modifies an existing habit's properties except for frequency, goal or targetDays",
7. "deleteHabit": "Removes an existing habit.",
8. "checkinHabit": "Logs progress or completes a daily/weekly check-in for a habit.",
9. "freezeHabit": "Freezes a habit's current streak.",

# Events

10. "addEvent": "Schedules a new calendar event with start and end times.",
11. "editEvent": "Modifies an existing calendar event's time or details.",
12. "deleteEvent": "Deletes a calendar event, or all occurrences of a recurring event.",
13. "deleteSingleEvent": "Deletes only a specific single occurrence of a recurring calendar event.",

# Taxonomy (Categories & Tags)

14. "addCategory": "Creates a new category with a specific hex color and icon.",
15. "editCategory": "Modifies an existing category's color, icon, or name.",
16. "deleteCategory": "Removes an existing category.",
17. "addTag": "Creates a new tag for categorizing items.",
18. "editTag": "Modifies an existing tag.",
19. "deleteTag": "Removes an existing tag.",

# Timers

20. "startTimer": "Starts a focus timer or time-tracking session.",
21. "stopTimer": "Stops an active focus timer or time-tracking session.",

# Queries & Search (Read Operations)

22. "queryTasks": "Retrieves lists of tasks based on filters like date, priority, or completion status.",
23. "queryHabits": "Retrieves habits and their current streak or progress status.",
24. "queryEvents": "Retrieves calendar events for a specific timeframe.",
25. "queryTimerLogs": "Retrieves historical logs of completed focus timers and time tracked.",
26. "searchItems": "Searches across tasks, habits, and events by text keyword.",
27. "searchTaxonomy": "Looks up database UUIDs for categories and tags based on text names.",

# Analytics

28. "getStats": "Retrieves general productivity statistics, completion rates, and active streaks.",
29. "getTaxonomyStats": "Retrieves usage statistics and time tracked for specific categories and tags.",

# Memory

30. "getImmediateContext": "Retrieves the last few conversational messages and recently executed actions. Call this IMMEDIATELY if the user says 'undo that', 'edit that', or uses pronouns like 'it' or 'that' referring to a recent action.",
31. "searchHistoricalActions": "Searches deep conversational history for past projects, tasks, or workflows. Use this when the user refers to specific past events (e.g., 'the Japan trip', 'tasks from yesterday').",

The Handlers are divided into two categoires: Silent and Confirmational

## Confirmational :

Any handler that requries mutation to DB like add, edit , delete are sent to the user with preview UIs for confirmation, only on confirmation these actions are executed

## Silent:

Any search, query handler that is required to read the DB to answer a requset or perform an aciton , are run in the background without any confirmation, these are used to usually provide the accurate values for the confirmational hadnlers

# This is how are agentic pipeline works.

User Request ---> Gatekeeper--->Planner--->Router--->Intermediatory Executor--->Checklist Deducer ---> Loops back to Intermediatory Executor

# Gatekeeper Node:

Determines whether this is something that should even enter the pipeline or just be ansered directly without any actions . FOr when the user is just have a converstaion saying "Thanks" etc.

# Planner Node:

After the gatekeeper determines to enter the pipline this is first node, if takes in the user transcript and converts into action item checklist.

# Router Node :

The checklist from planner is shared to router which selects the apporiate tool for each request , to minimize context bloat

# Intermediatory Executor:

This node gets input the main , long system prompt that bascially explains the app , app's purpose and what the AI is expected of. The tools from the router and the user transcript are passed to it and it then generates appropriate function calls

# Checklisk Deducer :

Compares the action item checklist and the generated functional calls and marks the ones done to be complete

# Orchestrator :

Calls and combines all nodes. Gatekeeper, Planner , and Router are called after which Executor and Checklist Deducer are called inside a while loop that runs for a maximum of 10 iterations. The orchestrator is also responsible for detecting tunnel vision, pending items taht havent been done and any other errors and then has the ability to retry to get a successful output. Additionally there is a case where , when the user requests for something referencing the AI chat history itself, two handlers are called getImmediateContext or searchHistoricalActions. After these to handlers have successfully shared the chat history , the Pipeline is restarted in this case starting from the Gatekeeper and then Planner , Router and then into the loop. In other cases the first 3 nodes are only ever run once, but in this there are run again to generate new checklist and select new tools after gaining access to the chat history messages.

# Additonally Zod is being used for tool validation
