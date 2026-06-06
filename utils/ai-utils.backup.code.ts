
//export const DESTRUCTIVE_ACTIONS = ['delete_task', 'delete_event', 'delete_habit'];

//export const isDestructive = (intent: string) => DESTRUCTIVE_ACTIONS.includes(intent);


//OLD Seperate Below code till next Tag, into their own seperate files, maintaining this monolith temporarily.
// let activeChatSession: any = null;
// let currentActiveDomain: string | null = null; // Tracks which bucket is currently loaded
// let currentToolBucket: any[] = AllTools;       // Fallback to all tools initially
// export const chatIntialize = async (context: any, newDomain?: string, newTools?: any[], chatHistory?: any[]) => {
//   try {
//     // If the router tells us we are in a new domain, we MUST reset the chat
//     // to load the new tools, otherwise we just keep the active session.
//     const domainChanged = newDomain && newDomain !== currentActiveDomain;

//     if (!activeChatSession || domainChanged) {
//       if (domainChanged && newTools) {
//         console.log(`[Router] Switching domain from ${currentActiveDomain} to ${newDomain}. Reloading tools.`);
//         currentActiveDomain = newDomain;
//         currentToolBucket = newTools;
//       }
//       const { systemInstruction } = generateSystemPrompt(context);
//       const history = chatHistory || [];
//       activeChatSession = gemini_ai.chats.create({
//         model: "gemini-2.5-flash",
//         history,
//         config: {
//           tools: [{ functionDeclarations: currentToolBucket }],
//           systemInstruction,
//         }
//       });

//       return activeChatSession
//     }

//   } catch (error) {
//     console.error("Chat initialization failed:", error);
//     activeChatSession = null;
//   }
//   return activeChatSession;
// }

// export const agenticExecutor = async (calls: FunctionCall[] | undefined, context: AIActionContext) => {
//   console.log("Executing agentic actions:", calls);
//   const executionResults = [];
//   if (calls) {
//     for (const call of calls) {
//       if (!call.name) continue;
//       const handler = ActionRegistry[call.name];
//       if (handler) {
//         try {
//           console.log(`[Agent] Calling ${call.name} with:`, call.args);
//           const result = await handler.execute(call.args, context);
//           executionResults.push({
//             tool: call.name,
//             args: call.args,
//             result: result || { status: "success", message: "Action executed." } // Fallback
//           });
//         } catch (error: any) {
//           executionResults.push({
//             tool: call.name,
//             result: { status: "error", message: error.message || "Unknown error occurred." }
//           });
//         }
//       }
//     }
//     const feedback = await processExecutionFeedback(executionResults, context);
//     return feedback;
//     //return { success: true, message: "Actions executed successfully." };
//   }
// }

// // ai-utils.ts (or wherever your processCommandAgentic lives)

// export const processExecutionFeedback = async (executionResults: any[], context: any) => {
//   // If nothing was executed, do nothing
//   if (!executionResults || executionResults.length === 0) return null;
//   console.log("FEEDBACK LOOP, EXECUTION RESUTLS", JSON.stringify(executionResults, null, 2));
//   // Re-initialize the chat so it has the current history
//   //const chat = await chatIntialize(context);
//   console.log("SERVING FEEDBACK FOR USER REQUEST: ", globalTranscript)
//   // Create a silent system prompt telling the AI what just happened
//   const feedbackPrompt = `
//   The user originally asked: "${globalTranscript}"
//   [SYSTEM PROTOCOL: EXECUTION RESULTS]
//   The user confirmed your proposed actions. Here are the real-world results of those executions:
//   ${JSON.stringify(executionResults, null, 2)}
  
//   Please provide a brief, conversational summary to the user based on these rules:
//   1. If 'status' is 'success', keep it short and encouraging.
//   2. If 'status' is 'denied' (e.g., habit already checked in), casually mention it so they know.
//   3. If 'status' is 'partial_success' (e.g., a task was saved but the reminder failed), explicitly tell the user that the item was saved, but ask them if they want to try setting the reminder again for a valid future time.
//   4. If 'status' is 'error' (e.g., Item Not Found), DO NOT attempt to use tools again. Apologize to the user, tell them exactly which item couldn't be found, and ask them to clarify the name or check if they already deleted it.
//   `;

//   try {
//     const result = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash-lite",
//       contents: [{ role: "user", parts: [{ text: feedbackPrompt }] }]
//     });
//     //await chat.sendMessage({ message: feedbackPrompt });
//     recordGeminiUsage(result, "FEEDBACK");

//     // Return the AI's final natural language summary to display in the chat UI
//     return result.text?.replace(/```json|```/g, "").trim();
//   } catch (error) {
//     console.error("Failed to generate post-execution summary:", error);
//     // Fallback if AI fails: map the raw messages for the UI
//     return executionResults.map(r => r.result.message).join("\n");
//   }
// };


// const executePlannerNode = async (transcript: string): Promise<ChecklistItem[]> => {
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
//           description: "List of distinct tasks requested by the user, including all modifiers."
//         }
//       }
//     });

//     recordGeminiUsage(result, "PLANNER"); // Hook up your metrics
//     console.log("[DAG] Node 1:FUNCTIONCALLS", result.functionCalls);
//     console.log("[DAG] Node 1:CHAT RESPONSE TEXT:", result.text);
//     console.log("[DAG] Node 1:CHAT Candidates.content:", result.candidates?.[0]?.content);
//     console.log("[DAG] Node 1:FULL RESPONSE", result)
//     const checklist = JSON.parse(result.text || "[]");
//     console.log("[DAG] Checklist generated:", checklist);
//     console.log("=========================================================");
//     const objectifiedChecklist: ChecklistItem[] = checklist.map((intent: string, index: any) => ({
//       id: `chk-${index}`, // Bulletproof unique IDs
//       intent: intent,
//       status: "PENDING"
//     }));
//     return objectifiedChecklist;

//   } catch (e) {
//     console.error("Planner Node Failed:", e);
//     console.log("=========================================================");
//     return [{ id: "fallback-1", intent: transcript, status: "PENDING" }]; // Fallback to just the raw transcript
//   }

// };

// const executeRouterNode = async (transcript: string, checklist: string[]): Promise<{ domain: string, tools: any[] }> => {
//   console.log("=========================================================");
//   console.log("[DAG] Node 2: ROUTER (Selecting Tool Bucket)...");

//   globalTranscript = transcript;
//   /*  let requiredDomains: string[] = ["routeToGeneral"];
//    let selectedTools: any[] = [];
//    try {
//      // We use a stateless generation call for the Router, not the chat session
//      const routerResponse = await gemini_ai.models.generateContent({
//        model: "gemini-2.5-flash", // Fast/Cheap model for Pass 1
//        contents: [{ role: "user", parts: [{ text: transcript }] }],
//        config: {
//          systemInstruction: "You are an AI routing assistant. Analyze the prompt and use the analyzeIntent tool to return an array of ALL domains necessary to fulfill the request.",
//          tools: [{ functionDeclarations: RouterTools }],
//          // In newer Gemini SDKs, this forces it to use a tool
//          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } }
//        }
//      }); */
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
//           description: "An array of exactly matching string keys from the MasterToolIndex."
//         }
//       }
//     });
//     recordGeminiUsage(routerResponse, "ROUTER");
//     console.log("[DAG] Node 2:FUNCTIONCALLS", routerResponse.functionCalls);
//     console.log("[DAG] Node 2:CHAT RESPONSE TEXT:", routerResponse.text);
//     console.log("[DAG] Node 2:CHAT Candidates.content:", routerResponse.candidates?.[0]?.content);
//     console.log("[DAG] Node 2:FULL RESPONSE", routerResponse)

//     /*  const routeCall = routerResponse.functionCalls?.[0];
//      if (routeCall && routeCall.name === "analyzeIntent" && Array.isArray(routeCall.args?.requiredDomains)) {
//        console.log(`[DAG] Node 2: Selected Domains: ${routeCall.args}`);
//        requiredDomains = routeCall.args.requiredDomains as string[];
//        console.log(`[DAG] Router Reasoning: ${routeCall.args.reasoning}`);
//        console.log(`[DAG] Router Selected Domains:`, requiredDomains);
//      } else {
//        console.warn("[DAG] Router failed to parse domains, falling back to all tools.");
//        // Fallback: If it fails, load everything just to be safe
//        requiredDomains = ["routeToTasks", "routeToHabits", "routeToEvents", "routeToTimers", "routeToTaxonomy", "routeToGeneral"];
//      }
//    } catch (error) {
//      console.error("[DAG] Router execution failed:", error);
//      requiredDomains = ["routeToTasks", "routeToHabits", "routeToEvents", "routeToTimers", "routeToTaxonomy", "routeToGeneral"];
//    }
 
//    // Map the array of domain strings into actual tool objects
//    if (requiredDomains.includes("routeToTasks")) selectedTools.push(...TaskTools);
//    if (requiredDomains.includes("routeToHabits")) selectedTools.push(...HabitTools);
//    if (requiredDomains.includes("routeToEvents")) selectedTools.push(...EventTools);
//    if (requiredDomains.includes("routeToTimers")) selectedTools.push(...TimerTools);
//    if (requiredDomains.includes("routeToTaxonomy")) selectedTools.push(...TaxonomyTools);
 
//    // Always include general tools (like search, date checking, etc.)
//    selectedTools.push(...GeneralTools);
 
//    // Deduplicate tools just in case a tool accidentally exists in multiple buckets
//    // (This is a good safety net for token counting)
//    const uniqueTools = Array.from(new Map(selectedTools.map(tool => [tool.name, tool])).values()); */
//     const requestedToolNames: string[] = JSON.parse(routerResponse.text || "[]");
//     console.log("[DAG] Node 2: Resolved Tool Schemas", [...requestedToolNames])
//     // 2. Pass them through our bulletproof injector
//     const resolvedToolSchemas = resolveDependencies(requestedToolNames);
//     console.log("[DAG] Node 2: Resolved Tool Schemas", [...resolvedToolSchemas.map(tool => tool.name)])
//     console.log("=========================================================");
//     return {
//       domain: requestedToolNames.join(", "),
//       tools: resolvedToolSchemas
//     };

//   } catch (error) {
//     console.error("[DAG] Router execution failed:", error);
//     // Fallback: If it crashes, fail gracefully by loading standard tools
//     return {
//       domain: "Fallback",
//       tools: resolveDependencies(["addTask", "addHabit", "addCategory"])
//     };
//   }
//   /* return { domain: requiredDomains.join(", "), tools: uniqueTools }; */
// };

// const executeChecklistDeductionNode = async (
//   currentChecklist: ChecklistItem[],
//   summary: ExecutionSummary
// ): Promise<string[]> => {
//   // If the checklist is empty or no tools were called, nothing to deduce.

//   const pendingItems = currentChecklist.filter(item => item.status === "PENDING");
//   if (pendingItems.length === 0 ||
//     (summary.tasksCreated.length + summary.habitsCreated.length + summary.categoriesCreated.length + summary.tagsCreated.length) === 0)
//     return [];

//   console.log("=========================================================");
//   console.log("[DAG] Micro-Node: DEDUCING CHECKLIST PROGRESS...");
//   console.log("[DAG] Pending Checklist Items:", JSON.stringify(pendingItems));
//   console.log("[DAG] Summary:", JSON.stringify(summary));
//   /*   const deductionPrompt = `
//     You are a strict auditor verifying system state.
//     Pending Checklist Intents:
//     ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
  
//     System Execution Summary (What was actually successfully created):
//     ${JSON.stringify(summary)}
  
//     Compare the executed tools against the checklist.
//     Return a JSON array containing ONLY the string "id"s of the checklist items that have been fully completed based on the summary.
//     `; */

//   // Proposed simplified logic for the Deducer
//   const deductionPrompt = `
//   You are an auditor verifying task completion based on entity names.
  
//   Pending Checklist Items: ${JSON.stringify(pendingItems.map(i => ({ id: i.id, intent: i.intent })))}
//   Execution Summary: ${JSON.stringify(summary)}

//   Logic: 
//   For each checklist intent, extract the core entity name (e.g., Task name, Habit name, Category name).
//   If that entity name is present in the corresponding array in the Execution Summary (tasksCreated, habitsCreated, categoriesCreated, or tagsCreated), mark the checklist item as COMPLETED.
  
//   Return a JSON array of completed IDs.
// `;

//   //  RULES:
//   // 1. ONLY remove an item from the checklist if you have absolute proof it was completed by the tools above.
//   // 2. Do NOT remove an item if the tool execution contains an "error".
//   // 3. If an item requests creating a "Task" or "Habit", and the executed tools ONLY involve "Categories" or "Search", you MUST NOT remove the Task or Habit from the checklist.

//   try {
//     const response = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash", // Extremely fast/cheap micro-call
//       contents: [{ role: "user", parts: [{ text: deductionPrompt }] }],
//       config: {
//         responseMimeType: "application/json",
//         responseSchema: {
//           type: "ARRAY",
//           items: { type: "STRING" },
//           description: "The remaining, unfulfilled tasks."
//         }
//       }
//     });
//     recordGeminiUsage(response, "Checklist DEDUCER");
//     const remainingChecklistIDs = JSON.parse(response.text || "[]");
//     console.log(`[DAG] Checklist Updated:`, remainingChecklistIDs);
//     return remainingChecklistIDs;
//   } catch (error) {
//     console.warn("[DAG] Checklist Deduction Failed, falling back to naive pop:", error);
//     // Safe fallback just in case the API glitches
//     return []
//     /*    let fallbackChecklist = [...currentChecklist];
//        fallbackChecklist.shift();
//        return fallbackChecklist; */
//   }
// };

// export const sanitizeChatHistory = (history: Content[]): Content[] => {
//   return history.map((turn) => ({
//     ...turn,
//     parts: turn.parts?.map((part: Part) => {
//       // Destructure to isolate thoughtSignature and keep the rest
//       const { thoughtSignature, ...sanitizedPart } = part;
//       return sanitizedPart;
//     })
//   }));
// };

// // A. Deterministic Stringifier
// const deterministicStringify = (obj: any): string => {
//   if (obj === null || typeof obj !== 'object') {
//     return JSON.stringify(obj);
//   }
//   if (Array.isArray(obj)) {
//     return JSON.stringify(obj.map(deterministicStringify));
//   }

//   // Sort keys alphabetically to guarantee identical signatures
//   const keys = Object.keys(obj).sort();
//   const res: string[] = [];
//   for (const key of keys) {
//     res.push(`"${key}":${deterministicStringify(obj[key])}`);
//   }
//   return `{${res.join(',')}}`;
// };

// // B. robust deduplication helper using JSON stringification for deep comparison
// const mergeIdempotentCalls = (existingCalls: any[], newCalls: any[]): any[] => {
//   const merged = [...existingCalls];

//   for (const incomingCall of newCalls) {
//     // Create a deterministic signature of the function call
//     const signature = JSON.stringify({
//       name: incomingCall.name,
//       args: incomingCall.args // Note: Ensure object keys are sorted if args order varies
//     });

//     const isDuplicate = merged.some(existingCall =>
//       deterministicStringify({ name: existingCall.name, args: existingCall.args }) === signature
//     );

//     if (!isDuplicate) {
//       merged.push(incomingCall);
//     } else {
//       console.warn(`[DAG] Idempotency Shield: Dropped duplicate call for '${incomingCall.name}'`);
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
//     finalToolNames.has("addTask") || finalToolNames.has("editTask") || finalToolNames.has("deleteTask") || finalToolNames.has("completeTask")
//     || finalToolNames.has("addHabit") || finalToolNames.has("checkinHabit") || finalToolNames.has("deleteHabit")
//     || finalToolNames.has("addEvent") || finalToolNames.has("editEvent")
//     || finalToolNames.has("deleteEvent") || finalToolNames.has("deleteSingleEvent")
//   ) {
//     finalToolNames.add("searchTaxonomy");
//     finalToolNames.add("searchItems");
//   }

//   // 2. Task Mutations: If updating, deleting, or completing a task, we must find its UUID first
//   if (finalToolNames.has("editTask") || finalToolNames.has("deleteTask") || finalToolNames.has("completeTask")) {
//     finalToolNames.add("queryTasks"); // Or queryTasks, depending on your search handler's power
//   }

//   // 3. Habit Mutations: If editing or checking in, find the habit UUID
//   if (finalToolNames.has("deleteHabit") || finalToolNames.has("checkinHabit")) {
//     finalToolNames.add("queryHabits");
//   }

//   // 4. Event Mutations: Find the event UUID
//   if (finalToolNames.has("editEvent") || finalToolNames.has("deleteEvent") || finalToolNames.has("deleteSingleEvent")) {
//     finalToolNames.add("queryEvents");
//   }

//   // 5. Taxonomy Mutations: Find the Category/Tag UUID
//   if (
//     finalToolNames.has("editCategory") || finalToolNames.has("deleteCategory") ||
//     finalToolNames.has("editTag") || finalToolNames.has("deleteTag") || finalToolNames.has("getTaxonomyStats")
//   ) {
//     finalToolNames.add("searchTaxonomy");
//   }
//   // --- MAPPING TO SCHEMAS ---
//   const finalSchemas: any[] = [];
//   finalToolNames.forEach(name => {
//     const schema = AllToolSchemas[name];
//     if (schema) {
//       finalSchemas.push(schema);
//     } else {
//       console.warn(`[DAG] Warning: Router requested unknown tool '${name}'`);
//     }
//   });

//   console.log(`[DAG] Dependency Injector Complete. Final Schema Count: ${finalSchemas.length}`);
//   return finalSchemas;
// };

// export const transformCallsForDeducer = (executedCalls: any[]): ExecutionSummary => {
//   const summary: ExecutionSummary = {
//     tasksCreated: [],
//     habitsCreated: [],
//     categoriesCreated: [],
//     tagsCreated: []
//   };

//   for (const call of executedCalls) {
//     if (!call || !call.args) continue;

//     switch (call.name) {
//       case 'addTask':
//         if (call.args.title) summary.tasksCreated.push(call.args.title);
//         break;
//       case 'addHabit':
//         if (call.args.title) summary.habitsCreated.push(call.args.title);
//         break;
//       case 'addCategory':
//         if (call.args.name) summary.categoriesCreated.push(call.args.name);
//         break;
//       case 'addTag':
//         // Handle batched tags array
//         if (Array.isArray(call.args.names)) {
//           summary.tagsCreated.push(...call.args.names);
//         } else if (typeof call.args.name === 'string') {
//           summary.tagsCreated.push(call.args.name); // Fallback if single string
//         }
//         break;
//       // Note: searchTaxonomy, queryTasks, etc. are implicitly ignored!
//     }
//   }

//   return summary;
// };

// const executeActionNode = async (state: AgentState, context: any, onProgress?: (status: string) => void): Promise<Partial<AgentState>> => {
//   console.log("=========================================================");
//   console.log("[DAG] Node 3: EXECUTOR (Running Tools)...");
//   console.log("_________________________________________________________");
//   console.log("[DAG] Node 3: State Recieved:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
//   console.log("_________________________________________________________");
//   // Initialize chat session (your existing function)
//   const chat = await chatIntialize(context, state.selectedDomain, state.selectedTools, state.chatHistory);
//   //!const payload = state.chatHistory.length === 0 ? state.transcript : state.chatHistory;
//   const payload = state.chatHistory.length === 0 ? state.transcript : state.pendingTurnPayload;
//   // Inject the ongoing chat history so it remembers previous turns!
//   const response = await chat.sendMessage({ message: payload });

//   recordGeminiUsage(response, "Action EXECUTOR");
//   console.log("[DAG] Node 3:FUNCTIONCALLS", response.functionCalls);
//   console.log("[DAG] Node 3:CHAT RESPONSE TEXT:", response.text);
//   console.log("[DAG] Node 3:CHAT Candidates.content:", response.candidates?.[0]?.content);
//   console.log("[DAG] Node 3:FULL RESPONSE", response)

//   const currentCalls = response.functionCalls || [];
//   let toolResponsesForNextTurn: any[] = [];
//   let newConfirmationCalls: any[] = [];
//   console.log("[DAG] Node 3: Received Funtion Calls:", JSON.stringify(currentCalls, null, 2));
//   // 1. Sort calls into Silent vs Confirmation
//   for (const call of currentCalls) {
//     //  Announce the specific tool before we execute it!
//     if (call.name.toLowerCase().includes("task")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_TASK));
//     else if (call.name.toLowerCase().includes("habit")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_HABIT));
//     else if (call.name.toLowerCase().includes("category")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_CATEGORY));
//     else if (call.name.toLowerCase().includes("tag")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_TAG));
//     else if (call.name.toLowerCase().includes("search")) onProgress?.(getRandomProgressText(AgentPersona.ACTION_SEARCH));

//     if (SilentHandlerList.includes(call.name) || call.args?.isPrerequisite === true) {
//       console.log(`[Silent-Agent] Executing ${call.name}...`);
//       try {
//         const data = await ActionRegistry[call.name].execute(call.args, context);
//         const formattedData = typeof data === 'object' && data !== null ? data : { result: data };
//         toolResponsesForNextTurn.push({ functionResponse: { name: call.name, response: formattedData } });
//       } catch (error: any) {
//         console.error(`[DAG] Error executing ${call.name}:`, error);

//         // THE MAGIC: Feed the error directly back to the LLM's context window
//         toolResponsesForNextTurn.push({
//           functionResponse: {
//             name: call.name,
//             response: {
//               "error": {
//                 errorMessage: error.message || "Database constraint failed.",
//                 systemInstruction: "CRITICAL: The tool failed. Apologize to the user, explain this specific error briefly, and ask them how they want to proceed (e.g., pick a different name)."
//               }
//             }
//           }
//         });
//       }
//     } else {
//       newConfirmationCalls.push(call);
//     }
//   }
//   console.log("[DAG] Node 3: Intermediate Confirmation Calls:", JSON.stringify(newConfirmationCalls, null, 2));
//   // ==========================================
//   // REPLACED: Smart Checklist Deduction
//   // ==========================================
//   // We feed ALL executed tools (both silent and UI confirmations) to the deduction node
//   console.log("[DAG] Node 3: Intial Checklist:", state.checklist);
//   const allExecutedToolsForDeduction = [...currentCalls];
//   const executionSummary = transformCallsForDeducer(allExecutedToolsForDeduction);
//   const remainingChecklistIDs = await executeChecklistDeductionNode(
//     state.checklist,
//     executionSummary
//   );
//   const updatedChecklist = state.checklist.map(item =>
//     remainingChecklistIDs.includes(item.id) ? { ...item, status: "COMPLETED" } : item
//   ) as ChecklistItem[];
//   const updatedHistory = await chat.getHistory();
//   const sanitizedHistory = sanitizeChatHistory(updatedHistory);

//   console.log("[DAG] Node 3:  Updated Checklist:", updatedChecklist);

//   console.log("_________________________________________________________");
//   console.log("[DAG] Node 3: Results", {
//     accumulatedConfirmationCalls: [...state.accumulatedConfirmationCalls, ...newConfirmationCalls],
//     finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
//     chatHistory: toolResponsesForNextTurn.length > 0 ? toolResponsesForNextTurn : [],
//     history: sanitizedHistory
//   });
//   console.log("=========================================================");
//   return {
//     accumulatedConfirmationCalls: [...newConfirmationCalls],
//     finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
//     checklist: updatedChecklist,
//     chatHistory: sanitizedHistory,
//     toolResponses: toolResponsesForNextTurn
//   };
// };


// export const processCommandAgentic = async (transcript: string, context: any, onProgress?: (status: string) => void) => {
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
//     finalTextResponse: ""
//   };

//   try {
//     // 2. Run Planner (Only if prompt looks complex, otherwise skip to save tokens)
//     if (transcript.includes("and") || transcript.includes(",")) {
//       onProgress?.(getRandomProgressText(AgentPersona.PLANNING));
//       state.checklist = await executePlannerNode(state.transcript);
//     } else {
//       state.checklist = [{ id: "fallback-1", intent: state.transcript, status: "PENDING" }];
//     }

//     // 3. Run Router
//     onProgress?.(getRandomProgressText(AgentPersona.ROUTING));
//     const { domain, tools } = await executeRouterNode(state.transcript, state.checklist.map((item) => item.intent));
//     state.selectedDomain = domain;
//     state.selectedTools = tools;

//     // 4. The Graph Edge Loop
//     console.log("_________________________________________________________");
//     console.log("[DAG] Node Main: State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
//     console.log("_________________________________________________________");
//     let safetyCounter = 0;
//     while (state.checklist.some(item => item.status === "PENDING") && safetyCounter < 10) {

//       // Capture how many UI calls we had BEFORE running the executor this turn
//       const prevCallsLength = state.accumulatedConfirmationCalls.length;

//       // Run the Executor
//       onProgress?.("Executing actions ")
//       const nodeResult = await executeActionNode(state, context, onProgress);
//       const newConfirmationCalls = nodeResult.accumulatedConfirmationCalls || [];
//       // Merge them deterministically with our existing calls
//       const safeAccumulatedCalls = mergeIdempotentCalls(state.accumulatedConfirmationCalls, newConfirmationCalls);
//       // Mutate State
//       state = {
//         ...state,
//         ...nodeResult,
//         accumulatedConfirmationCalls: safeAccumulatedCalls,
//       }

//       const pendingItems = state.checklist.filter(item => item.status === "PENDING");
//       // THE CONDITIONAL EDGE: Are we done?
//       if (pendingItems.length > 0) {
//         if (state.toolResponses && state.toolResponses.length > 0) {
//           // Scenario A: Silent DB tool outputs need to be handled next
//           console.log("[DAG] Edge: Feeding DB results back into the next loop...");
//           state.pendingTurnPayload = state.toolResponses;
//         }
//         else if (state.accumulatedConfirmationCalls.length > prevCallsLength) {
//           // Scenario B: Partial UI calls made, but list items remain. Nudge with a compliant text Part.
//           console.log("[DAG] Edge: Partial completion detected. Injecting text nudge part.");
//           state.pendingTurnPayload = [{
//             text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`
//           }];
//         }
//         else {
//           // Scenario C: Tunnel Vision. Force-override with a compliant text Part.
//           console.log(`[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`);
//           const isReconciling = state.chatHistory.some(msg =>
//             msg.parts?.[0]?.text?.includes("RECONCILIATION_CHECK")
//           );

//           if (isReconciling) {
//             // The AI has already been prompted to reconcile and still returned no tools.
//             // At this point, we assume the AI considers the task done despite the Deducer's check.
//             console.warn("[DAG] Reconciliation conflict resolved. Trusting Executor. Exiting graph.");
//             break;
//           } else {
//             console.log(`[DAG] Edge: Conflict detected! Initiating Reconciliation...`);
//             state.pendingTurnPayload = [{
//               text: `RECONCILIATION_CHECK: You generated no tools, but the system shows these items are still PENDING: ${JSON.stringify(pendingItems)}. 
//                        If you already generated the tools for these in a previous turn, reply with 'STATE_SYNC_RESOLVED'. 
//                        If you missed them, generate the required tools now.`
//             }];
//           }
//           /*  state.pendingTurnPayload = [{
//              text: `System Override: You stopped abruptly, but you still MUST fulfill these requests: ${JSON.stringify(state.checklist)}. Call the required tools now.`
//            }]; */
//         }
//         /*  if (state.chatHistory.length > 0) {
//            // We have silent DB results to feed back to the AI. Loop again.
//            onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
//            console.log("[DAG] Edge: Silent tools executed, looping back to Executor...");
//          }
//          else if (state.accumulatedConfirmationCalls.length > prevCallsLength) {
//            // It successfully generated UI calls, BUT the checklist isn't empty yet.
//            // Nudge it to keep going instead of exiting.
//            console.log("[DAG] Edge: Partial completion detected. Nudging AI to finish checklist.");
//            state.chatHistory = [{
//              text: `Good. You completed part of the request. Now, execute the tools for the REMAINING items on this list: ${JSON.stringify(state.checklist)}`
//            }
//            ];
//          }
//          else {
//            // TUNNEL VISION DETECTED! The AI stopped, but the checklist isn't empty.
//            onProgress?.(getRandomProgressText(AgentPersona.EVALUATING));
//            console.log(`[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`);
 
//            // Jolt the AI with a strict system override
//            state.chatHistory = [{
//              text: `System Override: You stopped, but you still need to fulfill this request: "${state.checklist[0]}". Call the required tools now.`
//            }];
//          } */
//       }


//       safetyCounter++;
//     }
//     console.log("[DAG] Edge: Execution complete. Exiting graph.");
//     console.log("_________________________________________________________");
//     console.log("[DAG] Node Main: FINAL State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
//     console.log("_________________________________________________________");
//     // 5. Return exact same payload to the UI
//     return {
//       response: state.finalTextResponse,
//       calls: state.accumulatedConfirmationCalls
//     };

//   } catch (error) {
//     console.error("[DAG] Critical Graph Failure:", error);
//     throw error;
//   }
// };

// //OLD 2 pass router version
// /* export const processCommandAgenticPAUSED = async (transcript: string, context: any) => {

//   console.log("=========================================================");
//   console.log("[AI] Starting PASS 1: ROUTING...");
//   console.log("=========================================================");

//   let selectedBucket = AllTools;
//   globalTranscript = transcript;
//   let selectedDomain = "routeToMultiDomain"; // Safe fallback

//   try {
//     // We use a stateless generation call for the Router, not the chat session
//     const routerResponse = await gemini_ai.models.generateContent({
//       model: "gemini-2.5-flash", // Fast/Cheap model for Pass 1
//       contents: [{ role: "user", parts: [{ text: transcript }] }],
//       config: {
//         systemInstruction: "You are an AI router. Analyze the user's prompt and call the single most appropriate routing tool. Do not answer the prompt directly.",
//         tools: [{ functionDeclarations: RouterTools }],
//         // In newer Gemini SDKs, this forces it to use a tool
//         toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } }
//       }
//     });

//     recordGeminiUsage(routerResponse)
//     const routeCall = routerResponse.functionCalls?.[0];

//     if (routeCall) {
//       if (routeCall.name) {
//         selectedDomain = routeCall.name;
//         console.log(`[AI] Pass 1 Complete. Selected Route: ${selectedDomain}`);
//       }
//       else {
//         console.warn("[AI] routeCall.name was UNDEFINED, failed to select specific Domain, defaulting to MultiDomain.");
//       }

//       console.log("=========================================================");

//       // Map the route to the specific tools
//       switch (selectedDomain) {
//         case "routeToTasks": selectedBucket = [...TaskTools, ...GeneralTools]; break;
//         case "routeToHabits": selectedBucket = [...HabitTools, ...GeneralTools]; break;
//         case "routeToEvents": selectedBucket = [...EventTools, ...GeneralTools]; break;
//         case "routeToTimers": selectedBucket = [...TimerTools, ...GeneralTools]; break;
//         case "routeToTaxonomy": selectedBucket = [...TaxonomyTools, ...GeneralTools]; break;
//         case "routeToMultiDomain":
//         default:
//           selectedBucket = AllTools;
//           break;
//       }
//     } else {
//       console.log("=========================================================");
//       console.warn("[AI] Router failed to select a tool, defaulting to MultiDomainTool.");
//       console.log("=========================================================");
//     }
//   } catch (routeError) {
//     console.log("=========================================================");
//     console.error("Router Pass Failed, falling back to all tools:", routeError);
//     console.log("=========================================================");
//   }

//   console.log("=========================================================");
//   console.log("[AI] Starting PASS 2: THE EXECUTOR....");
//   console.log("=========================================================");

//   const chat = await chatIntialize(context, selectedDomain, selectedBucket);
//   let iteration = 0;
//   const MAX_ITERATIONS = 15;
//   let accumulatedConfirmationCalls: any[] = [];
//   try {
//     let result = await chat.sendMessage({ message: transcript });
//     recordGeminiUsage(result);
//     console.log("FUNCTIONCALLS", result.functionCalls);
//     console.log("CHAT RESPONSE TEXT:", result.text);
//     console.log("CHAT Candidates.content:", result.candidates?.[0]?.content);
//     console.log("FULL RESPONSE", result)
//     let currentCalls = result.functionCalls;
//     let responseText = result.text;

//     // Note: Check if the response is empty, so that we can send a silent, hidden system message to jolt it out of paralysis
//     const candidate = result.candidates?.[0];
//     const hasEmptyContent =
//       candidate?.content?.role === "model" &&
//       (!candidate.content.parts || candidate.content.parts.length === 0);

//     if (!currentCalls && !responseText && (hasEmptyContent || result.candidates?.[0]?.finishReason === "STOP")) {
//       console.log("Model returned empty candidate. Forcing tool usage...");


//       const joltResult = await chat.sendMessage({
//         message: "System Override: You failed to respond. You MUST use a tool (like query-tasks or search-items) to fulfill the user's previous request right now."
//       });

//       currentCalls = joltResult.functionCalls;
//       responseText = joltResult.text;
//     }

//     //  !The Fallback: If native calls are undefined, but the text looks like JSON
//     // if (!currentCalls && lastResponseText.startsWith("{") && lastResponseText.includes("function_calls")) {
//     //   try {
//     //     const parsedText = JSON.parse(lastResponseText);


//     //     if (parsedText.function_calls) {
//     //       currentCalls = parsedText.function_calls.map((c: any) => ({
//     //         name: c.function_name,
//     //         args: c.parameters
//     //       }));
//     //       console.log("🛠️ Recovered from hallucinated JSON text!");
//     //     }
//     //   } catch (e) {
//     //     console.log("Failed to parse fallback JSON, treating as normal text.");
//     //   }
//     // }
//     const toolResponses = [];
//     while (iteration < MAX_ITERATIONS) {
//       const silentCalls = currentCalls?.filter((c: any) =>
//         SilentHandlerList.includes(c.name) || c.args?.isPrerequisite === true
//       ) || [];

//       const confirmationCalls = currentCalls?.filter((c: any) =>
//         !SilentHandlerList.includes(c.name) && c.args?.isPrerequisite !== true
//       ) || [];

//       accumulatedConfirmationCalls = [...accumulatedConfirmationCalls, ...confirmationCalls];

//       // If there are no more silent tools to run, we are done
//       if (silentCalls.length === 0) break;

//       for (const call of silentCalls) {
//         console.log(`[Silent-Agent] Calling ${call.name} with:`, call.args);
//         const handler = ActionRegistry[call.name];
//         const data = await handler.execute(call.args, context);
//         console.log(`[Silent-Agent]  ${call.name} returned:`, data);
//         toolResponses.push({
//           functionResponse: {
//             name: call.name,
//             response: data
//           }
//         });

//       }
//       const nextStep = await chat.sendMessage({
//         message: {
//           role: "user",
//           parts: toolResponses
//         }
//       });
//       recordGeminiUsage(nextStep);
//       result = nextStep;
//       currentCalls = nextStep.functionCalls;
//       responseText = nextStep.text;
//       iteration++;

//     }

//     return {
//       response: responseText?.replace(/```json|```/g, "").trim(),
//       calls: accumulatedConfirmationCalls
//     };


//     //return  response ;
//   } catch (error) {
//     console.error("Agent Loop Failed:", error);
//     throw error;

//   }
// }; */

/**
 * OLD and BACKUP and LATEST 2-Pass-Router just before swtiching to DAG Routing
 * Note: This worked great for 95% case, failed in some multidomain cases, decied to switch out to DAG before fixing it
 * Note : Below is usage stats with 2 Pass for 50 requests
 *! AI TOKEN MONITOR
 *! ----------------------------
 *! Request #: 50
 *! Total Tokens for 50th Prompt: 552
 *! Avg Tokens / Request: 2702.38
 *! Total Tokens Used: 135119
 *!----------------------------
 */
/* import { AIActionContext } from "@/types/ai-handler";
import { FunctionCall, FunctionCallingConfigMode } from "@google/genai";
import { gemini_ai } from "./AI-utils/llm-client";
import { ActionRegistry, SilentHandlerList } from "./AI-utils/registry-handler";
import { RouterTools } from "./AI-utils/router-tools";
import { generateSystemPrompt } from "./AI-utils/system-prompt";
import { AllTools, EventTools, GeneralTools, HabitTools, TaskTools, TaxonomyTools, TimerTools } from "./AI-utils/tool-def-buckets";
import { recordGeminiUsage } from "./dev-util-token-monitor";

let globalTranscript: string = "";
let activeChatSession: any = null;
let currentActiveDomain: string | null = null; // Tracks which bucket is currently loaded
let currentToolBucket: any[] = AllTools;       // Fallback to all tools initially
export const chatIntialize = async (context: any, newDomain?: string, newTools?: any[]) => {
    try {
        // If the router tells us we are in a new domain, we MUST reset the chat
        // to load the new tools, otherwise we just keep the active session.
        const domainChanged = newDomain && newDomain !== currentActiveDomain;

        if (!activeChatSession || domainChanged) {
            if (domainChanged && newTools) {
                console.log(`[Router] Switching domain from ${currentActiveDomain} to ${newDomain}. Reloading tools.`);
                currentActiveDomain = newDomain;
                currentToolBucket = newTools;
            }
            const { systemInstruction } = generateSystemPrompt(context);

            activeChatSession = gemini_ai.chats.create({
                model: "gemini-2.5-flash",
                config: {
                    tools: [{ functionDeclarations: currentToolBucket }],
                    systemInstruction,
                }
            });

            return activeChatSession
        }

    } catch (error) {
        console.error("Chat initialization failed:", error);
        activeChatSession = null;
    }
    return activeChatSession;
}

export const processCommandAgentic = async (transcript: string, context: any) => {

    console.log("=========================================================");
    console.log("[AI] Starting PASS 1: ROUTING...");
    console.log("=========================================================");

    let selectedBucket = AllTools;
    globalTranscript = transcript;
    let selectedDomain = "routeToMultiDomain"; // Safe fallback

    try {
        // We use a stateless generation call for the Router, not the chat session
        const routerResponse = await gemini_ai.models.generateContent({
            model: "gemini-2.5-flash", // Fast/Cheap model for Pass 1
            contents: [{ role: "user", parts: [{ text: transcript }] }],
            config: {
                systemInstruction: "You are an AI router. Analyze the user's prompt and call the single most appropriate routing tool. Do not answer the prompt directly.",
                tools: [{ functionDeclarations: RouterTools }],
                // In newer Gemini SDKs, this forces it to use a tool
                toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } }
            }
        });

        recordGeminiUsage(routerResponse)
        const routeCall = routerResponse.functionCalls?.[0];

        if (routeCall) {
            if (routeCall.name) {
                selectedDomain = routeCall.name;
                console.log(`[AI] Pass 1 Complete. Selected Route: ${selectedDomain}`);
            }
            else {
                console.warn("[AI] routeCall.name was UNDEFINED, failed to select specific Domain, defaulting to MultiDomain.");
            }

            console.log("=========================================================");

            // Map the route to the specific tools
            switch (selectedDomain) {
                case "routeToTasks": selectedBucket = [...TaskTools, ...GeneralTools]; break;
                case "routeToHabits": selectedBucket = [...HabitTools, ...GeneralTools]; break;
                case "routeToEvents": selectedBucket = [...EventTools, ...GeneralTools]; break;
                case "routeToTimers": selectedBucket = [...TimerTools, ...GeneralTools]; break;
                case "routeToTaxonomy": selectedBucket = [...TaxonomyTools, ...GeneralTools]; break;
                case "routeToMultiDomain":
                default:
                    selectedBucket = AllTools;
                    break;
            }
        } else {
            console.log("=========================================================");
            console.warn("[AI] Router failed to select a tool, defaulting to MultiDomainTool.");
            console.log("=========================================================");
        }
    } catch (routeError) {
        console.log("=========================================================");
        console.error("Router Pass Failed, falling back to all tools:", routeError);
        console.log("=========================================================");
    }

    console.log("=========================================================");
    console.log("[AI] Starting PASS 2: THE EXECUTOR....");
    console.log("=========================================================");

    const chat = await chatIntialize(context, selectedDomain, selectedBucket);
    let iteration = 0;
    const MAX_ITERATIONS = 15;
    let accumulatedConfirmationCalls: any[] = [];
    try {
        let result = await chat.sendMessage({ message: transcript });
        recordGeminiUsage(result);
        console.log("FUNCTIONCALLS", result.functionCalls);
        console.log("CHAT RESPONSE TEXT:", result.text);
        console.log("CHAT Candidates.content:", result.candidates?.[0]?.content);
        console.log("FULL RESPONSE", result)
        let currentCalls = result.functionCalls;
        let responseText = result.text;

        // Note: Check if the response is empty, so that we can send a silent, hidden system message to jolt it out of paralysis
        const candidate = result.candidates?.[0];
        const hasEmptyContent =
            candidate?.content?.role === "model" &&
            (!candidate.content.parts || candidate.content.parts.length === 0);

        if (!currentCalls && !responseText && (hasEmptyContent || result.candidates?.[0]?.finishReason === "STOP")) {
            console.log("Model returned empty candidate. Forcing tool usage...");


            const joltResult = await chat.sendMessage({
                message: "System Override: You failed to respond. You MUST use a tool (like query-tasks or search-items) to fulfill the user's previous request right now."
            });

            currentCalls = joltResult.functionCalls;
            responseText = joltResult.text;
        }

        //  !The Fallback: If native calls are undefined, but the text looks like JSON
        // if (!currentCalls && lastResponseText.startsWith("{") && lastResponseText.includes("function_calls")) {
        //   try {
        //     const parsedText = JSON.parse(lastResponseText);


        //     if (parsedText.function_calls) {
        //       currentCalls = parsedText.function_calls.map((c: any) => ({
        //         name: c.function_name,
        //         args: c.parameters
        //       }));
        //       console.log("🛠️ Recovered from hallucinated JSON text!");
        //     }
        //   } catch (e) {
        //     console.log("Failed to parse fallback JSON, treating as normal text.");
        //   }
        // }
        const toolResponses = [];
        while (iteration < MAX_ITERATIONS) {
            const silentCalls = currentCalls?.filter((c: any) =>
                SilentHandlerList.includes(c.name) || c.args?.isPrerequisite === true
            ) || [];

            const confirmationCalls = currentCalls?.filter((c: any) =>
                !SilentHandlerList.includes(c.name) && c.args?.isPrerequisite !== true
            ) || [];

            accumulatedConfirmationCalls = [...accumulatedConfirmationCalls, ...confirmationCalls];

            // If there are no more silent tools to run, we are done
            if (silentCalls.length === 0) break;

            for (const call of silentCalls) {
                console.log(`[Silent-Agent] Calling ${call.name} with:`, call.args);
                const handler = ActionRegistry[call.name];
                const data = await handler.execute(call.args, context);
                console.log(`[Silent-Agent]  ${call.name} returned:`, data);
                toolResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: data
                    }
                });

            }
            const nextStep = await chat.sendMessage({
                message: {
                    role: "user",
                    parts: toolResponses
                }
            });
            recordGeminiUsage(nextStep);
            result = nextStep;
            currentCalls = nextStep.functionCalls;
            responseText = nextStep.text;
            iteration++;

        }

        return {
            response: responseText?.replace(/```json|```/g, "").trim(),
            calls: accumulatedConfirmationCalls
        };


        //return  response ;
    } catch (error) {
        console.error("Agent Loop Failed:", error);
        throw error;

    }
};

export const agenticExecutor = async (calls: FunctionCall[] | undefined, context: AIActionContext) => {
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
        const feedback = await processExecutionFeedback(executionResults, context);
        return feedback;
        //return { success: true, message: "Actions executed successfully." };
    }
}

// ai-utils.ts (or wherever your processCommandAgentic lives)

export const processExecutionFeedback = async (executionResults: any[], context: any) => {
    // If nothing was executed, do nothing
    if (!executionResults || executionResults.length === 0) return null;
    console.log("FEEDBACK LOOP, EXECUTION RESUTLS", JSON.stringify(executionResults, null, 2));
    // Re-initialize the chat so it has the current history
    //const chat = await chatIntialize(context);
    console.log("SERVING FEEDBACK FOR USER REQUEST: ", globalTranscript)
    // Create a silent system prompt telling the AI what just happened
    const feedbackPrompt = `
  The user originally asked: "${globalTranscript}"
  [SYSTEM PROTOCOL: EXECUTION RESULTS]
  The user confirmed your proposed actions. Here are the real-world results of those executions:
  ${JSON.stringify(executionResults, null, 2)}

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
        recordGeminiUsage(result);

        // Return the AI's final natural language summary to display in the chat UI
        return result.text?.replace(/```json|```/g, "").trim();
    } catch (error) {
        console.error("Failed to generate post-execution summary:", error);
        // Fallback if AI fails: map the raw messages for the UI
        return executionResults.map(r => r.result.message).join("\n");
    }
};
 */





// OLD 2-Pass Router Code
/*
let activeChatSession: any = null;
let currentActiveDomain: string | null = null; // Tracks which bucket is currently loaded
let currentToolBucket: any[] = AllTools;       // Fallback to all tools initially

export const chatIntialize = async (context: any, newDomain?: string, newTools?: any[]) => {
  try {
    // If the router tells us we are in a new domain, we MUST reset the chat
    // to load the new tools, otherwise we just keep the active session.
    const domainChanged = newDomain && newDomain !== currentActiveDomain;

    if (!activeChatSession || domainChanged) {
      if (domainChanged && newTools) {
        console.log(`[Router] Switching domain from ${currentActiveDomain} to ${newDomain}. Reloading tools.`);
        currentActiveDomain = newDomain;
        currentToolBucket = newTools;
      }

      const { systemInstruction, systemContext } = generateSystemPrompt(context);

      activeChatSession = gemini_ai.chats.create({
        model: "gemini-2.5-flash", // This is your Pass 2 (Executor) model
        config: {
          tools: [{ functionDeclarations: currentToolBucket }],
          systemInstruction,
        },
        history: [
          { role: "user", parts: [{ text: `${systemContext}` }] },
          { role: "model", parts: [{ text: "Understood. I have access to the user's state and tools." }] }
        ]
      });
      return activeChatSession;
    }

    // If session exists and domain didn't change, just patch the context
    const updatedSnapshot = getAppStatusSnapshot(context);
    if (updatedSnapshot) {
      console.log("Sending context patch to Gemini:", updatedSnapshot);
      await activeChatSession.sendMessage({ message: `${updatedSnapshot}` });
    }
  } catch (error) {
    console.error("Chat initialization failed:", error);
    activeChatSession = null;
  }
  return activeChatSession;
}

// Import your tool buckets and router tools from the previous step
import { RouterTools, TaskTools, HabitTools, EventTools, TimerTools, TaxonomyTools, GeneralTools, AllTools } from './tool-buckets';

export const processCommandAgentic = async (transcript: string, context: any) => {
  // =========================================================
  // PASS 1: THE ROUTER
  // =========================================================
  console.log("[AI] Starting Pass 1: Routing...");
  let selectedBucket = AllTools;
  let selectedDomain = "routeToMultiDomain"; // Safe fallback

  try {
    // We use a stateless generation call for the Router, not the chat session
    const routerResponse = await gemini_ai.models.generateContent({
      model: "gemini-2.5-flash", // Fast/Cheap model for Pass 1
      contents: [{ role: "user", parts: [{ text: transcript }] }],
      config: {
        systemInstruction: "You are an AI router. Analyze the user's prompt and call the single most appropriate routing tool. Do not answer the prompt directly.",
        tools: [{ functionDeclarations: RouterTools }],
        // In newer Gemini SDKs, this forces it to use a tool
        toolConfig: { functionCallingConfig: { mode: "ANY" } }
      }
    });

    const routeCall = routerResponse.functionCalls?.[0];

    if (routeCall) {
      selectedDomain = routeCall.name;
      console.log(`[AI] Pass 1 Complete. Selected Route: ${selectedDomain}`);

      // Map the route to the specific tools
      switch (selectedDomain) {
        case "routeToTasks": selectedBucket = [...TaskTools, ...GeneralTools]; break;
        case "routeToHabits": selectedBucket = [...HabitTools, ...GeneralTools]; break;
        case "routeToEvents": selectedBucket = [...EventTools, ...GeneralTools]; break;
        case "routeToTimers": selectedBucket = [...TimerTools, ...GeneralTools]; break;
        case "routeToTaxonomy": selectedBucket = [...TaxonomyTools, ...GeneralTools]; break;
        case "routeToMultiDomain":
        default:
          selectedBucket = AllTools;
          break;
      }
    } else {
      console.warn("[AI] Router failed to select a tool, defaulting to MultiDomain.");
    }
  } catch (routeError) {
    console.error("Router Pass Failed, falling back to all tools:", routeError);
  }

  // =========================================================
  // PASS 2: THE EXECUTOR (Your Existing Logic)
  // =========================================================

  // Initialize or retrieve the chat, passing in the dynamically selected tools
  const chat = await chatIntialize(context, selectedDomain, selectedBucket);

  let iteration = 0;
  const MAX_ITERATIONS = 5;
  let accumulatedConfirmationCalls: any[] = [];

  try {
    let result = await chat.sendMessage({ message: transcript });
    // recordGeminiUsage(result);
    console.log("FUNCTIONCALLS", result.functionCalls);
    // ... [REST OF YOUR EXISTING LOOP STAYS EXACTLY THE SAME] ...

    let currentCalls = result.functionCalls;
    let responseText = result.text;

    // 1. Isolate the first candidate safely
    const candidate = result.candidates?.[0];

    // 2. Structurally check if 'parts' is missing while 'role' is model
    const hasEmptyContent =
      candidate?.content?.role === "model" &&
      (!candidate.content.parts || candidate.content.parts.length === 0);

    if (!currentCalls && !responseText && (hasEmptyContent || result.candidates?.[0]?.finishReason === "STOP")) {
      console.log("Model returned empty candidate. Forcing tool usage...");
      const joltResult = await chat.sendMessage({
        message: "System Override: You failed to respond. You MUST use a tool (like query-tasks or search-items) to fulfill the user's previous request right now."
      });
      currentCalls = joltResult.functionCalls;
      responseText = joltResult.text;
    }

    const toolResponses = [];
    while (iteration < MAX_ITERATIONS) {
      const silentCalls = currentCalls?.filter((c: any) => SilentHandlerList.includes(c.name)) || [];
      const confirmationCalls = currentCalls?.filter((c: any) => !SilentHandlerList.includes(c.name)) || [];

      accumulatedConfirmationCalls = [...accumulatedConfirmationCalls, ...confirmationCalls];

      if (silentCalls.length === 0) break;

      for (const call of silentCalls) {
        console.log(`[Silent-Agent] Calling ${call.name} with:`, call.args);
        const handler = ActionRegistry[call.name];
        const data = await handler.execute(call.args, context);
        console.log(`[Silent-Agent]  ${call.name} returned:`, data);
        toolResponses.push({
          functionResponse: { name: call.name, response: data }
        });
      }

      const nextStep = await chat.sendMessage({
        message: { role: "user", parts: toolResponses }
      });

      // recordGeminiUsage(nextStep);
      result = nextStep;
      currentCalls = nextStep.functionCalls;
      responseText = nextStep.text;
      iteration++;
    }

    return {
      response: responseText?.replace(/```json|```/g, "").trim(),
      calls: accumulatedConfirmationCalls
    };

  } catch (error) {
    console.error("Agent Loop Failed:", error);
    throw error;
  }
};

*/


// OLD Latest Backup for Agentic Workflow 1-Pass Router
/* let activeChatSession: any = null;
export const chatIntialize = async (context: any) => {
  try {
    if (!activeChatSession) {
      const { systemInstruction, systemContext } = generateSystemPrompt(context);
      activeChatSession = gemini_ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          tools: [{ functionDeclarations: aiTools }],
          systemInstruction,
        }
                ,
                // history: [
                //   { role: "user", parts: [{ text: `${systemContext}` }] },
                //   { role: "model", parts: [{ text: "Understood. I have access to the user's state and tools." }] }
                // ]
      });
      //console.log("chatty", activeChatSession)
      return activeChatSession
    }
    //  const updatedSnapshot = getAppStatusSnapshot(context);
    // if (updatedSnapshot) {
    //   console.log("Sending context patch to Gemini:", updatedSnapshot);
    //   await activeChatSession.sendMessage({ message: `${updatedSnapshot}` });
    // }
  } catch (error) {
    console.error("Chat initialization failed:", error);
    activeChatSession = null;
  }
  //console.log("chatty", activeChatSession)
  return activeChatSession;
}

export const processCommandAgentic = async (transcript: string, context: any) => {
  //const systemContext = generateSystemPrompt(context);
  globalTranscript = transcript;
  const chat = await chatIntialize(context);
  let iteration = 0;
  const MAX_ITERATIONS = 15;
  let accumulatedConfirmationCalls: any[] = [];
  try {
    let result = await chat.sendMessage({ message: transcript });
    recordGeminiUsage(result);
    console.log("FUNCTIONCALLS", result.functionCalls);
    console.log("CHAT RESPONSE TEXT:", result.text);
    console.log("CHAT Candidates.content:", result.candidates?.[0]?.content);
    console.log("FULL RESPONSE", result)
    let currentCalls = result.functionCalls;
    let responseText = result.text;
    // 1. Isolate the first candidate safely
    const candidate = result.candidates?.[0];

    // 2. Structurally check if 'parts' is missing while 'role' is model
    const hasEmptyContent =
      candidate?.content?.role === "model" &&
      (!candidate.content.parts || candidate.content.parts.length === 0);

    if (!currentCalls && !responseText && (hasEmptyContent || result.candidates?.[0]?.finishReason === "STOP")) {
      console.log("Model returned empty candidate. Forcing tool usage...");

      // Send a silent, hidden system message to jolt it out of paralysis
      const joltResult = await chat.sendMessage({
        message: "System Override: You failed to respond. You MUST use a tool (like query-tasks or search-items) to fulfill the user's previous request right now."
      });

      currentCalls = joltResult.functionCalls;
      responseText = joltResult.text;
    }

    //  !The Fallback: If native calls are undefined, but the text looks like JSON
    // if (!currentCalls && lastResponseText.startsWith("{") && lastResponseText.includes("function_calls")) {
    //   try {
    //     const parsedText = JSON.parse(lastResponseText);


    //     if (parsedText.function_calls) {
    //       currentCalls = parsedText.function_calls.map((c: any) => ({
    //         name: c.function_name,
    //         args: c.parameters
    //       }));
    //       console.log("🛠️ Recovered from hallucinated JSON text!");
    //     }
    //   } catch (e) {
    //     console.log("Failed to parse fallback JSON, treating as normal text.");
    //   }
    // }
    const toolResponses = [];
    while (iteration < MAX_ITERATIONS) {
      // 1. Separate current calls into Silent vs. Confirmation
      const silentCalls = currentCalls?.filter((c: any) =>
        SilentHandlerList.includes(c.name) || c.args?.isPrerequisite === true
      ) || [];

      const confirmationCalls = currentCalls?.filter((c: any) =>
        !SilentHandlerList.includes(c.name) && c.args?.isPrerequisite !== true
      ) || [];

      // 2. Add confirmation calls to our global list for the user
      accumulatedConfirmationCalls = [...accumulatedConfirmationCalls, ...confirmationCalls];

      // 3. If there are no more silent tools to run, we are done
      if (silentCalls.length === 0) break;

      for (const call of silentCalls) {
        console.log(`[Silent-Agent] Calling ${call.name} with:`, call.args);
        const handler = ActionRegistry[call.name];
        const data = await handler.execute(call.args, context);
        console.log(`[Silent-Agent]  ${call.name} returned:`, data);
        toolResponses.push({
          functionResponse: {
            name: call.name,
            response: data
          }
        });

      }
      const nextStep = await chat.sendMessage({
        message: {
          role: "user",
          parts: toolResponses
        }
      });
      recordGeminiUsage(nextStep);
      result = nextStep;
      currentCalls = nextStep.functionCalls;
      responseText = nextStep.text;
      iteration++;

    }

    return {
      response: responseText?.replace(/```json|```/g, "").trim(),
      calls: accumulatedConfirmationCalls
    };


    //return  response ;
  } catch (error) {
    console.error("Agent Loop Failed:", error);
    throw error;

  }
}; */

// Old processCommandAgentic
/* export const BACKUP_processCommandAgentic = async (transcript: string, context: any) => {
  //const systemContext = generateSystemPrompt(context);
  const chat = await chatIntialize(context);
  try {
    const result = await chat.sendMessage({ message: transcript });
    console.log("Token:", result.usageMetadata);
    console.log("FUNCTIONCALLS", result.functionCalls);
    const response = result.text?.replace(/```json|```/g, "").trim();
    console.log("CHAT RESPONSE:", response);
    const calls = result.functionCalls;

    if (calls?.some((call: any) => call.name === 'search-tasks')) {
      const toolResults = [];

      for (const call of calls) {
        if (call.name === 'search-tasks') {
          const handler = ActionRegistry[call.name];
          const data = await handler.execute(call.args, context);

          toolResults.push({
            functionResponse: { name: call.name, response: { content: data } }
          });
        }
      }

      const finalResult = await chat.sendMessage(toolResults);
      return {
        response: finalResult.text,
        calls: finalResult.functionCalls // Now contains the 'Edit/Delete' calls based on search
      };
    }
    return { response, calls };


    //return  response ;
  } catch (error) {
    console.error("Agent Loop Failed:", error);
    throw error;

  }
}; */