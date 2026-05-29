

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