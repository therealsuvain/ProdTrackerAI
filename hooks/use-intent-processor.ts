import { useNavigation } from "expo-router";
import { useData } from "./use-data";
import { useState } from "react";
import { AIIntent } from "@/types/ai-intent";
import { processCommandAgentic, agenticExecutor } from "@/utils/ai-utils";
import { useTimer } from "./use-timer";
import { FunctionCall } from "@google/genai";

export const useIntentProcessor = () => {
  const dataContext = useData();
  const { setTitle, start, stop } = useTimer();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [intent, setIntent] = useState<string|undefined>(undefined);
  const [AIFunctionCalls, setAIFunctionCalls] = useState<FunctionCall[] | undefined>();
  const [procesingError, setProcessingError] = useState<string | null>(null);

  const processCommand = async (transcript: string) => {
    try {
      setIsLoading(true);
      setIntent(undefined);
      setProcessingError(null);
      console.log("Processing command:", transcript);
      const {response , calls} = await processCommandAgentic(transcript, { ...dataContext, setTitle, start, stop, navigation });
      //processUserCommand(transcript, {...dataContext, start, stop, navigation})
      //parseCommandToIntent(transcript);
      //geminiPrompt(transcript);
      console.log("AI calls:", calls);
      console.log("AI response:", response);
      setIntent(response);
      setAIFunctionCalls(calls);
      setIsLoading(false);
      //console.log("intent processor", intent)
    } catch (err) {
      setProcessingError("Failed to process command");
    }
  };
  //const isValidIntent = (val: string|undefined): val is string => val !== undefined;
  const confirmExecute = async () => {
  //  if (isValidIntent(intent)) {
      await agenticExecutor(AIFunctionCalls, { ...dataContext, setTitle, start, stop, navigation });
      // executeIntent(
      //   intent,
      //   setIsProcessing,
      //   { ...dataContext, setTitle, start, stop, navigation }
      // );
      //setIntent(undefined);
      //setAIFunctionCalls(undefined);
   // }
  };

  return { isLoading, isProcessing, processCommand, confirmExecute, intent, procesingError };
};
