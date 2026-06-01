import { FunctionDeclaration, Type } from '@google/genai';

export const RouterTools: FunctionDeclaration[] = [
    {
        name: "analyzeIntent",
        description: "Analyze the user's prompt and determine which domains are required to fulfill all requests.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                requiredDomains: {
                    type: Type.ARRAY,
                    description: "An array of domains required to fulfill the user's request. Always include 'routeToGeneral' as a baseline.",
                    items: {
                        type: Type.STRING,
                        // IMPORTANT: List every possible bucket you have here so the LLM knows its options
                        enum: [
                            "routeToTasks",
                            "routeToHabits",
                            "routeToEvents",
                            "routeToTimers",
                            "routeToTaxonomy",
                            "routeToGeneral"
                        ]
                    }
                },
                reasoning: {
                    type: Type.STRING,
                    description: "A very brief 1-sentence explanation of why these domains were chosen."
                }
            },
            required: ["requiredDomains", "reasoning"]
        }
    }
];

/*    {
       name: "routeToTasks",
       description: "Use this if the user wants to add, edit, delete, or query their to-do list, reminders, or pending tasks.",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   },
   {
       name: "routeToHabits",
       description: "Use this if the user wants to manage recurring habits, streaks, check-ins, or daily goals.",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   },
   {
       name: "routeToEvents",
       description: "Use this if the user wants to manage calendar events, schedule meetings, or check their schedule.",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   },
   {
       name: "routeToTimers",
       description: "Use this if the user wants to start a focus timer, stop a stopwatch, or check time logs.",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   },
   {
       name: "routeToTaxonomy",
       description: "Use this if the user explicitly asks to manage Categories, Tags, colors, icons, or view taxonomy statistics.",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   },
   {
       name: "routeToMultiDomain",
       description: "Use this ONLY if the user's request crosses multiple domains (e.g., 'Add a task AND a habit' or 'Search across everything').",
       parameters: { type: Type.OBJECT, properties: { extractedIntent: { type: Type.STRING } } }
   } */