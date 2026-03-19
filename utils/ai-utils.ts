import Constants from "expo-constants";
import { AIIntent, SingleAIIntent } from "@/types/ai-intent";
import { Alert } from "react-native";
import { checkInHabit } from "./habit-utils";
import {
  createTask,
  createEvent,
  createHabit,
  createTimerLog,
} from "./model-factory-utils";
import { Task } from "@/types/task";
import Fuse from "fuse.js";
import { CalendarEvent } from "@/types/calendar";
import { Habit } from "@/types/habits";
import {
  cancelReminder,
  scheduleReminderEvents,
  scheduleReminderHabits,
  scheduleReminderTasks,
} from "@/hooks/use-notifications";
import { TimerLog } from "@/types/timer";
import { ActionRegistry, executeActions, SilentHandlerList } from "./AI-utils/registry-handler";
import { AIActionContext } from "../types/ai-handler";
import { generateSystemPrompt } from "./AI-utils/system-prompt";
import { gemini_ai } from "./AI-utils/llm-client";
import { aiTools } from "./AI-utils/tool-definitions";
import { FunctionCall } from "@google/genai";
import { getAppStatusSnapshot } from "./AI-utils/system-context";
import { recordGeminiUsage } from "./dev-util-token-monitor";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_STT_API_KEY//Constants.expoConfig?.extra?.GOOGLE_STT_API_KEY;
const HF_TOKEN = process.env.EXPO_PUBLIC_HUGGING_FACE_API_TOKEN;
const HF_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";

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

export const parseCommandToIntent = async (
  transcript: string
): Promise<AIIntent> => {
  try {
    const prompt = `Parse this user command into JSON following the format for AIIntent from Data Model A below. 
    Use the other Data Models B, C, D for reference on fields.

 Data Models (MUST FOLLOW EXACTLY):
A.  type BaseIntent =
  | "add_task"
  | "edit_task"
  | "delete_task"
  | "complete_task"
  | "add_event"
  | "edit_event"
  | "delete_event"
  | "add_habit"
  | "edit_habit"
  | "delete_habit"
  | "checkin_habit"
  | "add_log"
  | "edit_log"
  | "delete_log";
 type ExtraIntent = "start_timer" | "stop_timer" | "search";
 type SingleAIIntent = {
  intent: BaseIntent| ExtraIntent;
  params: Record<string, any>;
  searchQuery?: string;
};
 type CompoundAIIntent = {
  intent: "multi_action";
  actions: (Omit<SingleAIIntent, "intent"> & { intent: BaseIntent})[];
};
 type AIIntent =
  | SingleAIIntent
  | CompoundAIIntent;

B. CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date ;
  startTime: Date;
  endTime: Date ;
  description: string | undefined;
  reminder: boolean; // For notifications
  recurrence: 'none'|'daily'|'weekly' //  For repeating events
  category: string | undefined; // e.g., 'work', 'personal' for colors
}

C. Habit {
  title: string;
  frequency: 'daily'|'weekly';
  streak: number;
  reminder : boolean;
  reminderDate? : Date;
  lastCompleted?: Date;
  goal?: number; // e.g., 7 days in a row
}

D. Task {
  title: string;
  description?: string;
  category?: string;
  dueDate?: Date;
  reminder: boolean;
  reminderDate?: Date;
  priority: "low" | "medium" | "high";
  completed: boolean;
  tags?: string[];
}
        Ruleset (MUST follow exactly):
0. All titles must be capitalized semantically.
1. For dates: Convert 'today' to YYYY-MM-DD (local timezone). 'Tomorrow' to next day. Invalid days (e.g., 38th) → default to today. Use ISO format only (no words).
2. For all intents except add_x intents, there HAS to be a searchQuery paramter for matching to existing items.
3. For reminderDate in both tasks and habits, and startTime, endTime should only be in HH:MM:SS format
4. Output ONLY valid JSON—no explanations. 
        Command: "${transcript}"`;

    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `${prompt}`,
          },
        ],
        model: "openai/gpt-oss-120b:groq",
      }),
    });

    const data = await response.json();
    console.log("LLM full response", data);
    const jsonStr = data.choices[0].message.content;
    //home page and modal are rendering before text being parsed by the LLM
    console.log(jsonStr);
    return JSON.parse(jsonStr) as AIIntent;
  } catch (error) {
    console.error("LLM error", error);
    throw new Error("Intent parsing failed");
  }
};

export const executeSingleIntent = async (
  intent: SingleAIIntent,
  {
    tasks,
    setTasks,
    events,
    setEvents,
    habits,
    setHabits,
    timerLogs,
    setTimerLogs,
    setTitle,
    start,
    stop,
    navigation,
  }: any
) => {
  const { intent: type, params, searchQuery } = intent;
  switch (type) {
    case "add_task":
      const newTask = await createTask(params);
      if (newTask.reminder) {
        const notifId = await scheduleReminderTasks(newTask);
        newTask.notificationId = notifId;
      }
      setTasks((prevTasks: Task[]) => [...prevTasks, newTask]);
      break;
    case "edit_task":
    case "delete_task":
    case "complete_task":
      const searchKey = searchQuery || "";
      if (!searchKey)
        throw new Error("Provide title or description to identify task");
      const fuse = new Fuse<Task>(tasks, {
        keys: ["title", "description"],
        threshold: 0.6,
      }); // Loose match
      const matches = fuse.search(searchKey);
      if (matches.length === 0) throw new Error("No matching task found");
      const targetTask = matches[0].item; // Best match
      if (type === "edit_task") {
        const updated = await createTask({ ...targetTask, ...params });
        if (updated.reminder && !updated.notificationId) {
          const notifId = await scheduleReminderTasks(updated);
          updated.notificationId = notifId;
        }
        setTasks((ptasks: Task[]) =>
          ptasks.map((t: any) => (t.id === targetTask.id ? updated : t))
        );
      } else if (type === "delete_task") {
        setTasks((ptasks: Task[]) =>
          ptasks.filter((t: any) => t.id !== targetTask.id)
        );
      } else if (type === "complete_task") {
        setTasks((ptasks: Task[]) =>
          ptasks.map((t: any) =>
            t.id === targetTask.id ? { ...t, completed: true } : t
          )
        );
      }
      break;
    case "add_event":
      const newEvent = await createEvent(params);
      if (newEvent.reminder) {
        const notifIds = await scheduleReminderEvents(newEvent);
        newEvent.notificationIds = notifIds;
      }
      setEvents((pevents: CalendarEvent[]) => [...pevents, newEvent]);

      break;
    case "edit_event":
    case "delete_event":
      const eventSearchKey = searchQuery || "";
      const eventFuse = new Fuse<CalendarEvent>(events, {
        keys: ["title", "description"],
        threshold: 0.6,
      });
      const eventMatches = eventFuse.search(eventSearchKey);
      if (eventMatches.length === 0) throw new Error("No matching event found");
      const targetEvent = eventMatches[0].item;
      if (type === "edit_event") {
        const updatedEvent = await createEvent({ ...targetEvent, ...params });

        if (updatedEvent.reminder && !updatedEvent.notificationIds) {
          const notifIds = await scheduleReminderEvents(updatedEvent);
          updatedEvent.notificationIds = notifIds;
        }
        if (
          (updatedEvent.startDate.toDateString() !==
            targetEvent.startDate.toDateString() ||
            updatedEvent.endDate.toDateString() !==
            targetEvent.endDate.toDateString() ||
            updatedEvent.startTime.toTimeString() !==
            targetEvent.startTime.toTimeString() ||
            updatedEvent.endTime.toTimeString() !==
            targetEvent.endTime.toTimeString() ||
            updatedEvent.recurrence !== targetEvent.recurrence) &&
          targetEvent.notificationIds
        ) {
          targetEvent.notificationIds.forEach((n) => cancelReminder(n.id));
          const notifIds = await scheduleReminderEvents(updatedEvent);
          updatedEvent.notificationIds = notifIds;
        }
        setEvents((pevents: CalendarEvent[]) =>
          pevents.map((e: CalendarEvent) =>
            e.id === targetEvent.id ? updatedEvent : e
          )
        );
      } else {
        setEvents((pevents: CalendarEvent[]) =>
          pevents.filter((e: CalendarEvent) => e.id !== targetEvent.id)
        );
      }
      break;
    case "add_habit":
      const newHabit = await createHabit(params);
      if (newHabit.reminder) {
        const notifId = await scheduleReminderHabits(newHabit);
        newHabit.notificationId = notifId;
      }
      setHabits((phabits: Habit[]) => [...phabits, newHabit]);
      break;
    case "edit_habit":
    case "delete_habit":
    case "checkin_habit":
      const habitSearchKey = searchQuery || "";
      const habitFuse = new Fuse<Habit>(habits, {
        keys: ["title"],
        threshold: 0.6,
      });
      const habitMatches = habitFuse.search(habitSearchKey);
      if (habitMatches.length === 0) throw new Error("No matching habit found");
      const targetHabit = habitMatches[0].item;
      if (type === "checkin_habit") {
        const updatedHabit = checkInHabit(targetHabit); // From habitUtils
        setHabits(
          habits.map((h: Habit) => (h.id === targetHabit.id ? updatedHabit : h))
        );
      } else if (type === "edit_habit") {
        const updatedHabit = await createHabit({ ...targetHabit, ...params });
        if (updatedHabit.reminder && !updatedHabit.notificationId) {
          const notifId = await scheduleReminderHabits(updatedHabit);
          updatedHabit.notificationId = notifId;
        }
        setHabits((phabits: Habit[]) =>
          phabits.map((h: Habit) =>
            h.id === targetHabit.id ? updatedHabit : h
          )
        );
      } else {
        setHabits((phabits: Habit[]) =>
          phabits.filter((h: Habit) => h.id !== targetHabit.id)
        );
      }
      break;
    case "add_log":
      const newLog = createTimerLog(params);
      setTimerLogs((ptimerLogs: TimerLog[]) => [...ptimerLogs, newLog]);
      break;
    case "edit_log":
    case "delete_log":
    case "start_timer":
      setTitle(params.title);
      start();
      navigation.navigate("timer-screen");
      break;
    case "stop_timer":
      stop();
      navigation.navigate("timer-screen");
      break;
    //case "search":
    default:
      Alert.alert("Unknown intent");
  }
};
export const validateParams = (intent: string, params: any) => {
  const requiresId = ['edit_task', 'delete_task', 'complete_task', 'checkin_habit'];

  if (requiresId.includes(intent) && !params.id) {
    throw new Error(`Intent ${intent} requires a valid 'id' parameter.`);
  }

  // Add more specific logic: e.g., dueDate must be a valid ISO string
  return true;
};

export const runSafeAgentLoop = async (transcript: string, context: any) => {
  // 1. Get Gemini's Plan
  const plan = await runAgentLoop(transcript, context);

  const pendingActions = [];
  const safeActions = [];

  for (const action of plan?.actions) {
    if (isDestructive(action.intent)) {
      pendingActions.push(action); // Needs UI confirmation
    } else {
      safeActions.push(action); // Can run immediately
    }
  }

  // 2. Execute safe actions (Add task, Start timer)
  if (safeActions.length > 0) {
    await executeActions(safeActions, context);
  }

  // 3. Return pending actions to show in IntentConfirmationModal
  return {
    reasoning: plan?.reasoning,
    pendingActions: pendingActions,
    requiresConfirmation: pendingActions.length > 0
  };
};

export const DESTRUCTIVE_ACTIONS = ['delete_task', 'delete_event', 'delete_habit'];

export const isDestructive = (intent: string) => DESTRUCTIVE_ACTIONS.includes(intent);

let activeChatSession: any = null;
export const chatIntialize = async (context: any) => {
  try {
    if (!activeChatSession) {
      const {systemInstruction,systemContext} = generateSystemPrompt(context);
      activeChatSession = gemini_ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
          tools: [{ functionDeclarations: aiTools }],
          systemInstruction,
        }
        ,
        history: [
          { role: "user", parts: [{ text: `${systemContext}` }] },
          { role: "model", parts: [{ text: "Understood. I have access to the user's state and tools." }] }
        ]
      });
      //console.log("chatty", activeChatSession)
      return activeChatSession
    }
    const updatedSnapshot = getAppStatusSnapshot(context);
    if (updatedSnapshot) {
      console.log("Sending context patch to Gemini:", updatedSnapshot);
      await activeChatSession.sendMessage({ message: `${updatedSnapshot}` });
    }
  } catch (error) {
    console.error("Chat initialization failed:", error);
    activeChatSession = null;
  }
  //console.log("chatty", activeChatSession)
  return activeChatSession;
}

export const runAgentLoop = async (userInput: string, context: any) => {
  const chat = await chatIntialize(context);
  let message = userInput;
  let response = await chat.sendMessage({ message });

  // MAX_TURNS prevents infinite loops if the AI gets confused
  const MAX_TURNS = 5;
  let turns = 0;

  while (turns < MAX_TURNS) {
    const calls = response.functionCalls;

    // If there are no more function calls, the AI is done and just responding with text.
    if (!calls || calls.length === 0) break;

    const toolResults = [];

    // Execute each tool call and collect results
    for (const call of calls) {
      if (!call.name) continue;
      const handler = ActionRegistry[call.name];
      if (handler) {
        const result = await handler.execute(call.args, context);
        // We must format the result as a 'FunctionResponse' to send back to Gemini
        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { content: result }
          }
        });
      }
    }

    // Send the observations back to Gemini so it can take the next step
    response = await chat.sendMessage({ message: toolResults });
    turns++;
  }

  return JSON.parse(response.text || "");
};

export const BACKUP_processCommandAgentic = async (transcript: string, context: any) => {
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
};

export const processCommandAgentic = async (transcript: string, context: any) => {
  //const systemContext = generateSystemPrompt(context);
  const chat = await chatIntialize(context);
  let iteration = 0;
  const MAX_ITERATIONS = 3;
  let accumulatedConfirmationCalls: any[] = [];
  try {
    let result = await chat.sendMessage({ message: transcript });
    recordGeminiUsage(result);
    console.log("FUNCTIONCALLS", result.functionCalls);
    console.log("CHAT RESPONSE TEXT:", result.text);
    console.log("CHAT Candidates.content:", result.candidates?.[0]?.content);
    console.log("FULL RESPONSE", result)
    let currentCalls = result.functionCalls;

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
        SilentHandlerList.includes(c.name)
      ) || [];

      const confirmationCalls = currentCalls?.filter((c: any) =>
        !SilentHandlerList.includes(c.name)
      ) || [];

      // 2. Add confirmation calls to our global list for the user
      accumulatedConfirmationCalls = [...accumulatedConfirmationCalls, ...confirmationCalls];

      // 3. If there are no more silent tools to run, we are done
      if (silentCalls.length === 0) break;

      let toolResults;
      for (const call of silentCalls) {
        console.log(`[Silent-Agent] Calling ${call.name} with:`, call.args);
        const handler = ActionRegistry[call.name];
        const data = await handler.execute(call.args, context);
        toolResults = {
          name: call.name,
          response: { result: data }
        };
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
      iteration++;

    }

    return {
      response: result.text?.replace(/```json|```/g, "").trim(),
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
  if (calls) {
    for (const call of calls) {
      if (!call.name) continue;
      console.log(call.name)
      const handler = ActionRegistry[call.name];
      if (handler) {
        console.log(`[Agent] Calling ${call.name} with:`, call.args);
        await handler.execute(call.args, context);
      }
    }
    //return { success: true, message: "Actions executed successfully." };
  }
}
export const processUserCommand = async (userTranscript: string, context: any) => {
  const {systemInstruction} = generateSystemPrompt(context, userTranscript);

  try {

    const response = await gemini_ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // This forces JSON output
      },
      contents: systemInstruction,
    });
    console.log("Token:", response.usageMetadata);
    const text = response.text;

    // Clean Markdown backticks if Gemini adds them
    const cleanedJson = text?.replace(/```json|```/g, "").trim();
    const parsedIntent = JSON.parse(cleanedJson || "{}");

    if (parsedIntent.actions && parsedIntent.actions.length > 0) {
      await executeActions(parsedIntent.actions, context);
    }
    return parsedIntent;
  } catch (error) {
    console.error("Agentic Error:", error);
    throw error;
  }
};

export const executeIntent = async (
  intent: AIIntent,
  setIsProcessing: (value: boolean) => void,
  {
    tasks,
    setTasks,
    events,
    setEvents,
    habits,
    setHabits,
    timerLogs,
    setTimerLogs,
    setTitle,
    start,
    stop,
    navigation,
  }: any
) => {
  try {
    setIsProcessing(true);
    if (intent.intent === "multi_action") {
      for (const action of intent.actions) {
        console.log(action);
        await executeSingleIntent(action, {
          tasks,
          setTasks,
          events,
          setEvents,
          habits,
          setHabits,
          timerLogs,
          setTimerLogs,
          setTitle,
          start,
          stop,
          navigation,
        });
      }
    } else {
      await executeSingleIntent(intent, {
        tasks,
        setTasks,
        events,
        setEvents,
        habits,
        setHabits,
        timerLogs,
        setTimerLogs,
        setTitle,
        start,
        stop,
        navigation,
      });
    }
  } catch (e) {
    console.log(e);
  } finally {
    setIsProcessing(false);
  }
  //expo.speech.speak(`Action ${type} executed`)
};
