import { FunctionDeclaration, Type } from '@google/genai';

export const RouterTools: FunctionDeclaration[] = [
    {
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
    }
];