import { ChecklistItem, ExecutionSummary } from "@/types/agent-state";
import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";

export const executeChecklistDeductionNode = async (
    currentChecklist: ChecklistItem[],
    summary: ExecutionSummary
): Promise<string[]> => {
    // If the checklist is empty or no tools were called, nothing to deduce.

    const pendingItems = currentChecklist.filter(item => item.status === "PENDING");
    if (pendingItems.length === 0
        //||(summary.tasksCreated.length + summary.habitsCreated.length + summary.categoriesCreated.length + summary.tagsCreated.length) === 0
    )
        return [];

    console.log("=========================================================");
    console.log("[DAG] Micro-Node: DEDUCING CHECKLIST PROGRESS...");
    console.log("[DAG] Pending Checklist Items:", JSON.stringify(pendingItems));
    console.log("[DAG] Summary:", JSON.stringify(summary));
    const deductionPromptOLD = `
  You are an auditor verifying task completion based on entity names.
  
  Pending Checklist Items: ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
  Execution Summary: ${JSON.stringify(summary)}

  Logic: 
  1. For each checklist intent, extract the core entity name (e.g., Task name, Habit name, Category name).
  2. If that entity name is present in the corresponding array in the Execution Summary (tasksCreated, habitsCreated, categoriesCreated, or tagsCreated), mark the checklist item as COMPLETED.
  3. If a checklist item's intent begins with the [INQUIRY] prefix, it does NOT require a tool call or database mutation to be completed. 
     You must return ID of the [INQUIRY] item immediately if the provided summary data indicates inquiriesHandled": true.
  Return a JSON array of completed IDs.
`;
    const deductionPrompt = `
  You are an elite QA Auditor for an Agentic workflow.
  Your job is to determine which Pending Checklist Items have been logically fulfilled by the tools that were just executed.
  
  Pending Checklist Items: ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
  Execution Summary (What just happened): ${JSON.stringify(summary)}

  EVALUATION RULES:
  1. [INQUIRIES]: If an intent begins with the [INQUIRY] prefix and the summary shows "inquiriesHandled": true, mark it COMPLETED immediately.
  2. [SEMANTIC FULFILLMENT]: Look at the "mutations" array. Do not look for exact string matches. Instead, ask: "Did the tools executed logically fulfill the user's intent?" 
     - Example: Intent says "Edit the habit we just added and change its name to GameOfThrones". The summary shows {"tool": "editHabit", "args": {"title": "GameOfThrones"}}. This is a logical match. Mark it COMPLETED.
  3. [CONTEXTUAL FORGIVENESS]: If the checklist intent uses vague pronouns ("it", "that", "the task") but the executed tool corresponds to the requested action (e.g., editing, deleting, checking in), assume the agent correctly resolved the underlying ID and mark it COMPLETED.
  4. [STRICT REJECTION]: Do NOT mark an item completed if no relevant tools were fired. If the intent says "Add a task" and the mutations only show "addCategory", do NOT mark it completed.

  Return a raw JSON array containing ONLY the IDs of the completed checklist items.
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