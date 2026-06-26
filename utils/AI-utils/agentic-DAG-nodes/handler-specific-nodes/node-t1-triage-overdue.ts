import { recordGeminiUsage } from "@/utils/dev-util-token-monitor";
import { gemini_ai } from "../../llm-client";
import { DailyCapacity } from "@/types/agent-state"
import { Task } from "@/types/task";
import { format } from "date-fns";

export const exceuteTriageOverdueNode = async (overdueTasks: Task[], daysToSpread: any, capacityMap: Record<string, DailyCapacity>) => {
    const today = new Date();
    const todayISO = format(today, 'yyyy-MM-dd');
    const todayHuman = format(today, 'MMMM do yyyy, h:mm a');
    const timeZone = format(today, 'O');
    const triagePrompt = `
# TEMPORAL CONTEXT
- Today's Date (ISO): ${todayISO}
- Current Time: ${todayHuman}
- User Timezone: ${timeZone}
            You are a Chief of Staff. Reschedule these overdue tasks across the next ${daysToSpread} days.
            Do NOT assign more tasks to a day than its 'freeMinutes' capacity can handle relative to other days.
            Estimate task time organically based on the title (e.g., 'Email' = 5m, 'Write Report' = 60m).
            
            Capacity Map: ${JSON.stringify(capacityMap)}
            Overdue Tasks: ${JSON.stringify(overdueTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority })))}
            
            Return ONLY a JSON array of objects with { "taskId": "string", "newDate": "YYYY-MM-DD" }.
        `;


    const response = await gemini_ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: triagePrompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        taskId: { type: "string", description: "First 8 digits of The unique task ID" },
                        newDate: { type: "string", description: "The new due date to reschedule the corresponding task to in ISO format" }
                    }
                }
            }
        },
    });
    recordGeminiUsage(response);
    console.log(response)
    return response;
}