import { ChecklistItem } from "@/types/agent-state";
import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";

export const executePlannerNode = async (transcript: string): Promise<ChecklistItem[]> => {
    console.log("=========================================================");
    console.log("[DAG] Node 1: PLANNER (Extracting Checklist)...");

    const plannerPrompt = `
  Extract a strict, separate list of actions the user wants to perform. 
  Example: "Create task Task_X due tomorrow and add category ABC" -> ["Create task Task_X due tomorrow", "Create category ABC"]
  Example: "Create task Task_X due tomorrow and set its category to XYZ" -> ["Create task Task_X due tomorrow, category = XYZ"]
  CRITICAL: Preserve all specific metadata (dates, tags, priorities, goals) within the string adn within a single action. Do not strip them out.
  CRITICAL: If the user's input is just conversational filler, agreement, or a greeting (e.g., "Ok", "Go ahead", "Thanks", "Yes"), return an empty array [].
  CRITICAL:If the user explicitly asks a question, requests a summary, or wants to know their state (e.g., "What did I just add?", "Show my tasks"), prefix the intent with [INQUIRY].
  User Input: "${transcript}"
  `;
    const plannerPromptNEW = `
  [TASK]
  You are a deterministic query expansion module. Your job is to extract a strict, separate list of actions the user wants to perform.
  If the input contains a historical database matrix, you MUST resolve all semantic ambiguities (pronouns, temporal references like 'last habit') into concrete entities using that history.
  
  CRITICAL RULES:
  1. Preserve all specific metadata (dates, tags, priorities, goals) within the string.
  2. If the user's input is conversational filler, agreement, or a greeting (e.g., "Ok", "Go ahead", "Thanks", "Yes"), return an empty checklist array [].

  [EXAMPLE WORKFLOW]
  User: "Edit the habit we just added and change its name to GameOfThrones"
  History: [{"name": "editHabit", "args": {"title": "Poker"}}]
  Output:
  {
    "entity_resolution_reasoning": "The user refers to 'the habit we just added'. History shows 'Poker' was just added.",
    "resolved_transcript": "Edit the habit Poker and change its name to GameOfThrones",
    "checklist": ["Edit habit Poker to GameOfThrones"]
  }

  [CURRENT EXECUTION]
  Input Data (Transcript & Potential History Matrix): 
  "${transcript}"
  `;

    //   If the user asks a question, requests a summary, or inquires about their recent history or current state, you MUST prefix the intent string with [INQUIRY].
    //     Example Inquiry: "[INQUIRY] What habit did I just add?"


    //    CRITICAL: CONTEXT RESOLUTION PROTOCOL 
    //         Users will often refer to past actions without providing exact names, UUIDs, or details. You MUST add can action to use memory tools so that that the executor BEFORE attempting to execute modification tools (like editTask, deleteHabit, etc.) if you lack the UUID.

    //         TRIGGER 1: SHORT-TERM MEMORY (Use \`getImmediateContext\`)
    //         Call this tool IMMEDIATELY and WITHOUT asking the user for clarification if the user prompt contains:
    //         - Relative pronouns ("it", "that", "those", "the last one")
    //         - Conversational Undo commands ("Wait, undo that", "I didn't mean to delete that", "Revert the last action")
    //         - Immediate follow-ups ("Actually, make its priority high")

    //         TRIGGER 2: LONG-TERM MEMORY (Use \`searchHistoricalActions\`)
    //         Call this tool if the user refers to past projects, workflows, or temporal events where the exact UUID is no longer in the current conversational window.
    //         - Time references ("the tasks I added yesterday", "last week's habits")
    //         - Workflow resumption ("Let's finish the Japan trip checklist", "Add another item to my grocery list")
    //         *Note: Keep keywords broad (e.g., ["Japan", "Trip"] or ["Grocery"]). Default to searching 7 days back unless specified.*
    try {
        const result = await gemini_ai.models.generateContent({
            model: "gemini-2.5-flash", // Use the cheapest model here
            contents: [{ role: "user", parts: [{ text: plannerPrompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "List of distinct tasks requested by the user, including all modifiers."
                }
            }
        });


        /*  try {
             const result = await gemini_ai.models.generateContent({
                 model: "gemini-2.5-flash",
                 contents: [{ role: "user", parts: [{ text: plannerPrompt }] }],
                 config: {
                     responseMimeType: "application/json",
                     responseSchema: {
                         type: "OBJECT",
                         properties: {
                             entity_resolution_reasoning: {
                                 type: "STRING",
                                 description: "Briefly identify vague terms (e.g., 'last habit') and map them to specific entities in the history matrix. If no history exists, explicitly state 'No entity resolution required'."
                             },
                             resolved_transcript: {
                                 type: "STRING",
                                 description: "The user's command completely rewritten using the concrete entity names found in step 1."
                             },
                             checklist: {
                                 type: "ARRAY",
                                 items: { type: "STRING" },
                                 description: "Actionable intents using ONLY the nouns from the resolved_transcript. Return empty [] if just conversational filler."
                             }
                         },
                         required: ["entity_resolution_reasoning", "resolved_transcript", "checklist"]
                     }
                 }
             }); */

        recordGeminiUsage(result, "PLANNER");
        console.log("[DAG] Node 1:CHAT RESPONSE TEXT:", result.text);
        console.log("[DAG] Node 1:CHAT Candidates.content:", result.candidates?.[0]?.content);
        console.log("[DAG] Node 1:FULL RESPONSE", result)
        const parsedResponse = JSON.parse(result.text || "[]");
        console.log("[DAG] Node 1: CoT Reasoning:", parsedResponse.entity_resolution_reasoning);
        console.log("[DAG] Node 1: Resolved Transcript:", parsedResponse.resolved_transcript);
        console.log("[DAG] Node 1: Generated Checklist:", parsedResponse.checklist);
        console.log("=========================================================");
        const checklist = parsedResponse;
        //const checklist = parsedResponse.checklist || [];
        // Early Exit: Conversational filler bypassed
        if (checklist.length === 0) {
            return [];
        }
        const objectifiedChecklist: ChecklistItem[] = checklist.map((intent: string, index: any) => ({
            id: `chk-${index}`, // Bulletproof unique IDs
            intent: intent,
            status: "PENDING"
        }));
        return objectifiedChecklist;

    } catch (e) {
        console.error("Planner Node Failed:", e);
        console.log("=========================================================");
        return [{ id: "fallback-1", intent: transcript, status: "PENDING" }]; // Fallback to just the raw transcript
    }

};