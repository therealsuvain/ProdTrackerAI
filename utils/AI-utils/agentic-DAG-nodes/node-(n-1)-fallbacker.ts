import { AgentState } from "@/types/agent-state";

// Define this as a new node in your DAG
export const executeFallbackNode = async (
    state: AgentState,
    error: any
): Promise<{ response: string; calls: any[] }> => {
    console.error("[DAG] Node: FALLBACK triggered due to:", error);

    // 1. Path 1: Commit what we have (IDEMPOTENCY preserved)
    const successfulActions = state.accumulatedConfirmationCalls;

    // 2. Path 2: Human-in-the-loop (HITL) Handoff
    const failureMessage = `I've successfully performed what I could, but I ran into a limitation: "${error.message}". 
  I have stopped the automation to keep your data safe. 
  Would you like me to open the manual entry form for the remaining items, or shall we start a new request?`;

    return {
        response: failureMessage,
        calls: successfulActions, // Return what was safely committed
    };
};