export interface AgentState {
    transcript: string;
    checklist: string[];
    selectedDomain: string;
    selectedTools: any[];
    chatHistory: any[];
    accumulatedConfirmationCalls: any[];
    finalTextResponse: string;
}