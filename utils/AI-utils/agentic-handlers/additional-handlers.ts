import { AIHandler } from "@/types/ai-handler";
import { fastCosineSimilarity, generateEmbedding } from '@/utils/embedding-engine';
import { resolveIdsFromNames } from "./tags-and-categories-handlers";
import { Task } from "@/types/task";
import { useTaskStore } from "@/stores/use-task-store";
import { useHabitStore } from "@/stores/use-habit-store";
import { Habit } from "@/types/habits";
import { getImmediateContextWithEffects, getMoreContextWithEffects } from "@/utils/Data-services/chat-services/chat-actions";
import { getCategoryList } from "@/stores/use-category-store";
import { getTagList } from "@/stores/use-tag-store";
import { useEventStore } from "@/stores/use-event-store";
import { CalendarEvent } from "@/types/calendar";

function allTasks(): Task[] {
  return Object.values(useTaskStore.getState().tasksById);
}

function allHabits(): Habit[] {
  return Object.values(useHabitStore.getState().habitsById);
}

function allEvents(): CalendarEvent[] {
  return Object.values(useEventStore.getState().eventsById);
}

export const getProductivityStats: AIHandler = {
  execute: async () => {
    const tasks = allTasks();
    const completed = tasks.filter((t: any) => t.completed).length;
    const total = tasks.length;
    const habits = allHabits();
    const topHabit = habits.reduce((prev: any, current: any) =>
      (prev.streak > current.streak) ? prev : current, habits[0] || {}
    );
    return {
      completionRate: `${((completed / (total || 1)) * 100).toFixed(0)}%`,
      pendingTasks: total - completed,
      bestHabit: topHabit.title || "None",
      currentStreak: topHabit.streak || 0
    };
  }

}
export const getImmediateContext: AIHandler = {
  execute: async () => {
    console.log("[Memory] Fetching short-term history");
    const result = await getImmediateContextWithEffects();
    //console.log("[Memory] Short-term context:", result);
    return { output: result };
  }
}

export const searchHistoricalActions: AIHandler = {
  execute: async (params) => {
    console.log(`[Memory] Searching long-term context for: ${params.keywords}`);
    const result = getMoreContextWithEffects({
      keywords: params.keywords,
      daysBack: params.daysBack,
      actionTypeOnly: params.actionTypeOnly
    });
    //console.log("[Memory] Long-term context:", result);
    return { output: result };
  }
}
//This just a temporary comment that I will be removing in less than 30 secs from now and 
// This is kinda gay and bad, but I am really tired and bored of fixing shit again and again
// Just end it my man
export const SearchItemsHandler: AIHandler = {
  execute: async (args: { query: string, type: string, categoryName?: string, tagNames?: string[] }) => {
    const { query, type = 'all', categoryName, tagNames } = args;
    console.log(`🧠 AI is semantically searching for: "${query}"`);
    const categories = getCategoryList();
    const tags = getTagList();
    const targetCategoryId = categoryName ? resolveIdsFromNames(categoryName, categories)[0] : undefined;
    const targetTagIds = tagNames ? resolveIdsFromNames(tagNames, tags) : [];
    // 1. Generate the Query Vector (Passing 'true' for RETRIEVAL_QUERY)
    const queryVector = await generateEmbedding(query, true);

    if ((!queryVector || queryVector.length === 0) && type !== "all") {
      console.warn("Failed to generate query vector. Returning empty results.");
      return { results: [], count: 0 };
    }

    // 2. Flatten all context data into a single searchable array
    let allItems = [
      ...(allTasks() || []).map((t: any) => ({ ...t, type: 'task' })),
      ...(allHabits() || []).map((h: any) => ({ ...h, type: 'habit' })),
      ...(allEvents() || []).map((e: any) => ({ ...e, type: 'event' })),
    ];

    if (targetCategoryId) {
      allItems = allItems.filter(item => item.category === targetCategoryId);
    }

    if (targetTagIds.length > 0) {
      allItems = allItems.filter(item =>
        targetTagIds.every((tagId: string) => item.tags?.includes(tagId))
      );
    }

    // 3. Score and sort the items
    let scoredResults = allItems
      .filter(item => type === "all" || item.type === type)
      .filter(item => item.embedding && item.embedding.length > 0) // Ensure it was migrated/saved properly
      .map(item => ({
        id: item.id || item.i,
        type: item.type,
        title: item.title || item.t,
        notes: item.notes || item.n, // Give the AI some context
        score: fastCosineSimilarity(queryVector, item.embedding)
      }))
    // 4. Filter out weak matches. (0.65 is usually a safe baseline for Gemini embeddings)
    // Highest similarity first
    if (type !== "all") {
      scoredResults = scoredResults.filter(result => result.score > 0.65)
        .sort((a, b) => b.score - a.score);
    }


    // 5. Take the Top 5 results to keep the AI's context window clean
    //const topResults = scoredResults.slice(0, 5);
    const topResults = scoredResults;
    if (topResults.length === 0) return { output: "No relevant id's found" };
    const foundIds = topResults.map(({ id, title, type }) => ({ id: id.slice(0, 8), title, type }));

    console.log("FOUND ID'S:", foundIds)
    return {
      output: foundIds
    }

  }
};

export const getTimeRangeHelper = (timeRange: string) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  if (timeRange === "last_month") {

    rangeStart = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() - 1,
      1
    );

    rangeEnd = new Date(
      endOfToday.getFullYear(),
      endOfToday.getMonth(),
      0
    );
  }
  else if (timeRange === "last_week") {
    const day = startOfToday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday 
    const daysUntilLastSunday = day || 7; // Days until last Sunday is current day of the week number 

    rangeEnd = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() - daysUntilLastSunday);

    rangeStart = new Date(rangeEnd);
    rangeStart.setDate(rangeEnd.getDate() - 6);

  }
  else if (timeRange === "yesterday") {
    rangeStart = new Date(startOfToday);
    rangeStart.setDate(rangeStart.getDate() - 1);
    rangeEnd = new Date(endOfToday);
    rangeEnd.setDate(rangeEnd.getDate() - 1);

  } else if (timeRange === "today") {
    rangeStart = startOfToday;
    rangeEnd = endOfToday;

  } else if (timeRange === "tomorrow") {
    rangeStart = new Date(startOfToday);
    rangeStart.setDate(rangeStart.getDate() + 1);
    rangeEnd = new Date(endOfToday);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

  } else if (timeRange === "this_week") {
    const day = startOfToday.getDay();
    const daysUntilSunday = (7 - day) % 7;
    const daysAfterMonday = day - 1 || 7
    rangeStart = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() - daysAfterMonday
    );
    rangeEnd = new Date(
      endOfToday.getFullYear(),
      endOfToday.getMonth(),
      endOfToday.getDate() + daysUntilSunday
    );

  } else if (timeRange === "this_month") {
    rangeStart = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      1
    );
    rangeEnd = new Date(
      endOfToday.getFullYear(),
      endOfToday.getMonth() + 1,
      0
    );

  } else if (timeRange === "next_week") {
    const day = startOfToday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysUntilNextMonday = (8 - day) % 7 || 7; // Days until next Monday

    rangeStart = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + daysUntilNextMonday);

    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6);
  }

  else if (timeRange === "next_month") {
    rangeStart = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth() + 1,
      1
    );

    rangeEnd = new Date(
      endOfToday.getFullYear(),
      endOfToday.getMonth() + 2,
      0
    );
    /*rangeStart = new Date(startOfToday);
     rangeStart.setMonth(rangeStart.getMonth() + 1);
     rangeStart.setDate(1);
     rangeEnd = new Date(rangeStart);
     rangeEnd.setMonth(rangeEnd.getMonth() + 1);
     rangeEnd.setDate(0);
     return taskDate >= rangeStart && taskDate <= rangeEnd; */

    //NOTE: Above is my logic,using LLM's cleaner logic
  }

  return { rangeStart, rangeEnd };
}