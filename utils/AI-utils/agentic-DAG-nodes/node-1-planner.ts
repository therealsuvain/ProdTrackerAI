import { ChecklistItem } from "@/types/agent-state";
import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";

export const executePlannerNode = async (transcript: string): Promise<ChecklistItem[]> => {
    console.log("=========================================================");
    console.log("[DAG] Node 1: PLANNER (Extracting Checklist)...");

    const plannerPrompt = `
  Extract a strict, separate list of actions the user wants to perform. 
  Example: "Create task Sleep due tomorrow and category Leisure" -> ["Create task Sleep due tomorrow", "Create category Leisure"]
  CRITICAL: Preserve all specific metadata (dates, tags, priorities, goals) within the string. Do not strip them out.
  CRITICAL: If the user's input is just conversational filler, agreement, or a greeting (e.g., "Ok", "Go ahead", "Thanks", "Yes"), return an empty array [].
  User Input: "${transcript}"
  `;
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

        recordGeminiUsage(result, "PLANNER"); // Hook up your metrics
        console.log("[DAG] Node 1:FUNCTIONCALLS", result.functionCalls);
        console.log("[DAG] Node 1:CHAT RESPONSE TEXT:", result.text);
        console.log("[DAG] Node 1:CHAT Candidates.content:", result.candidates?.[0]?.content);
        console.log("[DAG] Node 1:FULL RESPONSE", result)
        const checklist = JSON.parse(result.text || "[]");
        console.log("[DAG] Checklist generated:", checklist);
        console.log("=========================================================");
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