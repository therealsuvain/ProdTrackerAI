import { ExecutionSummary } from "@/types/agent-state";
import { Content, Part } from "@google/genai";

export const sanitizeChatHistory = (history: Content[]): Content[] => {
    return history.map((turn) => ({
        ...turn,
        parts: turn.parts?.map((part: Part) => {
            // Destructure to isolate thoughtSignature and keep the rest
            const { thoughtSignature, ...sanitizedPart } = part;
            return sanitizedPart;
        })
    }));
};

/**
 * Takes the LLM's requested tools, enforces strict prerequisites, 
 * and returns the full JSON schemas for the Executor.
 */


export const transformCallsForDeducer = (executedCalls: any[]): ExecutionSummary => {
    const summary: ExecutionSummary = {
        tasksCreated: [],
        habitsCreated: [],
        categoriesCreated: [],
        tagsCreated: [],
        inquiriesHandled: false,
    };

    for (const call of executedCalls) {
        if (!call || !call.args) continue;

        switch (call.name) {
            case 'addTask':
                if (call.args.title) summary.tasksCreated.push(call.args.title);
                break;
            case 'addHabit':
                if (call.args.title) summary.habitsCreated.push(call.args.title);
                break;
            case 'addCategory':
                if (call.args.name) summary.categoriesCreated.push(call.args.name);
                break;
            case 'addTag':
                // Handle batched tags array
                if (Array.isArray(call.args.names)) {
                    summary.tagsCreated.push(...call.args.names);
                } else if (typeof call.args.name === 'string') {
                    summary.tagsCreated.push(call.args.name); // Fallback if single string
                }
                break;
            case 'searchTaxonomy':
            case 'queryTasks':
            case 'queryHabits':
            case 'queryEvents':
            case 'queryTimerLogs':
            case 'getTaxonomyStats':
            case 'getImmediateContext':
            case 'searchHistoricalActions':
            case 'searchItems':
                summary.inquiriesHandled = true;
                break;
            // Note: searchTaxonomy, queryTasks, etc. are implicitly ignored!
        }
    }

    return summary;
};

