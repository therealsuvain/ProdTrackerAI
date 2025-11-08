import Constants from "expo-constants";
import { AIIntent } from "@/types/ai-intent";
import { Alert } from "react-native";
import { updateStreak } from "./habit-utils";
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

const GOOGLE_API_KEY = Constants.expoConfig?.extra?.GOOGLE_STT_API_KEY;
const HF_TOKEN = Constants.expoConfig?.extra?.HUGGING_FACE_API_TOKEN;
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

    console.log("wav", base64Audio.length);
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
      console.log(base64WithPrefix.length);
      const base64 = base64WithPrefix.split(",")[1]; // Remove "data:...;base64,"
      resolve(base64);
    };
    reader.onerror = reject;
  });

export const parseCommandToIntent = async (
  transcript: string
): Promise<AIIntent> => {
  try {
    const prompt = `Parse this user command into JSON with 
    { "intent": "add_task" | "edit_task" | "delete_task" | "complete_task" | 
     "add_event" | "edit_event" | "delete_event" |
      "add_habit" | "edit_habit" | "delete_habit" | "checkin_habit" 
      | "add_log" | "edit_log" | "delete_log" |
       "start_timer" | "stop_timer" | "search", 
       "params": { ...relevant fields from data models below }.

       Use the following Data Models:
A. CalendarEvent {
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

B. Habit {
  title: string;
  frequency: 'daily'|'weekly';
  streak: number;
  reminder : boolean;
  reminderDate? : Date;
  lastCompleted?: Date;
  goal?: number; // e.g., 7 days in a row
}

C. Task {
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
1. For dates: Convert 'today' to YYYY-MM-DD (local timezone). 'Tomorrow' to next day. Invalid days (e.g., 38th) → default to today. Use ISO format only (no words).
2. If editing/deleting, suggest approximate title/description for matching (e.g., "edit task about groceries").
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
    const jsonStr = data.choices[0].message.content;
    //home page and modal are rendering before text being parsed by the LLM
    console.log(jsonStr);
    return JSON.parse(jsonStr) as AIIntent;
  } catch (error) {
    console.error("LLM error", error);
    throw new Error("Intent parsing failed");
  }
};

export const executeIntent = (
  intent: AIIntent,
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
    const { intent: type, params } = intent;
    switch (type) {
      case "add_task":
        const newTask = createTask(params);
        console.log(newTask);
        setTasks([...tasks, newTask]);
        break;
      case "edit_task":
      case "delete_task":
      case "complete_task":
        const searchKey = params.title || params.description || "";
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
          const updated = createTask({ ...targetTask, ...params });
          setTasks(
            tasks.map((t: any) => (t.id === targetTask.id ? updated : t))
          );
        } else if (type === "delete_task") {
          setTasks(tasks.filter((t: any) => t.id !== targetTask.id));
        } else if (type === "complete_task") {
          setTasks(
            tasks.map((t: any) =>
              t.id === targetTask.id ? { ...t, completed: true } : t
            )
          );
        }
        break;
      case "add_event":
        const newEvent = createEvent(params);
        setEvents([...events, newEvent]);
        break;
      case "edit_event":
      case "delete_event":
        const eventSearchKey = params.title || params.description || "";
        const eventFuse = new Fuse<CalendarEvent>(events, {
          keys: ["title", "description"],
          threshold: 0.6,
        });
        const eventMatches = eventFuse.search(eventSearchKey);
        if (eventMatches.length === 0)
          throw new Error("No matching event found");
        const targetEvent = eventMatches[0].item;
        if (type === "edit_event") {
          const updatedEvent = createEvent({ ...targetEvent, ...params });
          setEvents(
            events.map((e: CalendarEvent) =>
              e.id === targetEvent.id ? updatedEvent : e
            )
          );
        } else {
          setEvents(
            events.filter((e: CalendarEvent) => e.id !== targetEvent.id)
          );
        }
        break;
      case "add_habit":
        const newHabit = createHabit(params);
        setHabits([...habits, newHabit]);
        break;
      case "edit_habit":
      case "delete_habit":
      case "checkin_habit":
        const habitSearchKey = params.title || "";
        const habitFuse = new Fuse<Habit>(habits, {
          keys: ["title"],
          threshold: 0.6,
        });
        const habitMatches = habitFuse.search(habitSearchKey);
        if (habitMatches.length === 0)
          throw new Error("No matching habit found");
        const targetHabit = habitMatches[0].item;
        if (type === "checkin_habit") {
          const updatedHabit = updateStreak(targetHabit); // From habitUtils
          setHabits(
            habits.map((h: Habit) =>
              h.id === targetHabit.id ? updatedHabit : h
            )
          );
        } else if (type === "edit_habit") {
          const updatedHabit = createHabit({ ...targetHabit, ...params });
          setHabits(
            habits.map((h: Habit) =>
              h.id === targetHabit.id ? updatedHabit : h
            )
          );
        } else {
          setHabits(habits.filter((h: Habit) => h.id !== targetHabit.id));
        }
        break;
      case "add_log":
        const newLog = createTimerLog(params);
        setTimerLogs([...timerLogs, newLog]);
        break;
      case "edit_log":
      case "delete_log":
      case "start_timer":
        setTitle(params.title);
        start();
        console.log("In it");
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
  } catch (e) {
    console.log(e);
  }
  //expo.speech.speak(`Action ${type} executed`)
};
