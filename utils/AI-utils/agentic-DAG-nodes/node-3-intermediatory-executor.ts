import { AgentState, ChecklistItem } from "@/types/agent-state";
import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { AgentPersona, getRandomProgressText } from "../agent-progess-persona";
import { ActionRegistry, SilentHandlerList } from "../agentic-handlers/registry-handler";
import { sanitizeChatHistory, transformCallsForDeducer } from "./node-helpers/node-3-helpers";
import { chatIntialize } from "./node-0-chat-initializer";
import { executeChecklistDeductionNode } from "./node-3.5-checklist-deducer";

export const executeActionNode = async (state: AgentState, context: any, onProgress?: (status: string) => void): Promise<Partial<AgentState>> => {
    console.log("=========================================================");
    console.log("[DAG] Node 3: EXECUTOR (Running Tools)...");
    console.log("_________________________________________________________");
    console.log("[DAG] Node 3: State Recieved:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
    console.log("_________________________________________________________");
    // Initialize chat session (your existing function)
    const chat = await chatIntialize(context, state.selectedDomain, state.selectedTools, state.chatHistory);
    //!const payload = state.chatHistory.length === 0 ? state.transcript : state.chatHistory;
    const payload = state.chatHistory.length === 0 ? state.transcript : state.pendingTurnPayload;
    // Inject the ongoing chat history so it remembers previous turns!
    const response = await chat.sendMessage({ message: payload });

    recordGeminiUsage(response, "Action EXECUTOR");
    console.log("[DAG] Node 3:FUNCTIONCALLS", response.functionCalls);
    console.log("[DAG] Node 3:CHAT RESPONSE TEXT:", response.text);
    console.log("[DAG] Node 3:CHAT Candidates.content:", response.candidates?.[0]?.content);
    console.log("[DAG] Node 3:FULL RESPONSE", response)

    const currentCalls = response.functionCalls || [];
    let toolResponsesForNextTurn: any[] = [];
    let newConfirmationCalls: any[] = [];
    console.log("[DAG] Node 3: Received Funtion Calls:", JSON.stringify(currentCalls, null, 2));
    // 1. Sort calls into Silent vs Confirmation
    for (const call of currentCalls) {
        //  Announce the specific tool before we execute it!
        if (call.name.toLowerCase().includes("task")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_TASK));
        else if (call.name.toLowerCase().includes("habit")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_HABIT));
        else if (call.name.toLowerCase().includes("category")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_CATEGORY));
        else if (call.name.toLowerCase().includes("tag")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_TAG));
        else if (call.name.toLowerCase().includes("search")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_SEARCH));
        else if (call.name.toLowerCase().includes("event")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_EVENT));

        if (SilentHandlerList.includes(call.name) || call.args?.isPrerequisite === true) {
            console.log(`[Silent-Agent] Executing ${call.name}...`);
            try {
                const data = await ActionRegistry[call.name].execute(call.args, context);
                const formattedData = typeof data === 'object' && data !== null ? data : { result: data };
                toolResponsesForNextTurn.push({ functionResponse: { name: call.name, response: formattedData } });
            } catch (error: any) {
                console.error(`[DAG] Error executing ${call.name}:`, error);

                // THE MAGIC: Feed the error directly back to the LLM's context window
                toolResponsesForNextTurn.push({
                    functionResponse: {
                        name: call.name,
                        response: {
                            "error": {
                                errorMessage: error.message || "Database constraint failed.",
                                systemInstruction: "CRITICAL: The tool failed. Apologize to the user, explain this specific error briefly, and ask them how they want to proceed (e.g., pick a different name)."
                            }
                        }
                    }
                });
            }
        } else {
            newConfirmationCalls.push(call);
        }
    }
    console.log("[DAG] Node 3: Intermediate Confirmation Calls:", JSON.stringify(newConfirmationCalls, null, 2));
    // ==========================================
    // REPLACED: Smart Checklist Deduction
    // ==========================================
    // We feed ALL executed tools (both silent and UI confirmations) to the deduction node
    console.log("[DAG] Node 3: Intial Checklist:", state.checklist);
    const allExecutedToolsForDeduction = [...currentCalls];
    const executionSummary = transformCallsForDeducer(allExecutedToolsForDeduction);
    const remainingChecklistIDs = await executeChecklistDeductionNode(
        state.checklist,
        executionSummary
    );
    const updatedChecklist = state.checklist.map(item =>
        remainingChecklistIDs.includes(item.id) ? { ...item, status: "COMPLETED" } : item
    ) as ChecklistItem[];
    const updatedHistory = await chat.getHistory();
    const sanitizedHistory = sanitizeChatHistory(updatedHistory);

    console.log("[DAG] Node 3:  Updated Checklist:", updatedChecklist);

    console.log("_________________________________________________________");
    console.log("[DAG] Node 3: Results", {
        accumulatedConfirmationCalls: [...state.accumulatedConfirmationCalls, ...newConfirmationCalls],
        finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
        chatHistory: toolResponsesForNextTurn.length > 0 ? toolResponsesForNextTurn : [],
        history: sanitizedHistory
    });
    console.log("=========================================================");
    return {
        accumulatedConfirmationCalls: [...newConfirmationCalls],
        finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
        checklist: updatedChecklist,
        chatHistory: sanitizedHistory,
        toolResponses: toolResponsesForNextTurn
    };
};