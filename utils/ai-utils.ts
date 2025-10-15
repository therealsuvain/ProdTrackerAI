import Constants from "expo-constants";
import { AIIntent } from "@/types/ai-intent";
import { useDataTest } from "@/hooks/use-data-test";
import { Alert } from "react-native";
import { updateStreak } from "./habit-utils";
import { Asset } from "expo-asset";



const GOOGLE_API_KEY = Constants.expoConfig?.extra?.GOOGLE_STT_API_KEY;
const HF_TOKEN = Constants.expoConfig?.extra?.HUGGING_FACE_API_TOKEN;
const HF_ENDPOINT =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3";

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

    const responseWav = await fetch("http://m4a-to-wav-to-base64.vercel.app/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Audio }),
  });

   const dataWav = await responseWav.json();
   console.log("YOO")
   console.log(dataWav)
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
      console.log(data);
    } catch (e) {
      console.log("STT raw response:", text);
      throw new Error(`Unexpected STT response: ${text}`);
    }

    console.log("STT parsed response 2:", data.results?.[0]?.alternatives);
    return data.results?.[0]?.alternatives?.[0]?.transcript || "";
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
      console.log(base64WithPrefix);
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
       "params": { ...relevant fields like title, id, dueDate, activity, query... } }.
        Output ONLY valid JSON. 
        Command: "${transcript}"`;

    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 150, return_full_text: false },
      }),
    });

    const data = await response.json();
    const jsonStr = data[0]?.generated_text.trim();
    console.log(JSON.parse(jsonStr));
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
    navigation,
  }: any
) => {
  const { intent: type, params } = intent;
  switch (type) {
    case "add_task":
      const newTask = {
        id: Date.now().toString(),
        ...params,
        completed: false,
      };
      setTasks([...tasks, newTask]);
      break;
    case "edit_task":
      // Edit task has to be changed, how to identify a task via voice input
      setTasks(
        tasks.map((task: any) =>
          task.id === params.id ? { ...task, ...params } : task
        )
      );
      break;
    case "delete_task":
      // same issue as above for delete
      setTasks(tasks.filter((task: any) => task.id !== params.id));
      break;
    case "complete_task":
      //same issue as above
      setTasks(
        tasks.map((task: any) =>
          task.id === params.id ? { ...task, completed: true } : task
        )
      );
      break;
    case "add_event":
      const newEvent = { id: Date.now().toString(), ...params };
      setEvents([...events, newEvent]);
      break;
    case "edit_event":
      setEvents(
        events.map((event: any) =>
          event.id === params.id ? { ...event, ...params } : event
        )
      );
      break;
    case "delete_event":
      setEvents(events.filter((event: any) => event.id !== params.id));
      break;
    case "add_habit":
      const newHabit = { id: Date.now().toString(), ...params };
      setHabits([...habits, newHabit]);
      break;
    case "edit_habit":
      setHabits(
        habits.map((habit: any) =>
          habit.id === params.id ? { ...habit, ...params } : habit
        )
      );
      break;
    case "delete_habit":
      setHabits(habits.filter((habit: any) => habit.id !== params.id));
      break;
    case "checkin_habit":
      setHabits(
        habits.map((h: any) => (h.id === params.id ? updateStreak(h) : h))
      );
    case "add_log":
      const newLog = { id: Date.now().toString(), ...params };
      setTimerLogs([...timerLogs, newLog]);
      break;
    case "edit_log":
    case "delete_log":
    case "start_timer":
      navigation.navigate("Timer", { activity: params.activity });
    case "stop_timer":
    case "search":
    default:
      Alert.alert("Unknown intent");
  }
  //expo.speech.speak(`Action ${type} executed`)
};
