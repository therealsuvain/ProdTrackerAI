import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { TimerLog } from "@/types/timer";

export async function addLogWithEffects(log: TimerLog): Promise<void> {
    await useTimerLogStore.getState().addLog(log);
}

export async function editLogWithEffects(log: TimerLog): Promise<void> {
    await useTimerLogStore.getState().editLog(log);
}

export async function deleteLogWithEffects(id: string): Promise<void> {
    await useTimerLogStore.getState().removeLog(id);
}

export async function deleteAllLogsWithEffects(): Promise<void> {
    await useTimerLogStore.getState().removeLogs();
}

export function reassignLogCategoryWithEffects(oldCategoryId: string, newCategoryId: string): void {
    useTimerLogStore.getState().reassignLogCategoryLocal(oldCategoryId, newCategoryId);
}

export function reassignLogTagWithEffects(oldTagId: string, newTagId: string | null): void {
    useTimerLogStore.getState().reassignLogTagLocal(oldTagId, newTagId);
}

export async function logCountWithEffects(): Promise<number> {
    return useTimerLogStore.getState().logCount();
}

export async function refreshLogsWithEffects(): Promise<Record<string, TimerLog>> {
    return useTimerLogStore.getState().refreshLogs();
}