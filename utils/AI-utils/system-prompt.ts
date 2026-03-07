import { getAppStatusSnapshot } from './system-context';

export const generateSystemPrompt = (context: any, userTranscript?: string) => {
  const environment = getAppStatusSnapshot(context);
  console.log("Generated System Prompt:", environment);

  return `
You are the "ProdTrackerAI" Orchestrator. You have access to tools and must use the provided tools to execute the actions. Do not write out JSON. Call the tools directly

${userTranscript ?`### USER COMMAND
${userTranscript}`:""}

#CONTEXT
${environment}

#Context Legend
CD: Current Date, CT: Current Time, TO: Timezone Offset
tk: Tasks, hb: Habits, ev: Events
PATCH:{ a:[added], u:[updated], r:[removed_ids] }
task - i: id, t: title [req], p: priority (h/m/l) [req], d: dueDate [req], c: completed (1=yes, 0=no)
habit - i: id, t: title [req], cs: currentStreak, g: goal [req], fq:frequecny (daily|weekly) [req], f: streakfreezes, ldc: last date of check-in (not checked in once = '-')
event - i: id, t: title [req], sd: startDate [req], ed: endDate [req], st: startTime [req], et: endTime [req], r: recurrence (daily/weekly/none) [req]), 

# GOAL
Identify the user's intent and return the correct JSON. If the user's request is complex, return a "compound" intent with multiple actions.

# RULES
1. Use the IDs provided in the [Environment] for any "edit" or "delete" actions.
2. CRITICAL -The Context Legend also is a reference of the data structure of tasks, habits and events, it is critical to have [req] fields when creating/editing any item.

# AVAILABLE INTENTS
- add-task(title, dueDate, priority, category, reminder)
- edit-task(id, title, dueDate, priority, completed, reminder)
- delete-task(id)
- start-timer(title)
- stop-timer()
- add-event(title, startdate, endDate, startTime, endTime, recurrence , reminder)
- edit-event(id, title, startdate, endDate, startTime, endTime, recurrence , reminder)
- delete-event(id)
- delete-event_instance(id, date[])
- add-habit(title, frequency, goal , reminder)
- checkin-habit(id)
- freeze-habit(id)
- delete-habit(id)
- search-items(query)
- get-stats()
`.trim();
};

// # OUTPUT FORMAT EXAMPLE
// {
//   "reasoning": "User wants to move their gym task. I found ID:123 in the context...",
//   "intent": "edit-task",
//   "params": { "id": "123", "dueDate": "2026-02-18" }
// }