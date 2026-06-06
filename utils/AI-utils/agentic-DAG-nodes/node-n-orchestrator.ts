import { AgentState } from "@/types/agent-state";
import { AgentPersona, getRandomProgressText } from "../agent-progess-persona";
import { mergeIdempotentCalls } from "./agent-helper-utlilites";
import { executePlannerNode } from "./node-1-planner";
import { executeRouterNode } from "./node-2-router";
import { executeActionNode } from "./node-3-intermediatory-executor";

export const processCommandAgentic = async (transcript: string, context: any, onProgress?: (status: string) => void) => {
    // 1. Initialize State
    let state: AgentState = {
        transcript,
        checklist: [],
        selectedDomain: "",
        selectedTools: [],
        chatHistory: [],
        pendingTurnPayload: [],
        toolResponses: [],
        accumulatedConfirmationCalls: [],
        finalTextResponse: ""
    };

    try {
        // 2. Run Planner (Only if prompt looks complex, otherwise skip to save tokens)
        if (transcript.includes("and") || transcript.includes(",")) {
            onProgress?.(getRandomProgressText(AgentPersona.PLANNING));
            state.checklist = await executePlannerNode(state.transcript);
        } else {
            state.checklist = [{ id: "fallback-1", intent: state.transcript, status: "PENDING" }];
        }

        // 3. Run Router
        onProgress?.(getRandomProgressText(AgentPersona.ROUTING));
        const { domain, tools } = await executeRouterNode(state.transcript, state.checklist.map((item) => item.intent));
        state.selectedDomain = domain;
        state.selectedTools = tools;

        // 4. The Graph Edge Loop
        console.log("_________________________________________________________");
        console.log("[DAG] Node Main: State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
        console.log("_________________________________________________________");
        let safetyCounter = 0;
        while (state.checklist.some(item => item.status === "PENDING") && safetyCounter < 10) {

            // Capture how many UI calls we had BEFORE running the executor this turn
            const prevCallsLength = state.accumulatedConfirmationCalls.length;

            // Run the Executor
            onProgress?.("Executing actions ")
            const nodeResult = await executeActionNode(state, context, onProgress);
            const newConfirmationCalls = nodeResult.accumulatedConfirmationCalls || [];
            // Merge them deterministically with our existing calls
            const safeAccumulatedCalls = mergeIdempotentCalls(state.accumulatedConfirmationCalls, newConfirmationCalls);
            // Mutate State
            state = {
                ...state,
                ...nodeResult,
                accumulatedConfirmationCalls: safeAccumulatedCalls,
            }

            const pendingItems = state.checklist.filter(item => item.status === "PENDING");
            // THE CONDITIONAL EDGE: Are we done?
            if (pendingItems.length > 0) {
                if (state.toolResponses && state.toolResponses.length > 0) {
                    // Scenario A: Silent DB tool outputs need to be handled next
                    console.log("[DAG] Edge: Feeding DB results back into the next loop...");
                    state.pendingTurnPayload = state.toolResponses;
                }
                else if (state.accumulatedConfirmationCalls.length > prevCallsLength) {
                    // Scenario B: Partial UI calls made, but list items remain. Nudge with a compliant text Part.
                    console.log("[DAG] Edge: Partial completion detected. Injecting text nudge part.");
                    state.pendingTurnPayload = [{
                        text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`
                    }];
                }
                else {
                    // Scenario C: Tunnel Vision. Force-override with a compliant text Part.
                    console.log(`[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`);
                    const isReconciling = state.chatHistory.some(msg =>
                        msg.parts?.[0]?.text?.includes("RECONCILIATION_CHECK")
                    );

                    if (isReconciling) {
                        // The AI has already been prompted to reconcile and still returned no tools.
                        // At this point, we assume the AI considers the task done despite the Deducer's check.
                        console.warn("[DAG] Reconciliation conflict resolved. Trusting Executor. Exiting graph.");
                        break;
                    } else {
                        console.log(`[DAG] Edge: Conflict detected! Initiating Reconciliation...`);
                        state.pendingTurnPayload = [{
                            text: `RECONCILIATION_CHECK: You generated no tools, but the system shows these items are still PENDING: ${JSON.stringify(pendingItems)}. 
                       If you already generated the tools for these in a previous turn, reply with 'STATE_SYNC_RESOLVED'. 
                       If you missed them, generate the required tools now.`
                        }];
                    }
                    /*  state.pendingTurnPayload = [{
                       text: `System Override: You stopped abruptly, but you still MUST fulfill these requests: ${JSON.stringify(state.checklist)}. Call the required tools now.`
                     }]; */
                }
                /*  if (state.chatHistory.length > 0) {
                   // We have silent DB results to feed back to the AI. Loop again.
                   onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
                   console.log("[DAG] Edge: Silent tools executed, looping back to Executor...");
                 }
                 else if (state.accumulatedConfirmationCalls.length > prevCallsLength) {
                   // It successfully generated UI calls, BUT the checklist isn't empty yet.
                   // Nudge it to keep going instead of exiting.
                   console.log("[DAG] Edge: Partial completion detected. Nudging AI to finish checklist.");
                   state.chatHistory = [{
                     text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`
                   }
                   ];
                 }
                 else {
                   // TUNNEL VISION DETECTED! The AI stopped, but the checklist isn't empty.
                   onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
                   console.log(`[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`);
         
                   // Jolt the AI with a strict system override
                   state.chatHistory = [{
                     text: `System Override: You stopped, but you still need to fulfill this request: "${state.checklist[0]}". Call the required tools now.`
                   }];
                 } */
            }


            safetyCounter++;
        }
        console.log("[DAG] Edge: Execution complete. Exiting graph.");
        console.log("_________________________________________________________");
        console.log("[DAG] Node Main: FINAL State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
        console.log("_________________________________________________________");
        // 5. Return exact same payload to the UI
        return {
            response: state.finalTextResponse,
            calls: state.accumulatedConfirmationCalls
        };

    } catch (error) {
        console.error("[DAG] Critical Graph Failure:", error);
        throw error;
    }
};
