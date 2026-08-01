import { AIHandler } from "@/types/ai-handler";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import Fuse from "fuse.js";
import { AIActionMemory } from "./ai-action-undo-handlers";
import { Category } from "@/types/category";
import { Tag } from "@/types/tag";

// 1. Pre-compute the Icon Dictionary for Fuse
// Extracting all valid icon names from the glyphMap
const VALID_ICONS = Object.keys(Ionicons.glyphMap);

// Create a Fuse instance for Icons (threshold 0.4 allows for decent fuzziness)
const iconFuse = new Fuse(VALID_ICONS, {
  includeScore: true,
  threshold: 0.4,
});

/**
 * Helper to resolve AI icon concepts into valid Ionicons
 * e.g., AI suggests "dumbbell" -> Fuse finds "barbell"
 */
export const resolveIcon = (proposedConcept?: string): string => {
  if (!proposedConcept) return "folder"; // Default fallback

  const results = iconFuse.search(proposedConcept);
  if (results.length > 0 && results[0].item) {
    return results[0].item;
  }
  return "folder"; // Ultimate fallback if the AI's word was totally unrecognizable
};

/**
 * 1. THE TAXONOMY SEARCH TOOL
 * Allows the AI to dynamically look up UUIDs without relying on the system prompt memory.
 */
export const SearchTaxonomyHandler: AIHandler = {
  execute: async (params, context) => {
    const { type = "both" } = params;

    const rawInput = params.queries || params.query;

    // 2. Normalize to an array safely
    const normalizedQueries = Array.isArray(rawInput) ? rawInput : [rawInput];

    if (!normalizedQueries[0]) {
      return { status: "error", message: "No search terms provided." };
    }
    const results: any[] = [];

    // Fuse configuration for taxonomy
    const fuseOptions = {
      keys: ["name"],
      threshold: 0.3, // Strict enough to prevent false positives, loose enough for typos
      includeScore: true,
    };

    let categoryFuse: Fuse<any> | null = null;
    let tagFuse: Fuse<any> | null = null;

    if (type === "category" || type === "both") {
      categoryFuse = new Fuse(context.categories, fuseOptions);
    }
    if (type === "tag" || type === "both") {
      tagFuse = new Fuse(context.tags, fuseOptions);
    }

    // We will return a map where the key is the user's query, 
    // and the value is the array of matched IDs/names.
    const resultsMap: Record<string, any[]> = {};

    for (const query of normalizedQueries) {
      const queryResults: any[] = [];

      if (categoryFuse) {
        const matches = categoryFuse.search(query);
        queryResults.push(...matches.map(m => ({ type: "category", id: m.item.id, name: m.item.name, score: m.score })));
      }

      if (tagFuse) {
        const matches = tagFuse.search(query);
        queryResults.push(...matches.map(m => ({ type: "tag", id: m.item.id, name: m.item.name, score: m.score })));
      }

      // Sort matches for this specific query by closest score
      queryResults.sort((a, b) => (a.score || 0) - (b.score || 0));

      // Store the top matches for this specific query keyword
      resultsMap[query] = queryResults.length > 0 ? queryResults : ["NOT_FOUND"];
    }

    return { output: resultsMap };
  },
};

/**
 * 2. CATEGORY MANAGEMENT TOOLS
 * Includes the "Icon Fallback Array" to prevent UI crashes from AI hallucinations.
 */
export const AddCategoryHandler: AIHandler = {
  execute: async (params, context) => {
    // 1. Check the AI's proposed icons against the actual Ionicons library
    const finalIcon = resolveIcon(params.proposedIconConcept);

    // 2. Format the Color (Fallback to a default grey if AI failed)
    const finalColor = params.hexColor?.startsWith("#") ? params.hexColor : "#9156ff";

    // 3. Update global context/database
    // Ensure your context has this addCategory function available!
    const id = randomUUID();
    AIActionMemory.push({
      type: 'DELETE_CATEGORY',
      payload: { category: { id, name: params.name, color: finalColor, icon: finalIcon } as Category },
      timestamp: Date.now()
    });
    await context.addCategory({ id, name: params.name, color: finalColor, icon: finalIcon }, true);


    // Return the newly created ID so the AI can immediately chain it to an addTask call!
    return { status: "success", idForNewlyCreatedCategory: id, assignedIcon: finalIcon };
  },
};

export const EditCategoryHandler: AIHandler = {
  execute: async (params, context) => {
    const existingCategory = context.categories.find((c: any) => c.id === params.id);
    if (!existingCategory) throw new Error("Category not found");

    let finalIcon = params.proposedIconConcept
      ? resolveIcon(params.proposedIconConcept)
      : existingCategory.icon;

    const updatedCategory = {
      ...existingCategory,
      name: params.name || existingCategory.name,
      color: params.hexColor || existingCategory.color,
      icon: finalIcon,
    };

    AIActionMemory.push({
      type: 'REVERT_UPDATE_CATEGORY',
      payload: { category: existingCategory },
      timestamp: Date.now()
    });

    if (context.updateUserCategory) {
      context.trackMetric(["categoriesEdited"], 1);
      context.trackMetric(["categoriesEdited"], 1, 'ai');
      await context.updateUserCategory(updatedCategory);
    }

    return { status: "success", category: updatedCategory };
  },
};

export const DeleteCategoryHandler: AIHandler = {
  execute: async (params, context) => {
    const { id, fallbackCategoryId } = params;
    const existingCategory = context.categories.find((c: any) => c.id !== id);
    if (!existingCategory) {
      throw new Error(`Invariant violated: Category ${id} not found.`);
    }
    const itemsWithCategory : Record<string, string[]> = {};
    itemsWithCategory["tasks"] = context.tasks.filter((t: any) => t.category === id).map((t: any) => t.id);
    itemsWithCategory["events"] = context.events.filter((e: any) => e.category === id).map((e: any) => e.id);
    itemsWithCategory["habits"] = context.habits.filter((h: any) => h.category === id).map((h: any) => h.id);
    itemsWithCategory["logs"] = context.timerLogs.filter((l: any) => l.categoryId === id).map((l: any) => l.id);

    AIActionMemory.push({
      type: 'ADD_DELETED_CATEGORY',
      payload: { category: existingCategory, oldFallbackID: fallbackCategoryId, originalItems: itemsWithCategory },
      timestamp: Date.now()
    });

    if (context.deleteUserCategory) {
      context.trackMetric(["categoriesDeleted"], 1);
      context.trackMetric(["categoriesDeleted"], 1, 'ai');
      await context.deleteUserCategory(id, fallbackCategoryId || null);
    }

    return { status: "success", message: `Category ${id} deleted safely.` };
  },
};

/**
 * 3. TAG MANAGEMENT TOOLS
 */
export const AddTagHandler: AIHandler = {
  execute: async (params, context) => {
    const { names } = params;

    if (!names || !Array.isArray(names) || names.length === 0) {
      return { status: "error", message: "No tag names provided." };
    }
    const newlyCreatedTags = names.map(name => ({
      id: randomUUID(),
      name: name.replace(/^#/, ""),
    }));

    AIActionMemory.push({
      type: 'DELETE_TAG',
      payload: { tags: newlyCreatedTags as Tag[] },
      timestamp: Date.now()
    })
    await context.addTags(newlyCreatedTags, true);

  
    // Return the new ID so the AI can use it in tool chaining
    return { status: "success", tag: newlyCreatedTags };
  },
};

export const EditTagHandler: AIHandler = {
  execute: async (params, context) => {
    const existingTag = context.tags.find((t: any) => t.id === params.id);
    if (!existingTag) throw new Error("Tag not found");

    const updatedTag = {
      ...existingTag,
      name: params.name,
    };
   AIActionMemory.push({
     type: 'REVERT_UPDATE_TAG',
     payload: { tag: existingTag },
     timestamp: Date.now()
   })
    if (context.updateUserTag) {
      context.trackMetric(["tagsEdited"], 1);
      context.trackMetric(["tagsEdited"], 1,'ai');
      await context.updateUserTag(updatedTag);
    }

    return { status: "success", tag: updatedTag };
  },
};

export const DeleteTagHandler: AIHandler = {
  execute: async (params, context) => {
    const { id, fallbackTagId } = params;

    if (context.deleteUserTag) {
      await context.deleteUserTag(id, fallbackTagId || null, true);
    }
   
    return { status: "success", message: `Tag ${id} deleted safely.` };
  },
};

export const GetTaxonomyStatsHandler: AIHandler = {
  execute: async (params, context) => {
    const { type, scope, specificId } = params;

    // Select the target array
    const targetData = type === "category" ? context.categories : context.tags;

    if (scope === "specific") {
      if (!specificId) throw new Error("specificId is required for scope 'specific'");
      const item = targetData.find((i: any) => i.id === specificId);
      if (!item) return { status: "not_found", message: `${type} not found.` };

      // If you have deep stats in context, return them, otherwise return the basic count
      return {
        status: "success",
        data: { id: item.id, name: item.name, totalUsage: item.count }
      };
    }

    if (scope === "all") {
      const totalItems = targetData.length;
      const totalUsage = targetData.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
      return { status: "success", data: { totalItems, totalUsage } };
    }

    // Clone the array so we don't mutate context
    let sortedData = [...targetData];

    if (scope === "top10") {
      sortedData.sort((a, b) => (b.count || 0) - (a.count || 0));
    } else if (scope === "recent10") {
      // Assuming you have a createdAt or updatedAt field. Fallback to reverse array.
      sortedData.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    const results = sortedData.slice(0, 10).map((item: any) => ({
      id: item.id.slice(0, 8),
      name: item.name,
      count: item.count
    }));

    return { status: "success", data: results };
  }
};

// Interal Helper to keep handlers clean: resolves strings to UUIDs
export const resolveIdsFromNames = (names: string | string[], taxonomyItems: any[]): string[] => {
  if (!names || !taxonomyItems || taxonomyItems.length === 0) return [];
  const nameArray = Array.isArray(names) ? names : [names];

  const fuse = new Fuse(taxonomyItems, {
    keys: ["name"],
    threshold: 0.3, // Strict enough to prevent false positives, loose enough for typos
  });

  return nameArray.map(name => {
    const matches = fuse.search(name);
    return matches.length > 0 ? matches[0].item.id : null;
  }).filter(Boolean); // Strips out nulls if a tag/category was completely hallucinated
};