import { recordGeminiUsage } from "./dev-util-token-monitor"
import { gemini_ai } from "./AI-utils/llm-client";
// Optional: Helper to make the embedding "Smarter" by combining fields
export const createSearchString = (item: any) => {
  const title = item.title || item.t || "";
  const notes = item.notes || item.n || "";
  const category = item.category || "";
  return title;
  return `Title: ${title}. Notes: ${notes}. Category: ${category}.`.trim().toLowerCase();
};

export const generateEmbedding = async (text: string, isQuery: boolean): Promise<number[]> => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    console.warn("generateEmbedding aborted: 'text' was empty or undefined.");
    return [];
  }

  try {
    const data = await gemini_ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: { role: "user", parts: [{ text }] },
      config: {
        outputDimensionality: 768,
        taskType: isQuery ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
      }

    });
    //recordGeminiUsage(data);
    // Returns the array of 384 numbers representing the text's meaning
    if (data.embeddings && data.embeddings[0].values) {
      return normalizeVector(data.embeddings[0].values);
    } else {
      //console.log("WHAT THE", data)
      console.error("Failed to generate embedding:", data);
      return [];
    }
  } catch (error) {
console.log("WHAT THE", error)
    console.error("Network error generating embedding:", error);
    return [];
  }
};

// One time existing data base migration to add embeddings field
// export const migrateToSemanticSearch = async (context: any) => {
//   //console.log("BOOM BOOM CHA HA")
//   const needsMigration = (items: any[]) => items.some(item => !item.embedding);

//   if (needsMigration(context.tasks) || needsMigration(context.habits) || needsMigration(context.events)) {
//     console.log("Starting Semantic Migration via Gemini API... ⏳");

//     const vectorize = async (list: any[]) => {
//       const updatedList = [];

//       for (const item of list) {
//         if (item.embedding) {
//           updatedList.push(item); // Skip if already done
//           continue;
//         }

//         console.log(`Vectorizing: ${item.title || item.t}`);
//         const searchString = createSearchString(item);
//         const vector = await generateEmbedding(searchString, false);

//         updatedList.push({ ...item, embedding: vector });

//         // Wait 2 seconds between API calls to respect free-tier limits
//         //await sleep(2000); 
//       }
//       return updatedList;
//     };

//     const newTasks = await vectorize(context.tasks);
//     const newHabits = await vectorize(context.habits);
//     const newEvents = await vectorize(context.events);
//     context.setTasks(newTasks);
//     context.setHabits(newHabits);
//     context.setEvents(newEvents);
//     console.log("Migration Complete! ✅");
//   }
// };

const normalizeVector = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(val => val / magnitude);
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB)); // Returns score between -1 and 1
};

export const fastCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  // Since both vectors are 768 dimensions and normalized, we just multiply and sum!
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  // The result is already a perfect similarity score between -1 and 1
  return dotProduct;
};