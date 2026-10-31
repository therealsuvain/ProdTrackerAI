// const executePlannerNode = async (
//   transcript: string,
// ): Promise<ChecklistItem[]> => {
//   console.log("=========================================================");
//   console.log("[DAG] Node 1: PLANNER (Extracting Checklist)...");

//   const plannerPrompt = `
//   Extract a strict, separate list of actions the user wants to perform.
//   Example: "Create task Sleep due tomorrow and category Leisure" -> ["Create task Sleep due tomorrow", "Create category Leisure"]
//   CRITICAL: Preserve all specific metadata (dates, tags, priorities, goals) within the string. Do not strip them out.
//   CRITICAL: If the user's input is just conversational filler, agreement, or a greeting (e.g., "Ok", "Go ahead", "Thanks", "Yes"), return an empty array [].
//   User Input: "${transcript}"
//   `;
//   try {
//     const result = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash", // Use the cheapest model here
//       contents: [{ role: "user", parts: [{ text: plannerPrompt }] }],
//       config: {
//         responseMimeType: "application/json",
//         responseSchema: {
//           type: "ARRAY",
//           items: { type: "STRING" },
//           description:
//             "List of distinct tasks requested by the user, including all modifiers.",
//         },
//       },
//     });

//     recordGeminiUsage(result, "PLANNER"); // Hook up your metrics
//     console.log("[DAG] Node 1:FUNCTIONCALLS", result.functionCalls);
//     console.log("[DAG] Node 1:CHAT RESPONSE TEXT:", result.text);
//     console.log(
//       "[DAG] Node 1:CHAT Candidates.content:",
//       result.candidates?.[0]?.content,
//     );
//     console.log("[DAG] Node 1:FULL RESPONSE", result);
//     const checklist = JSON.parse(result.text || "[]");
//     console.log("[DAG] Checklist generated:", checklist);
//     console.log("=========================================================");
//     const objectifiedChecklist: ChecklistItem[] = checklist.map(
//       (intent: string, index: any) => ({
//         id: `chk-${index}`, // Bulletproof unique IDs
//         intent: intent,
//         status: "PENDING",
//       }),
//     );
//     return objectifiedChecklist;
//   } catch (e) {
//     console.error("Planner Node Failed:", e);
//     console.log("=========================================================");
//     return [{ id: "fallback-1", intent: transcript, status: "PENDING" }]; // Fallback to just the raw transcript
//   }
// };

// const executeRouterNode = async (
//   transcript: string,
//   checklist: string[],
// ): Promise<{ domain: string; tools: any[] }> => {
//   console.log("=========================================================");
//   console.log("[DAG] Node 2: ROUTER (Selecting Tool Bucket)...");

//   globalTranscript = transcript;

//   const routerPrompt = `
//   You are a highly efficient routing assistant.
//   The user wants to accomplish this checklist: ${JSON.stringify(checklist)}

//   Here is your master index of available tools:
//   ${JSON.stringify(MasterToolIndex, null, 2)}

//   Analyze the checklist. Which specific tools from the master index are required to fulfill the user's request?
//   Return ONLY a JSON array containing the exact string keys of the required tools.
//   `;

//   try {
//     const routerResponse = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash",
//       contents: [{ role: "user", parts: [{ text: routerPrompt }] }],
//       config: {
//         // NO MORE HEAVY TOOLS ARRAY HERE!
//         responseMimeType: "application/json",
//         responseSchema: {
//           type: "ARRAY",
//           items: { type: "STRING" },
//           description:
//             "An array of exactly matching string keys from the MasterToolIndex.",
//         },
//       },
//     });
//     recordGeminiUsage(routerResponse, "ROUTER");
//     console.log("[DAG] Node 2:FUNCTIONCALLS", routerResponse.functionCalls);
//     console.log("[DAG] Node 2:CHAT RESPONSE TEXT:", routerResponse.text);
//     console.log(
//       "[DAG] Node 2:CHAT Candidates.content:",
//       routerResponse.candidates?.[0]?.content,
//     );
//     console.log("[DAG] Node 2:FULL RESPONSE", routerResponse);

//     const requestedToolNames: string[] = JSON.parse(
//       routerResponse.text || "[]",
//     );
//     console.log("[DAG] Node 2: Resolved Tool Schemas", [...requestedToolNames]);
//     // 2. Pass them through our bulletproof injector
//     const resolvedToolSchemas = resolveDependencies(requestedToolNames);
//     console.log("[DAG] Node 2: Resolved Tool Schemas", [
//       ...resolvedToolSchemas.map((tool) => tool.name),
//     ]);
//     console.log("=========================================================");
//     return {
//       domain: requestedToolNames.join(", "),
//       tools: resolvedToolSchemas,
//     };
//   } catch (error) {
//     console.error("[DAG] Router execution failed:", error);
//     // Fallback: If it crashes, fail gracefully by loading standard tools
//     return {
//       domain: "Fallback",
//       tools: resolveDependencies(["addTask", "addHabit", "addCategory"]),
//     };
//   }
//   /* return { domain: requiredDomains.join(", "), tools: uniqueTools }; */
// };

// const executeChecklistDeductionNode = async (
//   currentChecklist: ChecklistItem[],
//   summary: ExecutionSummary,
// ): Promise<string[]> => {
//   // If the checklist is empty or no tools were called, nothing to deduce.
//   const pendingItems = currentChecklist.filter(
//     (item) => item.status === "PENDING",
//   );
//   if (
//     pendingItems.length === 0 ||
//     summary.tasksCreated.length +
//       summary.habitsCreated.length +
//       summary.categoriesCreated.length +
//       summary.tagsCreated.length ===
//       0
//   )
//     return [];

//   console.log("=========================================================");
//   console.log("[DAG] Micro-Node: DEDUCING CHECKLIST PROGRESS...");

//   const deductionPrompt = `
//   You are a strict, pessimistic auditor for an AI agent.
//   Pending Checklist Intents:
//   ${JSON.stringify(currentChecklist.map((i) => ({ id: i.id, intent: i.intent })))}

//   System Execution Summary (What was actually successfully created):
//   ${JSON.stringify(summary)}

//   Compare the executed tools against the checklist.
//   Return a JSON array containing ONLY the string "id"s of the checklist items that have been fully completed.
//   `;

//   try {
//     const response = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash", // Extremely fast/cheap micro-call
//       contents: [{ role: "user", parts: [{ text: deductionPrompt }] }],
//       config: {
//         responseMimeType: "application/json",
//         responseSchema: {
//           type: "ARRAY",
//           items: { type: "STRING" },
//           description: "The remaining, unfulfilled tasks.",
//         },
//       },
//     });
//     recordGeminiUsage(response, "Checklist DEDUCER");
//     const remainingChecklistIDs = JSON.parse(response.text || "[]");
//     console.log(`[DAG] Checklist Updated:`, remainingChecklistIDs);
//     return remainingChecklistIDs;
//   } catch (error) {
//     console.warn(
//       "[DAG] Checklist Deduction Failed, falling back to naive pop:",
//       error,
//     );
//     // Safe fallback just in case the API glitches
//     return [];
//   }
// };

// export const sanitizeChatHistory = (history: Content[]): Content[] => {
//   return history.map((turn) => ({
//     ...turn,
//     parts: turn.parts?.map((part: Part) => {
//       // Destructure to isolate thoughtSignature and keep the rest
//       const { thoughtSignature, ...sanitizedPart } = part;
//       return sanitizedPart;
//     }),
//   }));
// };

// // A robust deduplication helper using JSON stringification for deep comparison
// const mergeIdempotentCalls = (existingCalls: any[], newCalls: any[]): any[] => {
//   const merged = [...existingCalls];

//   for (const incomingCall of newCalls) {
//     // Create a deterministic signature of the function call
//     const signature = JSON.stringify({
//       name: incomingCall.name,
//       args: incomingCall.args, // Note: Ensure object keys are sorted if args order varies
//     });

//     const isDuplicate = merged.some(
//       (existingCall) =>
//         JSON.stringify({ name: existingCall.name, args: existingCall.args }) ===
//         signature,
//     );

//     if (!isDuplicate) {
//       merged.push(incomingCall);
//     } else {
//       console.warn(
//         `[DAG] Idempotency Shield: Dropped duplicate call for '${incomingCall.name}'`,
//       );
//     }
//   }

//   return merged;
// };

// /**
//  * Takes the LLM's requested tools, enforces strict prerequisites,
//  * and returns the full JSON schemas for the Executor.
//  */
// const resolveDependencies = (requestedToolNames: string[]): any[] => {
//   console.log("[DAG] Tool Names Requested by Router:", requestedToolNames);

//   // Use a Set to automatically prevent duplicates
//   const finalToolNames = new Set<string>(requestedToolNames);

//   // --- HARDCODED DEPENDENCY RULES ---

//   // 1. Assigning Taxonomy: If creating or editing items, we need category/tag UUIDs
//   if (
//     finalToolNames.has("addTask") ||
//     finalToolNames.has("editTask") ||
//     finalToolNames.has("deleteTask") ||
//     finalToolNames.has("completeTask") ||
//     finalToolNames.has("addHabit") ||
//     finalToolNames.has("checkinHabit") ||
//     finalToolNames.has("deleteHabit") ||
//     finalToolNames.has("addEvent") ||
//     finalToolNames.has("editEvent") ||
//     finalToolNames.has("deleteEvent") ||
//     finalToolNames.has("deleteSingleEvent")
//   ) {
//     finalToolNames.add("searchTaxonomy");
//     finalToolNames.add("searchItems");
//   }

//   // 2. Task Mutations: If updating, deleting, or completing a task, we must find its UUID first
//   if (
//     finalToolNames.has("editTask") ||
//     finalToolNames.has("deleteTask") ||
//     finalToolNames.has("completeTask")
//   ) {
//     finalToolNames.add("queryTasks"); // Or queryTasks, depending on your search handler's power
//   }

//   // 3. Habit Mutations: If editing or checking in, find the habit UUID
//   if (finalToolNames.has("deleteHabit") || finalToolNames.has("checkinHabit")) {
//     finalToolNames.add("queryHabits");
//   }

//   // 4. Event Mutations: Find the event UUID
//   if (
//     finalToolNames.has("editEvent") ||
//     finalToolNames.has("deleteEvent") ||
//     finalToolNames.has("deleteSingleEvent")
//   ) {
//     finalToolNames.add("queryEvents");
//   }

//   // 5. Taxonomy Mutations: Find the Category/Tag UUID
//   if (
//     finalToolNames.has("editCategory") ||
//     finalToolNames.has("deleteCategory") ||
//     finalToolNames.has("editTag") ||
//     finalToolNames.has("deleteTag") ||
//     finalToolNames.has("getTaxonomyStats")
//   ) {
//     finalToolNames.add("searchTaxonomy");
//   }
//   // --- MAPPING TO SCHEMAS ---
//   const finalSchemas: any[] = [];
//   finalToolNames.forEach((name) => {
//     const schema = AllToolSchemas[name];
//     if (schema) {
//       finalSchemas.push(schema);
//     } else {
//       console.warn(`[DAG] Warning: Router requested unknown tool '${name}'`);
//     }
//   });

//   console.log(
//     `[DAG] Dependency Injector Complete. Final Schema Count: ${finalSchemas.length}`,
//   );
//   return finalSchemas;
// };

// export const transformCallsForDeducer = (
//   executedCalls: any[],
// ): ExecutionSummary => {
//   const summary: ExecutionSummary = {
//     tasksCreated: [],
//     habitsCreated: [],
//     categoriesCreated: [],
//     tagsCreated: [],
//   };

//   for (const call of executedCalls) {
//     if (!call || !call.args) continue;

//     switch (call.name) {
//       case "addTask":
//         if (call.args.title) summary.tasksCreated.push(call.args.title);
//         break;
//       case "addHabit":
//         if (call.args.title) summary.habitsCreated.push(call.args.title);
//         break;
//       case "addCategory":
//         if (call.args.name) summary.categoriesCreated.push(call.args.name);
//         break;
//       case "addTag":
//         // Handle batched tags array
//         if (Array.isArray(call.args.names)) {
//           summary.tagsCreated.push(...call.args.names);
//         } else if (typeof call.args.name === "string") {
//           summary.tagsCreated.push(call.args.name); // Fallback if single string
//         }
//         break;
//       // Note: searchTaxonomy, queryTasks, etc. are implicitly ignored!
//     }
//   }

//   return summary;
// };

// const executeActionNode = async (
//   state: AgentState,
//   context: any,
//   onProgress?: (status: string) => void,
// ): Promise<Partial<AgentState>> => {
//   console.log("=========================================================");
//   console.log("[DAG] Node 3: EXECUTOR (Running Tools)...");
//   console.log("_________________________________________________________");
//   console.log(
//     "[DAG] Node 3: State Recieved:",
//     JSON.stringify({ ...state, selectedTools: state.selectedDomain }),
//   );
//   console.log("_________________________________________________________");
//   // Initialize chat session (your existing function)
//   const chat = await chatIntialize(
//     context,
//     state.selectedDomain,
//     state.selectedTools,
//     state.chatHistory,
//   );
//   //!const payload = state.chatHistory.length === 0 ? state.transcript : state.chatHistory;
//   const payload =
//     state.chatHistory.length === 0
//       ? state.transcript
//       : state.pendingTurnPayload;
//   // Inject the ongoing chat history so it remembers previous turns!
//   const response = await chat.sendMessage({ message: payload });

//   recordGeminiUsage(response, "Action EXECUTOR");
//   console.log("[DAG] Node 3:FUNCTIONCALLS", response.functionCalls);
//   console.log("[DAG] Node 3:CHAT RESPONSE TEXT:", response.text);
//   console.log(
//     "[DAG] Node 3:CHAT Candidates.content:",
//     response.candidates?.[0]?.content,
//   );
//   console.log("[DAG] Node 3:FULL RESPONSE", response);

//   const currentCalls = response.functionCalls || [];
//   let toolResponsesForNextTurn: any[] = [];
//   let newConfirmationCalls: any[] = [];
//   console.log(
//     "[DAG] Node 3: Received Funtion Calls:",
//     JSON.stringify(currentCalls, null, 2),
//   );
//   // 1. Sort calls into Silent vs Confirmation
//   for (const call of currentCalls) {
//     //  Announce the specific tool before we execute it!
//     if (call.name.toLowerCase().includes("task"))
//       onProgress?.(getRandomProgressText(AgentPersona.ACTION_TASK));
//     else if (call.name.toLowerCase().includes("habit"))
//       onProgress?.(getRandomProgressText(AgentPersona.ACTION_HABIT));
//     else if (call.name.toLowerCase().includes("category"))
//       onProgress?.(getRandomProgressText(AgentPersona.ACTION_CATEGORY));
//     else if (call.name.toLowerCase().includes("tag"))
//       onProgress?.(getRandomProgressText(AgentPersona.ACTION_TAG));
//     else if (call.name.toLowerCase().includes("search"))
//       onProgress?.(getRandomProgressText(AgentPersona.ACTION_SEARCH));

//     if (
//       SilentHandlerList.includes(call.name) ||
//       call.args?.isPrerequisite === true
//     ) {
//       console.log(`[Silent-Agent] Executing ${call.name}...`);
//       try {
//         const data = await ActionRegistry[call.name].execute(
//           call.args,
//           context,
//         );
//         const formattedData =
//           typeof data === "object" && data !== null ? data : { result: data };
//         toolResponsesForNextTurn.push({
//           functionResponse: { name: call.name, response: formattedData },
//         });
//       } catch (error: any) {
//         console.error(`[DAG] Error executing ${call.name}:`, error);

//         // THE MAGIC: Feed the error directly back to the LLM's context window
//         toolResponsesForNextTurn.push({
//           functionResponse: {
//             name: call.name,
//             response: {
//               error: {
//                 errorMessage: error.message || "Database constraint failed.",
//                 systemInstruction:
//                   "CRITICAL: The tool failed. Apologize to the user, explain this specific error briefly, and ask them how they want to proceed (e.g., pick a different name).",
//               },
//             },
//           },
//         });
//       }
//     } else {
//       newConfirmationCalls.push(call);
//     }
//   }
//   console.log(
//     "[DAG] Node 3: Intermediate Confirmation Calls:",
//     JSON.stringify(newConfirmationCalls, null, 2),
//   );
//   // ==========================================
//   // REPLACED: Smart Checklist Deduction
//   // ==========================================
//   // We feed ALL executed tools (both silent and UI confirmations) to the deduction node
//   console.log("[DAG] Node 3: Intial Checklist:", state.checklist);
//   const allExecutedToolsForDeduction = [...currentCalls];
//   const executionSummary = transformCallsForDeducer(
//     allExecutedToolsForDeduction,
//   );
//   const remainingChecklistIDs = await executeChecklistDeductionNode(
//     state.checklist,
//     executionSummary,
//   );
//   const updatedChecklist = state.checklist.map((item) =>
//     remainingChecklistIDs.includes(item.id)
//       ? { ...item, status: "COMPLETED" }
//       : item,
//   ) as ChecklistItem[];
//   const updatedHistory = await chat.getHistory();
//   const sanitizedHistory = sanitizeChatHistory(updatedHistory);

//   console.log("[DAG] Node 3:  Updated Checklist:", updatedChecklist);

//   console.log("_________________________________________________________");
//   console.log("[DAG] Node 3: Results", {
//     accumulatedConfirmationCalls: [
//       ...state.accumulatedConfirmationCalls,
//       ...newConfirmationCalls,
//     ],
//     finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
//     chatHistory:
//       toolResponsesForNextTurn.length > 0 ? toolResponsesForNextTurn : [],
//     history: sanitizedHistory,
//   });
//   console.log("=========================================================");
//   return {
//     accumulatedConfirmationCalls: [
//       ...state.accumulatedConfirmationCalls,
//       ...newConfirmationCalls,
//     ],
//     finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
//     checklist: updatedChecklist,
//     chatHistory: sanitizedHistory,
//     toolResponses: toolResponsesForNextTurn,
//   };
// };

// export const processCommandAgentic = async (
//   transcript: string,
//   context: any,
//   onProgress?: (status: string) => void,
// ) => {
//   // 1. Initialize State
//   let state: AgentState = {
//     transcript,
//     checklist: [],
//     selectedDomain: "",
//     selectedTools: [],
//     chatHistory: [],
//     pendingTurnPayload: [],
//     toolResponses: [],
//     accumulatedConfirmationCalls: [],
//     finalTextResponse: "",
//   };

//   try {
//     // 2. Run Planner (Only if prompt looks complex, otherwise skip to save tokens)
//     if (transcript.includes("and") || transcript.includes(",")) {
//       onProgress?.(getRandomProgressText(AgentPersona.PLANNING));
//       state.checklist = await executePlannerNode(state.transcript);
//     } else {
//       state.checklist = [
//         { id: "fallback-1", intent: state.transcript, status: "PENDING" },
//       ];
//     }

//     // 3. Run Router
//     onProgress?.(getRandomProgressText(AgentPersona.ROUTING));
//     const { domain, tools } = await executeRouterNode(
//       state.transcript,
//       state.checklist.map((item) => item.intent),
//     );
//     state.selectedDomain = domain;
//     state.selectedTools = tools;

//     // 4. The Graph Edge Loop
//     console.log("_________________________________________________________");
//     console.log(
//       "[DAG] Node Main: State:",
//       JSON.stringify({ ...state, selectedTools: state.selectedDomain }),
//     );
//     console.log("_________________________________________________________");
//     let safetyCounter = 0;
//     while (
//       state.checklist.some((item) => item.status === "PENDING") &&
//       safetyCounter < 10
//     ) {
//       // Capture how many UI calls we had BEFORE running the executor this turn
//       const prevCallsLength = state.accumulatedConfirmationCalls.length;

//       // Run the Executor
//       onProgress?.("Executing actions ");
//       const nodeResult = await executeActionNode(state, context, onProgress);
//       const newConfirmationCalls =
//         nodeResult.accumulatedConfirmationCalls || [];
//       // Merge them deterministically with our existing calls
//       const safeAccumulatedCalls = mergeIdempotentCalls(
//         state.accumulatedConfirmationCalls,
//         newConfirmationCalls,
//       );
//       // Mutate State
//       state = {
//         ...state,
//         ...nodeResult,
//         accumulatedConfirmationCalls: safeAccumulatedCalls,
//       };

//       const pendingItems = state.checklist.filter(
//         (item) => item.status === "PENDING",
//       );
//       // THE CONDITIONAL EDGE: Are we done?
//       if (pendingItems.length > 0) {
//         if (state.toolResponses && state.toolResponses.length > 0) {
//           // Scenario A: Silent DB tool outputs need to be handled next
//           console.log(
//             "[DAG] Edge: Feeding DB results back into the next loop...",
//           );
//           state.pendingTurnPayload = state.toolResponses;
//         } else if (
//           state.accumulatedConfirmationCalls.length > prevCallsLength
//         ) {
//           // Scenario B: Partial UI calls made, but list items remain. Nudge with a compliant text Part.
//           console.log(
//             "[DAG] Edge: Partial completion detected. Injecting text nudge part.",
//           );
//           state.pendingTurnPayload = [
//             {
//               text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`,
//             },
//           ];
//         } else {
//           // Scenario C: Tunnel Vision. Force-override with a compliant text Part.
//           console.log(
//             `[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`,
//           );
//           state.pendingTurnPayload = [
//             {
//               text: `System Override: You stopped abruptly, but you still MUST fulfill these requests: ${JSON.stringify(state.checklist)}. Call the required tools now.`,
//             },
//           ];
//         }
//       }

//       safetyCounter++;
//     }
//     console.log("[DAG] Edge: Execution complete. Exiting graph.");
//     console.log("_________________________________________________________");
//     console.log(
//       "[DAG] Node Main: FINAL State:",
//       JSON.stringify({ ...state, selectedTools: state.selectedDomain }),
//     );
//     console.log("_________________________________________________________");
//     // 5. Return exact same payload to the UI
//     return {
//       response: state.finalTextResponse,
//       calls: state.accumulatedConfirmationCalls,
//     };
//   } catch (error) {
//     console.error("[DAG] Critical Graph Failure:", error);
//     throw error;
//   }
// };
