import { GoogleGenAI } from "@google/genai";

// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
export const gemini_ai = new GoogleGenAI({ apiKey: `${GEMINI_API_KEY}` });


export async function geminiPrompt(transcript: string) {
  const response = await gemini_ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
    responseMimeType: "application/json", // This forces JSON output
  },
    contents: transcript,
  }); 
  console.log(response);
  return response;
}

