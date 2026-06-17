import { AgentState } from "@/types/agent-state";
import { AgentPersona, getRandomProgressText } from "../agent-progess-persona";
import { executeGatekeeperNode, evaluateTrivialIntent } from "./node-0.5-gatekeeper";
import { executePlannerNode } from "./node-1-planner";
import { executeRouterNode } from "./node-2-router";
import { executeWithRetry } from "./node-3-intermediatory-executor";
import { executeFallbackNode } from "./node-(n-1)-fallbacker";
import { mergeIdempotentCalls, synthesizeDatabasePayload } from "./node-helpers/node-n-helpers";


export const processCommandAgentic = async (
    transcript: string,
    context: any,
    persistentState: Partial<AgentState> = {}, // Pass ONLY persistent state during a rewind
    onProgress?: (status: string) => void
): Promise<any> => {
    // 1. Initialize State
    let state: AgentState = {
        transcript,
        checklist: [],
        selectedDomain: "",
        selectedTools: [],
        chatHistory: [],
        pendingTurnPayload: [],
        toolResponses: [],
        finalTextResponse: "",
        isRewind: persistentState.isRewind ?? false,
        executedActionsLog: persistentState.executedActionsLog ?? [],
        accumulatedConfirmationCalls: persistentState.accumulatedConfirmationCalls ?? [],
    };

    try {
        // ==========================================
        // VANGUARD INTENT EVALUATION
        // ==========================================
        if (!state.isRewind) {
            if (evaluateTrivialIntent(state.transcript)) {
                return { response: "Yo! Ready to optimize your workflow. What are we building?", calls: [] };
            }

            const gatekeeper = await executeGatekeeperNode(state.transcript);
            if (gatekeeper.route === 'chat') {
                console.log("[DAG} Node Main: Gatekeeper Resovled to reply directly: CHAT")
                return { response: gatekeeper.chatResponse, calls: [] };
            }
        }
        console.log("[DAG} Node Main: Gatekeeper Resovled to enter the Pipeline: AGENT")
        onProgress?.(getRandomProgressText(AgentPersona.PLANNING));
        state.checklist = await executePlannerNode(state.transcript);

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
        while ((state.checklist.some(item => item.status === "PENDING") || state.pendingTurnPayload.length > 0) && safetyCounter < 10) {
            try {
                // Capture how many UI calls we had BEFORE running the executor this turn
                const prevCallsLength = state.accumulatedConfirmationCalls.length;

                // Run the Executor
                onProgress?.(getRandomProgressText(AgentPersona.EXECUTING))
                //const nodeResult = await executeActionNode(state, context, onProgress);
                const nodeResult = await executeWithRetry(state, context, onProgress);
                const historyPayloads = nodeResult.toolResponses?.filter(response =>
                    response.functionResponse?.name === 'searchHistoricalActions' || response.functionResponse?.name === 'getImmediateContext'
                );

                if (historyPayloads && historyPayloads.length > 0 && !state.isRewind) {
                    console.log("[DAG] Edge: REWINDING DAG Execution");
                    onProgress?.("Resolving contextual dependencies...");

                    // Synthesize raw relational/sqlite tables into flat markdown context
                    const structuredMemory = synthesizeDatabasePayload(historyPayloads);

                    const augmentedTranscript = `[SYSTEM CONTEXT: ENRICHED HISTORICAL DATABASE MATRIX]
                    ${structuredMemory}
                    [ORIGINAL USER COMMAND]
                    ${state.transcript}
                    [Existing Item Checklist]
                    ${JSON.stringify(nodeResult.checklist)}
                    [DETERMINISTIC INSTRUCTION]
                    Re-evaluate the user command using the enriched historical framework above. Resolve semantic ambiguities (e.g., replace 'that', 'it', or 'last item') with concrete entities found in the historical data matrix.`;

                    // Recurse seamlessly, passing updated execution tracking logs to guarantee DRY execution
                    return await processCommandAgentic(
                        augmentedTranscript,
                        context,
                        {
                            isRewind: true,
                            // Pass your completed checklist items (or custom hashes) to the log
                            executedActionsLog: nodeResult.executedActionsLog,
                            // CRITICAL: Save the UI calls we successfully accumulated before rewinding!
                            accumulatedConfirmationCalls: state.accumulatedConfirmationCalls
                        },
                        onProgress
                    );
                }

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
                if (state.toolResponses && state.toolResponses.length > 0) {
                    // Scenario A: Silent DB tool outputs need to be handled next
                    console.log("[DAG] Edge: Feeding DB results back into the next loop...");
                    onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
                    state.pendingTurnPayload = state.toolResponses;
                    state.toolResponses = [];
                }
                else if (pendingItems.length > 0) {

                    if (state.accumulatedConfirmationCalls.length > prevCallsLength) {
                        // Scenario B: Partial UI calls made, but list items remain. Nudge with a compliant text Part.
                        console.log("[DAG] Edge: Partial completion detected. Injecting text nudge part.");
                        state.pendingTurnPayload = [{
                            text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`
                        }];
                    }
                    else {
                        // Scenario C: Tunnel Vision. Force-override with a compliant text Part.
                        onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
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
                } else {
                    // Scenario D: Checklist is empty AND no tool responses. We are done!
                    state.pendingTurnPayload = [];
                }


                safetyCounter++;
                if (safetyCounter >= 10) {
                    console.log("[DAG] Edge: UH's OH's Safety counter exceeded. Exiting graph.");
                    break;
                }
            }
            catch (error) {
                const fallbackResult = await executeFallbackNode(state, error);
                return fallbackResult;
            }
        }
        console.log("[DAG] Edge: Execution complete. Exiting graph.");
        console.log("_________________________________________________________");
        console.log("[DAG] Node Main: FINAL State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
        console.log("_________________________________________________________");

        if (state.finalTextResponse) {
            state.finalTextResponse = state.finalTextResponse.replace('STATE_SYNC_RESOLVED', '').trim();
        }
        return {
            response: state.finalTextResponse,
            calls: state.accumulatedConfirmationCalls
        };

    } catch (error) {
        console.error("[DAG] Critical Graph Failure:", error);
        throw error;
    }
};
