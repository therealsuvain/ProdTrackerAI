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

// Replace or update your ExecutionSummary interface in @/types/agent-state

/**
 * Takes the LLM's requested tools and builds a flexible "Action Receipt" 
 * for the Deducer to semantically audit.
 */
export const transformCallsForDeducer = (executedCalls: any[]): ExecutionSummary => {
    const summary: ExecutionSummary = {
        mutations: [],
        inquiriesHandled: false,
    };

    const inquiryTools = new Set([
        'searchTaxonomy', 'queryTasks', 'queryHabits', 'queryEvents',
        'queryTimerLogs', 'getTaxonomyStats', 'getImmediateContext',
        'searchHistoricalActions', 'searchItems'
    ]);

    for (const call of executedCalls) {
        if (!call || !call.args) continue;

        if (inquiryTools.has(call.name)) {
            // It's a read-only query
            summary.inquiriesHandled = true;
        } else {
            // It's a mutation (add, edit, delete, checkin, etc.)
            // We capture the exact tool and its arguments as an "Action Receipt"
            summary.mutations.push({
                tool: call.name,
                args: call.args
            });
        }
    }

    return summary;
};


/* export const transformCallsForDeducerOLD = (executedCalls: any[]): ExecutionSummary => {
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

 */