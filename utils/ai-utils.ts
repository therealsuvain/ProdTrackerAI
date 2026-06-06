//TODO  : Execution results shared with the feedback loop should be trimmed as much as possible to save tokens
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
