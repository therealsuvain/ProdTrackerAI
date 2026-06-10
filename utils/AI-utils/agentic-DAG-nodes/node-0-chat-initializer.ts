import { gemini_ai } from "../llm-client";
import { generateSystemPrompt } from "../system-prompt";
import { AllTools } from "../agentic-tool-router/tool-def-buckets";

let activeChatSession: any = null;
let currentActiveDomain: string | null = null; // Tracks which bucket is currently loaded
let currentToolBucket: any[] = AllTools;       // Fallback to all tools initially
export const chatIntialize = async (context: any, newDomain?: string, newTools?: any[], chatHistory?: any[]) => {
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
            const history = chatHistory || [];
            activeChatSession = gemini_ai.chats.create({
                model: "gemini-2.5-flash",
                history,
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