import { FunctionCall, FunctionCallingConfigMode } from "@google/genai";
import { AIActionContext } from "../types/ai-handler";
import { gemini_ai } from "./AI-utils/llm-client";
import { ActionRegistry, SilentHandlerList } from "./AI-utils/registry-handler";
import { getAppStatusSnapshot } from "./AI-utils/system-context";
import { generateSystemPrompt } from "./AI-utils/system-prompt";
import { aiTools } from "./AI-utils/tool-definitions";
import { recordGeminiUsage } from "./dev-util-token-monitor";
import { RouterTools } from './AI-utils/router-tools';
import { TaskTools, HabitTools, EventTools, TimerTools, TaxonomyTools, GeneralTools, AllTools } from './AI-utils/tool-def-buckets';
import { AgentState } from "@/types/agent-state";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY//Constants.expoConfig?.extra?.GOOGLE_STT_API_KEY;
const HF_TOKEN = process.env.EXPO_PUBLIC_HUGGING_FACE_API_TOKEN;
const HF_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
let globalTranscript: string = "";

export const transcribeAudio = async (
  input: string,
  isBase64 = false
): Promise<string> => {
  try {
    let base64Audio: string;
    if (isBase64) {
      base64Audio = input;
    } else {
      // fetch file, convert to blob, then to base64
      const audioData = await fetch(input).then((res) => res.blob());

      base64Audio = await blobToBase64(audioData);
    }

    const responseWav = await fetch(
      "http://m4a-to-wav-to-base64.vercel.app/api/convert",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Audio }),
      }
    );

    const dataWav = await responseWav.json();
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        body: JSON.stringify({
          config: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            languageCode: "en-US",
          },
          audio: {
            content: dataWav.base64Wav,
          },
        }),
      }
    );

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("STT raw response:", text);
      throw new Error(`Unexpected STT response: ${e}`);
    }
    if (data.error) {
      const { code, message, status } = data.error;
      const formattedError = `Google STT Error (${status || code}): ${message}`;
      console.error(formattedError);
      throw new Error(formattedError);
    }

    if (
      !data.results ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      console.warn("No transcription results returned:", data);
      return "";
    }

    const transcript = data.results
      .map((r: any) => r.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(" ")
      .trim();

    console.log("Full Transcript:", transcript || "(empty)");

    return transcript;
  } catch (error) {
    console.error("STT error", error);
    throw new Error("Transcription failed");
  }
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64WithPrefix = reader.result as string;
      const base64 = base64WithPrefix.split(",")[1]; // Remove "data:...;base64,"
      resolve(base64);
    };
    reader.onerror = reject;
  });

export const DESTRUCTIVE_ACTIONS = ['delete_task', 'delete_event', 'delete_habit'];

export const isDestructive = (intent: string) => DESTRUCTIVE_ACTIONS.includes(intent);

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

export const processCommandAgenticPAUSED = async (transcript: string, context: any) => {

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


const executePlannerNode = async (transcript: string): Promise<string[]> => {
  console.log("=========================================================");
  console.log("[DAG] Node 1: PLANNER (Extracting Checklist)...");

  const plannerPrompt = `
  Extract a strict, separate list of actions the user wants to perform. 
  Example: "Create task Sleep and category Leisure" -> ["Create task Sleep", "Create category Leisure"]
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
          description: "List of distinct tasks requested by the user."
        }
      }
    });

    recordGeminiUsage(result); // Hook up your metrics
    console.log("[DAG] Node 1:FUNCTIONCALLS", result.functionCalls);
    console.log("[DAG] Node 1:CHAT RESPONSE TEXT:", result.text);
    console.log("[DAG] Node 1:CHAT Candidates.content:", result.candidates?.[0]?.content);
    console.log("[DAG] Node 1:FULL RESPONSE", result)
    const checklist = JSON.parse(result.text || "[]");
    console.log("[DAG] Checklist generated:", checklist);
    console.log("=========================================================");
    return checklist;

  } catch (e) {
    console.error("Planner Node Failed:", e);
    console.log("=========================================================");
    return [transcript]; // Fallback to just the raw transcript
  }

};

const executeRouterNode = async (transcript: string): Promise<{ domain: string, tools: any[] }> => {
  console.log("=========================================================");
  console.log("[DAG] Node 2: ROUTER (Selecting Tool Bucket)...");

  globalTranscript = transcript;
  let selectedDomain = "routeToMultiDomain";
  let selectedBucket = AllTools;
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
    console.log("[DAG] Node 2:FUNCTIONCALLS", routerResponse.functionCalls);
    console.log("[DAG] Node 2:CHAT RESPONSE TEXT:", routerResponse.text);
    console.log("[DAG] Node 2:CHAT Candidates.content:", routerResponse.candidates?.[0]?.content);
    console.log("[DAG] Node 2:FULL RESPONSE", routerResponse)

    const routeCall = routerResponse.functionCalls?.[0];

    if (routeCall) {
      if (routeCall.name) {
        selectedDomain = routeCall.name;
        console.log(`[DAG] Node 2 Complete. Selected Route: ${selectedDomain}`);
      }
      else {
        console.warn("[DAG] Node 2 Failed: routeCall.name was UNDEFINED, failed to select specific Domain, defaulting to MultiDomain.");
      }

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

      console.warn("[DAG] Node 2 Failed: Router failed to select a tool, defaulting to MultiDomainTool.");
      console.log("=========================================================");
    }
  } catch (routeError) {

    console.error("[DAG] Node 2 Failed: Router Pass Failed, falling back to all tools:", routeError);
    console.log("=========================================================");
  }

  console.log("=========================================================");
  return { domain: selectedDomain, tools: selectedBucket };
};

const executeActionNode = async (state: AgentState, context: any): Promise<Partial<AgentState>> => {
  console.log("=========================================================");
  console.log("[DAG] Node 3: EXECUTOR (Running Tools)...");
  console.log("_________________________________________________________");
  console.log("[DAG] Node 3: State Recieved:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
  console.log("_________________________________________________________");
  // Initialize chat session (your existing function)
  const chat = await chatIntialize(context, state.selectedDomain, state.selectedTools);
  const payload = state.chatHistory.length === 0 ? state.transcript : state.chatHistory;
  // Inject the ongoing chat history so it remembers previous turns!
  const response = await chat.sendMessage({ message: payload });

  recordGeminiUsage(response);
  console.log("[DAG] Node 3:FUNCTIONCALLS", response.functionCalls);
  console.log("[DAG] Node 3:CHAT RESPONSE TEXT:", response.text);
  console.log("[DAG] Node 3:CHAT Candidates.content:", response.candidates?.[0]?.content);
  console.log("[DAG] Node 3:FULL RESPONSE", response)

  const currentCalls = response.functionCalls || [];
  let toolResponsesForNextTurn: any[] = [];
  let newConfirmationCalls: any[] = [];

  // 1. Sort calls into Silent vs Confirmation
  for (const call of currentCalls) {
    if (SilentHandlerList.includes(call.name) || call.args?.isPrerequisite === true) {
      console.log(`[Silent-Agent] Executing ${call.name}...`);
      const data = await ActionRegistry[call.name].execute(call.args, context);
      const formattedData = typeof data === 'object' && data !== null ? data : { result: data };
      toolResponsesForNextTurn.push({ functionResponse: { name: call.name, response: formattedData } });
    } else {
      newConfirmationCalls.push(call);
    }
  }

  //! 2. VERY BASIC Checklist cross-referencing (We can make this smarter later)
  // !For now, if we executed tools, we assume we knocked items off the list.
  let remainingChecklist = [...state.checklist];
  if (newConfirmationCalls.length > 0 && remainingChecklist.length > 0) {
    remainingChecklist.shift();
  }
  console.log("_________________________________________________________");
  console.log("[DAG] Node 3: Results", {
    accumulatedConfirmationCalls: [...state.accumulatedConfirmationCalls, ...newConfirmationCalls],
    finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
    checklist: remainingChecklist,
    chatHistory: toolResponsesForNextTurn.length > 0
      ? { role: "user", parts: toolResponsesForNextTurn } // Feed DB results back next loop
      : []
  });
  console.log("=========================================================");
  return {
    accumulatedConfirmationCalls: [...state.accumulatedConfirmationCalls, ...newConfirmationCalls],
    finalTextResponse: response.text?.replace(/```json|```/g, "").trim(),
    checklist: remainingChecklist,
    chatHistory: toolResponsesForNextTurn.length > 0
      ? toolResponsesForNextTurn // Feed DB results back next loop
      : []
  };
};

export const processCommandAgentic = async (transcript: string, context: any) => {
  // 1. Initialize State
  let state: AgentState = {
    transcript,
    checklist: [],
    selectedDomain: "",
    selectedTools: [],
    chatHistory: [],
    accumulatedConfirmationCalls: [],
    finalTextResponse: ""
  };

  try {
    // 2. Run Planner (Only if prompt looks complex, otherwise skip to save tokens)
    if (transcript.includes("and") || transcript.includes(",")) {
      state.checklist = await executePlannerNode(state.transcript);
    } else {
      state.checklist = [state.transcript];
    }

    // 3. Run Router
    const { domain, tools } = await executeRouterNode(state.transcript);
    state.selectedDomain = domain;
    state.selectedTools = tools;

    // 4. The Graph Edge Loop
    console.log("_________________________________________________________");
    console.log("[DAG] Node Main: State:", JSON.stringify({ ...state, selectedTools: state.selectedDomain }));
    console.log("_________________________________________________________");
    let safetyCounter = 0;
    while (safetyCounter < 5) {
      // Run the Executor
      const nodeResult = await executeActionNode(state, context);

      // Mutate State
      state = { ...state, ...nodeResult };

      // THE CONDITIONAL EDGE: Are we done?
      if (state.chatHistory.length > 0) {
        // We have silent DB results to feed back to the AI. Loop again.
        console.log("[DAG] Edge: Silent tools executed, looping back to Executor...");
      }
      else if (state.checklist.length > 0 && state.accumulatedConfirmationCalls.length === 0) {
        // TUNNEL VISION DETECTED! The AI stopped, but the checklist isn't empty.
        console.log(`[DAG] Edge: Tunnel Vision detected! Forcing AI to complete: ${state.checklist}`);

        // Jolt the AI with a strict system override
        state.chatHistory = [{
          role: "user",
          parts: [{ text: `System Override: You stopped, but you still need to fulfill this request: "${state.checklist[0]}". Call the required tools now.` }]
        }];
      }
      else {
        // Checklist is empty, and no pending silent tools. We are officially done.
        console.log("[DAG] Edge: Execution complete. Exiting graph.");
        break;
      }

      safetyCounter++;
    }
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