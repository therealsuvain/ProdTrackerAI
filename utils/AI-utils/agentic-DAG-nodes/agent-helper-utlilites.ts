import { ExecutionSummary } from "@/types/agent-state";
import { Content, Part } from "@google/genai";
import { AllToolSchemas } from "../tool-index";

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

// A. Deterministic Stringifier
const deterministicStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return JSON.stringify(obj.map(deterministicStringify));
    }

    // Sort keys alphabetically to guarantee identical signatures
    const keys = Object.keys(obj).sort();
    const res: string[] = [];
    for (const key of keys) {
        res.push(`"${key}":${deterministicStringify(obj[key])}`);
    }
    return `{${res.join(',')}}`;
};

// B. robust deduplication helper using JSON stringification for deep comparison
export const mergeIdempotentCalls = (existingCalls: any[], newCalls: any[]): any[] => {
    const merged = [...existingCalls];

    for (const incomingCall of newCalls) {
        // Create a deterministic signature of the function call
        const signature = JSON.stringify({
            name: incomingCall.name,
            args: incomingCall.args // Note: Ensure object keys are sorted if args order varies
        });

        const isDuplicate = merged.some(existingCall =>
            deterministicStringify({ name: existingCall.name, args: existingCall.args }) === signature
        );

        if (!isDuplicate) {
            merged.push(incomingCall);
        } else {
            console.warn(`[DAG] Idempotency Shield: Dropped duplicate call for '${incomingCall.name}'`);
        }
    }

    return merged;
};

/**
 * Takes the LLM's requested tools, enforces strict prerequisites, 
 * and returns the full JSON schemas for the Executor.
 */
export const resolveDependencies = (requestedToolNames: string[]): any[] => {
    console.log("[DAG] Tool Names Requested by Router:", requestedToolNames);

    // Use a Set to automatically prevent duplicates
    const finalToolNames = new Set<string>(requestedToolNames);

    // --- HARDCODED DEPENDENCY RULES ---

    // 1. Assigning Taxonomy: If creating or editing items, we need category/tag UUIDs
    if (
        finalToolNames.has("addTask") || finalToolNames.has("editTask") || finalToolNames.has("deleteTask") || finalToolNames.has("completeTask")
        || finalToolNames.has("addHabit") || finalToolNames.has("checkinHabit") || finalToolNames.has("deleteHabit")
        || finalToolNames.has("addEvent") || finalToolNames.has("editEvent")
        || finalToolNames.has("deleteEvent") || finalToolNames.has("deleteSingleEvent")
    ) {
        finalToolNames.add("searchTaxonomy");
        finalToolNames.add("searchItems");
    }

    // 2. Task Mutations: If updating, deleting, or completing a task, we must find its UUID first
    if (finalToolNames.has("editTask") || finalToolNames.has("deleteTask") || finalToolNames.has("completeTask")) {
        finalToolNames.add("queryTasks"); // Or queryTasks, depending on your search handler's power
    }

    // 3. Habit Mutations: If editing or checking in, find the habit UUID
    if (finalToolNames.has("deleteHabit") || finalToolNames.has("checkinHabit")) {
        finalToolNames.add("queryHabits");
    }

    // 4. Event Mutations: Find the event UUID
    if (finalToolNames.has("editEvent") || finalToolNames.has("deleteEvent") || finalToolNames.has("deleteSingleEvent")) {
        finalToolNames.add("queryEvents");
    }

    // 5. Taxonomy Mutations: Find the Category/Tag UUID
    if (
        finalToolNames.has("editCategory") || finalToolNames.has("deleteCategory") ||
        finalToolNames.has("editTag") || finalToolNames.has("deleteTag") || finalToolNames.has("getTaxonomyStats")
    ) {
        finalToolNames.add("searchTaxonomy");
    }
    // --- MAPPING TO SCHEMAS ---
    const finalSchemas: any[] = [];
    finalToolNames.forEach(name => {
        const schema = AllToolSchemas[name];
        if (schema) {
            finalSchemas.push(schema);
        } else {
            console.warn(`[DAG] Warning: Router requested unknown tool '${name}'`);
        }
    });

    console.log(`[DAG] Dependency Injector Complete. Final Schema Count: ${finalSchemas.length}`);
    return finalSchemas;
};

export const transformCallsForDeducer = (executedCalls: any[]): ExecutionSummary => {
    const summary: ExecutionSummary = {
        tasksCreated: [],
        habitsCreated: [],
        categoriesCreated: [],
        tagsCreated: []
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
            // Note: searchTaxonomy, queryTasks, etc. are implicitly ignored!
        }
    }

    return summary;
};