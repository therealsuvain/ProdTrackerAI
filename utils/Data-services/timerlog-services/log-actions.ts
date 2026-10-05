import { useTimerLogStore } from "@/stores/use-timerLog-store";
import { TimerLog } from "@/types/timer";
import { trackMetric } from "../analytics-services/metric-actions";

export async function addLogWithEffects(log: TimerLog, actor: 'user' | 'ai' = "user"): Promise<void> {
    await useTimerLogStore.getState().addLog(log);
    trackMetric(['logsAdded'], 1, actor);
    trackMetric(['timeTracked'], log.duration ?? 0, actor);
}

export async function editLogWithEffects(log: TimerLog, actor: 'user' | 'ai' = "user"): Promise<void> {
    await useTimerLogStore.getState().editLog(log);
    trackMetric(['logsEdited'], 1, actor);
}

export async function deleteLogWithEffects(id: string, actor: 'user' | 'ai' = "user"): Promise<void> {
    await useTimerLogStore.getState().removeLog(id);
    trackMetric(['logsDeleted'], 1, actor);
}

export async function deleteAllLogsWithEffects(actor: 'user' | 'ai' = "user"): Promise<void> {
    const logCount = Object.keys(useTimerLogStore.getState().logsById).length;
    await useTimerLogStore.getState().removeLogs();
    trackMetric(['logsDeleted'], logCount, actor);
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