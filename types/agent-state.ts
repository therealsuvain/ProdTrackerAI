export interface AgentState {
    // --- EPHEMERAL STATE (Wiped on Rewind) ---
    transcript: string;
    checklist: ChecklistItem[];
    selectedDomain: string;
    selectedTools: any[];
    chatHistory: any[];
    pendingTurnPayload: any[];
    toolResponses: any[];
    finalTextResponse: string;
    // --- PERSISTENT STATE (Carried across Rewinds) ---
    isRewind: boolean;
    executedActionsLog: any[]; // Used by executeWithRetry to block duplicates
    accumulatedConfirmationCalls: any[]; // So we don't lose tasks we successfully built BEFORE the rewind

}

export interface ChecklistItem {
    id: string;
    intent: string;
    status: "PENDING" | "COMPLETED";
}

/* export interface ExecutionSummary {
    tasksCreated: string[];
    habitsCreated: string[];
    categoriesCreated: string[];
    tagsCreated: string[];
    inquiriesHandled: boolean;
    // Extensible for future entities:
    // eventsCreated: string[];
    // itemsDeleted: string[];
} */

export interface ExecutionSummary {
    mutations: { tool: string; args: any }[];
    inquiriesHandled: boolean;
}


export interface GatekeeperOutput {
    route: 'chat' | 'agent';
    chatResponse?: string;
}

