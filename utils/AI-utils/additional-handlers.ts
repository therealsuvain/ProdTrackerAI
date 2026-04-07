import { AIHandler } from "@/types/ai-handler";
import { generateEmbedding, fastCosineSimilarity } from '@/utils/embedding-engine';


export const getProductivityStats: AIHandler = {
  execute: async (params, context) => {
    const completed = context.tasks.filter((t: any) => t.completed).length;
    const total = context.tasks.length;
    const topHabit = context.habits.reduce((prev: any, current: any) =>
      (prev.streak > current.streak) ? prev : current, context.habits[0] || {}
    );
    return {
      completionRate: `${((completed / (total || 1)) * 100).toFixed(0)}%`,
      pendingTasks: total - completed,
      bestHabit: topHabit.title || "None",
      currentStreak: topHabit.streak || 0
    };
  }

}

export const SearchItemsHandler: AIHandler = {
  execute: async (args: { query: string, type: string }, context: any) => {
    console.log(`🧠 AI is semantically searching for: "${args.query}"`);

    // 1. Generate the Query Vector (Passing 'true' for RETRIEVAL_QUERY)
    const queryVector = await generateEmbedding(args.query, true);

    if (!queryVector || queryVector.length === 0) {
      console.warn("Failed to generate query vector. Returning empty results.");
      return { results: [], count: 0 };
    }

    // 2. Flatten all context data into a single searchable array
    const allItems = [
      ...(context.tasks || []).map((t: any) => ({ ...t, type: 'task' })),
      ...(context.habits || []).map((h: any) => ({ ...h, type: 'habit' })),
      ...(context.events || []).map((e: any) => ({ ...e, type: 'event' })),
    ];

    // 3. Score and sort the items
    const scoredResults = allItems
      .filter(item => args.type === "all" || item.type === args.type)
      .filter(item => item.embedding && item.embedding.length > 0) // Ensure it was migrated/saved properly
      .map(item => ({
        id: item.id || item.i,
        type: item.type,
        title: item.title || item.t,
        notes: item.notes || item.n, // Give the AI some context
        score: fastCosineSimilarity(queryVector, item.embedding)
      }))
      // 4. Filter out weak matches. (0.65 is usually a safe baseline for Gemini embeddings)
      .filter(result => result.score > 0.65)
      .sort((a, b) => b.score - a.score); // Highest similarity first

    // 5. Take the Top 5 results to keep the AI's context window clean
    const topResults = scoredResults.slice(0, 5);
    const foundIds = topResults.map(({ id, title, type }) => ({ id: id.slice(0, 8), title, type }));

    console.log("FOUND ID'S:", foundIds)
    return {
      results: foundIds
    }

    // Remove the 'score' before sending to AI to save tokens (it doesn't need the math, just the data)
    const cleanResults = topResults.map(({ score, ...rest }) => rest);
    console.log(cleanResults);
    return cleanResults
    return {
      results: cleanResults,
      totalFound: cleanResults.length,
      note: cleanResults.length === 0 ? "No relevant items found." : undefined
    };
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