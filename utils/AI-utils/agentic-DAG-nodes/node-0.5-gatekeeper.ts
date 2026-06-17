import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";
import { GatekeeperOutput } from "@/types/agent-state";

export const isTrivialChitChat = (transcript: string): boolean => {
    const normalized = transcript.trim().toLowerCase();
    // Fast fail for common 1-word greetings/acknowledgments
    if (/^(yo|hi|hello|hey|thanks|ok|okay|bye)$/.test(normalized)) return true;

    // Fast fail for short strings lacking action verbs (add, delete, etc.)
    const actionVerbs = ['add', 'create', 'delete', 'remove', 'update', 'show', 'list', 'what', 'when', 'rerun'];
    const hasActionVerb = actionVerbs.some(verb => normalized.includes(verb));

    return normalized.length < 15 && !hasActionVerb;
};

export const evaluateTrivialIntent = (transcript: string): boolean => {
    const normalized = transcript.trim().toLowerCase();
    console.log("[DAG] NODE 0: Normalized Transcript:", normalized);
    // Deterministic 1-word match tokens
    const exactMatches = new Set(['yo', 'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'bye']);
    if (exactMatches.has(normalized)) return true;

    // Strategic regex catch for short generic acknowledgments without payload markers
    const explicitActionVerbs = /(add|create|delete|remove|update|show|list|track|timer|rerun|history)/i;
    const isShortString = normalized.length < 12;

    return isShortString && !explicitActionVerbs.test(normalized);
};


export const executeGatekeeperNode = async (transcript: string): Promise<GatekeeperOutput> => {
    const response = await gemini_ai.models.generateContent({
        model: 'gemini-2.5-flash', // Tuned for ultra-low latency classifications
        contents: transcript,
        config: {
            systemInstruction: `You are the Gatekeeper Node for an AI productivity engine. 
      Analyze the user input and classify its downstream trajectory.
      
      CRITERIA:
      - Route to 'chat' ONLY if the message is conversational, general inquiries, or abstract talk without task/habit context.
      - Route to 'agent' if the intent modifies, queries, or interacts with habits, tasks, timers, categories, or historical actions.
      
      If route is 'chat', populate 'chatResponse' with a sharp, premium, productivity-focused conversational reply.`,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    route: { type: 'STRING', enum: ['chat', 'agent'] },
                    chatResponse: { type: 'STRING', "description": "Only populated if route is 'chat'. A quirky, relatable conversational response." }
                },
                required: ['route']
            }
        }
    });

    recordGeminiUsage(response, 'GATEKEEPER');
    console.log("[DAG] NODE 0: FULL RESPONSE:", response);
    if (!response.text) {
        throw new Error('Gatekeeper failed to respond');
    }
    console.log("[DAG] NODE 0: RESPONSE TEXT:", response.text);
    return JSON.parse(response.text) as GatekeeperOutput;
};