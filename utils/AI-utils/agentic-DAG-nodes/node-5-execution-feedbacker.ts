import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";
import { sanitizeForFeedbackNode } from "./node-helpers/node-5-helpers";

export const processExecutionFeedback = async (executionResults: any[], context: any, transcript: string) => {
    // If nothing was executed, do nothing
    if (!executionResults || executionResults.length === 0) return null;
    console.log("FEEDBACK LOOP, EXECUTION RESUTLS", JSON.stringify(executionResults, null, 2));
    const sanitizedResults = sanitizeForFeedbackNode(executionResults);
    console.log("SERVING FEEDBACK FOR USER REQUEST: ", transcript)
    console.log("With SANITIZED Results: ", JSON.stringify(sanitizedResults, null, 2))
    // Create a silent system prompt telling the AI what just happened
    const feedbackPrompt = `
  The user originally asked: "${transcript}"
  [SYSTEM PROTOCOL: EXECUTION RESULTS]
  The user confirmed your proposed actions. Here are the real-world results of those executions:
  ${JSON.stringify(sanitizedResults, null, 2)}
  
  Please provide a brief, conversational summary to the user based on these rules:
  1. If 'status' is 'success', keep it short and encouraging.
  2. If 'status' is 'denied' (e.g., habit already checked in), casually mention it so they know.
  3. If 'status' is 'partial_success' (e.g., a task was saved but the reminder failed), explicitly tell the user that the item was saved, but ask them if they want to try setting the reminder again for a valid future time.
  4. If 'status' is 'error' (e.g., Item Not Found), DO NOT attempt to use tools again. Apologize to the user, tell them exactly which item couldn't be found, and ask them to clarify the name or check if they already deleted it.
  `;

    try {
        const result = await gemini_ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{ role: "user", parts: [{ text: feedbackPrompt }] }]
        });
        //await chat.sendMessage({ message: feedbackPrompt });
        recordGeminiUsage(result, "FEEDBACK");

        // Return the AI's final natural language summary to display in the chat UI
        return result.text?.replace(/```json|```/g, "").trim();
    } catch (error) {
        console.error("Failed to generate post-execution summary:", error);
        // Fallback if AI fails: map the raw messages for the UI
        return executionResults.map(r => r.result.message).join("\n");
    }
};