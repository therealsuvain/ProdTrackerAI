import { AIActionContext } from "@/types/ai-handler";
import { processExecutionFeedback } from "./node-5-execution-feedbacker";
import { FunctionCall } from "@google/genai";
import { ActionRegistry } from "../agentic-handlers/registry-handler";

export const agenticExecutor = async (calls: FunctionCall[] | undefined, context: AIActionContext, userTranscript: string) => {
    console.log("Executing agentic actions:", calls);
    const executionResults = [];
    if (calls) {
        for (const call of calls) {
            if (!call.name) continue;
            const handler = ActionRegistry[call.name];
            if (handler) {
                try {
                    console.log(`[Agent] Calling ${call.name} with:`, call.args);
                    const result = await handler.execute(call.args, context);
                    executionResults.push({
                        tool: call.name,
                        args: call.args,
                        result: result || { status: "success", message: "Action executed." } // Fallback
                    });
                } catch (error: any) {
                    executionResults.push({
                        tool: call.name,
                        result: { status: "error", message: error.message || "Unknown error occurred." }
                    });
                }
            }
        }
        const feedback = await processExecutionFeedback(executionResults, context, userTranscript);
        return feedback;
        //return { success: true, message: "Actions executed successfully." };
    }
}