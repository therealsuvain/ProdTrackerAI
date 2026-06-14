export interface AgentState {
    transcript: string;
    checklist: ChecklistItem[];
    selectedDomain: string;
    selectedTools: any[];
    chatHistory: any[];
    pendingTurnPayload: any[];
    toolResponses: any[];
    accumulatedConfirmationCalls: any[];
    finalTextResponse: string;
}

export interface ChecklistItem {
    id: string;
    intent: string;
    status: "PENDING" | "COMPLETED";
}

export interface ExecutionSummary {
    tasksCreated: string[];
    habitsCreated: string[];
    categoriesCreated: string[];
    tagsCreated: string[];
    inquiriesHandled: boolean;
    // Extensible for future entities:
    // eventsCreated: string[];
    // itemsDeleted: string[];
}