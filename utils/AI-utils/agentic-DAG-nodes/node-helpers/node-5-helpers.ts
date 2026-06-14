import de from "zod/v4/locales/de.cjs";

export const sanitizeForFeedbackNode = (executedResults: any[]) => {
    return executedResults.map((item) => {
        const { tool, args, result } = item;

        // Base object we will return
        const sanitized: any = {
            tool,
            status: result?.status
        };

        // Rule 3b: Categories
        if (tool.includes('Category')) {
            if (args?.name) sanitized.name = args.name;
            if (args?.proposedIconConcept) sanitized.proposedIconConcept = args.proposedIconConcept;
            if (args?.hexColor) sanitized.hexColor = args.hexColor;
            if (result?.assignedIcon) sanitized.assignedIcon = result.assignedIcon;
            return sanitized;
        }

        // Rule 3c: Tags
        if (tool.includes('Tag')) {
            if (args?.names) sanitized.names = args.names;
            return sanitized;
        }

        // Rule 3a: Entities (Tasks, Events, Habits)
        // Find the entity key in the result (e.g., 'task', 'event', 'habit')
        const entityKey = Object.keys(result || {}).find(key => key !== 'status');

        if (entityKey && result[entityKey]) {
            const entity = { ...result[entityKey] };

            // Strip IDs and Timestamps (Rules 1 & 2)
            delete entity.id;
            delete entity.createdAt;
            delete entity.updatedAt;

            // Strip Backend & Default Noise (Additional Suggestions)
            delete entity.notificationId;
            delete entity.notificationIds;
            const categoryAdded = entity.category ? true : false;
            const tagCount = entity.tags?.length || 0;
            delete entity.category;
            delete entity.tags;
            entity.categoryAdded = categoryAdded;
            entity.tagCount = tagCount;
            // Attach cleaned entity to the sanitized payload
            sanitized[entityKey] = entity;
        } else {
            // Fallback if the tool failed or has no entity result
            sanitized.args = args;
        }

        return sanitized;
    });
};