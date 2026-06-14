import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../llm-client";
import { MasterToolIndex } from "../agentic-tool-router/tool-index";
import { resolveDependencies } from "./node-helpers/node-2-helpers";

export const executeRouterNode = async (transcript: string, checklist: string[]): Promise<{ domain: string, tools: any[] }> => {
    console.log("=========================================================");
    console.log("[DAG] Node 2: ROUTER (Selecting Tool Bucket)...");
    const routerPrompt = `
  You are a highly efficient routing assistant.
  The user wants to accomplish this checklist: ${JSON.stringify(checklist)}
  
  Here is your master index of available tools:
  ${JSON.stringify(MasterToolIndex, null, 2)}
  
  Analyze the checklist. Which specific tools from the master index are required to fulfill the user's request?
  Return ONLY a JSON array containing the exact string keys of the required tools.
  `;

    try {
        const routerResponse = await gemini_ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: routerPrompt }] }],
            config: {
                // NO MORE HEAVY TOOLS ARRAY HERE!
                responseMimeType: "application/json",
                responseSchema: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "An array of exactly matching string keys from the MasterToolIndex."
                }
            }
        });
        recordGeminiUsage(routerResponse, "ROUTER");
        console.log("[DAG] Node 2:FUNCTIONCALLS", routerResponse.functionCalls);
        console.log("[DAG] Node 2:CHAT RESPONSE TEXT:", routerResponse.text);
        console.log("[DAG] Node 2:CHAT Candidates.content:", routerResponse.candidates?.[0]?.content);
        console.log("[DAG] Node 2:FULL RESPONSE", routerResponse)
        const requestedToolNames: string[] = JSON.parse(routerResponse.text || "[]");
        console.log("[DAG] Node 2: Requested Tools", [...requestedToolNames])
        // 2. Pass them through our bulletproof injector
        const resolvedToolSchemas = resolveDependencies(requestedToolNames, checklist);
        console.log("[DAG] Node 2: Resolved Tool Schemas", [...resolvedToolSchemas.map(tool => tool.name)])
        console.log("=========================================================");
        return {
            domain: requestedToolNames.join(", "),
            tools: resolvedToolSchemas
        };

    } catch (error) {
        console.error("[DAG] Router execution failed:", error);
        // Fallback: If it crashes, fail gracefully by loading standard tools
        return {
            domain: "Fallback",
            tools: resolveDependencies(["addTask", "addHabit", "addCategory"], checklist)
        };
    }
    /* return { domain: requiredDomains.join(", "), tools: uniqueTools }; */
};