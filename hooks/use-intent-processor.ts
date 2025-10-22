import { useNavigation } from "expo-router";
import { useDataTest } from "./use-data-test"
import { useState } from "react";
import { AIIntent } from "@/types/ai-intent";
import { executeIntent, parseCommandToIntent } from "@/utils/ai-utils";

export const useIntentProcessor = () => {
    const dataContext = useDataTest();
    const navigation = useNavigation();
    const [intent, setIntent]= useState<AIIntent|null>(null);
    const [procesingError, setProcessingError]= useState<string|null>(null);
    

    const processCommand = async (transcript: string) => {
        try {
            setProcessingError(null);
            const parsedIntent = await parseCommandToIntent(transcript);
            setIntent(parsedIntent)
            console.log("intent processor", intent)
        } catch (err){
            setProcessingError('Failed to process command')
        }
    };
    const isValidIntent = (val: AIIntent | null): val is AIIntent => val !== null;
    const confirmExecute = ()=> {
        if (isValidIntent(intent)){
        executeIntent(intent, {...dataContext, navigation})
        setIntent(null)
        }
    }

    return {processCommand, confirmExecute, intent, procesingError}
}
