import { AllToolSchemas } from "../../agentic-tool-router/tool-index";

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