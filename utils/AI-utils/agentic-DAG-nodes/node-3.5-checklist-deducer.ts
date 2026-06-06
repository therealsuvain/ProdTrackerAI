import { ChecklistItem, ExecutionSummary } from "@/types/agent-state";
import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";

export const executeChecklistDeductionNode = async (
    currentChecklist: ChecklistItem[],
    summary: ExecutionSummary
): Promise<string[]> => {
    // If the checklist is empty or no tools were called, nothing to deduce.

    const pendingItems = currentChecklist.filter(item => item.status === "PENDING");
    if (pendingItems.length === 0 ||
        (summary.tasksCreated.length + summary.habitsCreated.length + summary.categoriesCreated.length + summary.tagsCreated.length) === 0)
        return [];

    console.log("=========================================================");
    console.log("[DAG] Micro-Node: DEDUCING CHECKLIST PROGRESS...");
    console.log("[DAG] Pending Checklist Items:", JSON.stringify(pendingItems));
    console.log("[DAG] Summary:", JSON.stringify(summary));
    /*   const deductionPrompt = `
      You are a strict auditor verifying system state.
      Pending Checklist Intents:
      ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
    
      System Execution Summary (What was actually successfully created):
      ${JSON.stringify(summary)}
    
      Compare the executed tools against the checklist.
      Return a JSON array containing ONLY the string "id"s of the checklist items that have been fully completed based on the summary.
      `; */

    // Proposed simplified logic for the Deducer
    const deductionPrompt = `
  You are an auditor verifying task completion based on entity names.
  
  Pending Checklist Items: ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
  Execution Summary: ${JSON.stringify(summary)}

  Logic: 
  For each checklist intent, extract the core entity name (e.g., Task name, Habit name, Category name).
  If that entity name is present in the corresponding array in the Execution Summary (tasksCreated, habitsCreated, categoriesCreated, or tagsCreated), mark the checklist item as COMPLETED.
  
  Return a JSON array of completed IDs.
`;

    //  RULES:
    // 1. ONLY remove an item from the checklist if you have absolute proof it was completed by the tools above.
    // 2. Do NOT remove an item if the tool execution contains an "error".
    // 3. If an item requests creating a "Task" or "Habit", and the executed tools ONLY involve "Categories" or "Search", you MUST NOT remove the Task or Habit from the checklist.

    try {
        const response = await gemini_ai.models.generateContent({
            model: "gemini-2.5-flash", // Extremely fast/cheap micro-call
            contents: [{ role: "user", parts: [{ text: deductionPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "The remaining, unfulfilled tasks."
                }
            }
        });
        recordGeminiUsage(response, "Checklist DEDUCER");
        const remainingChecklistIDs = JSON.parse(response.text || "[]");
        console.log(`[DAG] Checklist Updated:`, remainingChecklistIDs);
        return remainingChecklistIDs;
    } catch (error) {
        console.warn("[DAG] Checklist Deduction Failed, falling back to naive pop:", error);
        // Safe fallback just in case the API glitches
        return []
        /*    let fallbackChecklist = [...currentChecklist];
           fallbackChecklist.shift();
           return fallbackChecklist; */
    }
};