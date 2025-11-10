import { useNavigation } from "expo-router";
import { useData } from "./use-data";
import { useState } from "react";
import { AIIntent } from "@/types/ai-intent";
import { executeIntent, parseCommandToIntent } from "@/utils/ai-utils";
import { useTimer } from "./use-timer";

export const useIntentProcessor = () => {
  const dataContext = useData();
  const { setTitle, start, stop } = useTimer();
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [intent, setIntent] = useState<AIIntent | null>(null);
  const [procesingError, setProcessingError] = useState<string | null>(null);

  const processCommand = async (transcript: string) => {
    try {
      setIsLoading(true);
      setIntent(null);
      setProcessingError(null);
      const parsedIntent = await parseCommandToIntent(transcript);
      setIntent(parsedIntent);
      setIsLoading(false);
      //console.log("intent processor", intent)
    } catch (err) {
      setProcessingError("Failed to process command");
    }
  };
  const isValidIntent = (val: AIIntent | null): val is AIIntent => val !== null;
  const confirmExecute = () => {
    if (isValidIntent(intent)) {
      executeIntent(
        intent,
        setIsProcessing,
        { ...dataContext, setTitle, start, stop, navigation }
      );
      setIntent(null);
    }
  };

  return { isLoading, isProcessing, processCommand, confirmExecute, intent, procesingError };
};
