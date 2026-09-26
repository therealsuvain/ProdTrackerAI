// stores/use-timer-log-store.ts
import { create } from "zustand";

import {
    countTimerLogs,
    deleteAllTimerLogs,
    deleteTimerLog,
    getAllTimerLogs,
    insertTimerLog,
    updateTimerLog,
} from "@/db/repositories/timer-log-repository";
import { TimerLog } from "@/types/timer";
import { getTodayISO, getWeekStartISO } from "@/utils/common-utils";

type LogStoreState = {
    logsById: Record<string, TimerLog>;
    loaded: boolean;
    refreshing: boolean;

    addLog: (log: TimerLog) => Promise<void>;
    editLog: (log: TimerLog) => Promise<void>;
    removeLog: (id: string) => Promise<void>;
    removeLogs: () => Promise<void>;

    reassignLogCategoryLocal: (oldCategoryId: string, newCategoryId: string) => void;
    reassignLogTagLocal: (oldTagId: string, newTagId: string | null) => void;

    logCount: () => Promise<number>;

    refreshLogs: () => Promise<Record<string, TimerLog>>;
};

const emptyLogsById = (): Record<string, TimerLog> => ({});

function normalizeLogs(logs: TimerLog[]): Record<string, TimerLog> {
    const logsById: Record<string, TimerLog> = {};
    for (const log of logs) logsById[log.id] = log;
    return logsById;
}

export const selectedDateLogIds = (state: LogStoreState, date: string): string[] => {
    return Object.values(state.logsById)
        .filter((log) => log.startTime.split("T")[0] === date)
        .map((log) => log.id);
};

export const timerLogStats = (state: LogStoreState) => {
    const logs = Object.values(state.logsById);
    const todayISO = getTodayISO();
    const weekStartISO = getWeekStartISO();

    let todayTotal = 0;
    let weekTotal = 0;
    const categoryTotals: Record<string, number> = {};
    for (const log of logs) {
        if (!log.duration) continue;
        const logDate = log.startTime.split("T")[0];
        if (logDate === todayISO) todayTotal += log.duration;
        if (logDate >= weekStartISO) {
            weekTotal += log.duration;
            if (log.category) {
                categoryTotals[log.category] =
                    (categoryTotals[log.category] ?? 0) + log.duration;
            }
        }
    }

    // Top category this week by total time
    const topCategoryId =
        Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    return { todayTotal, weekTotal, topCategoryId };
}


export const lastLogCategory = (state: LogStoreState) => {
    const logs = Object.values(state.logsById);
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].category) return logs[i].category!;
    }
    return undefined
}
export const useTimerLogStore = create<LogStoreState>((set, get) => {
    const pendingOpByLogId = new Map<string, symbol>();

    const applyOptimisticMutation = async (
        affectedIds: string[],
        optimisticUpdate: (logsById: Record<string, TimerLog>) => Record<string, TimerLog>,
        dbWrite: () => Promise<unknown>,
    ): Promise<void> => {
        const opId = Symbol();
        for (const id of affectedIds) pendingOpByLogId.set(id, opId);

        const previousById = get().logsById;
        set((state) => ({ logsById: optimisticUpdate(state.logsById) }));

        try {
            await dbWrite();
        } catch (error) {
            set((state) => {
                const next = { ...state.logsById };
                let rolledBackAny = false;
                for (const id of affectedIds) {
                    if (pendingOpByLogId.get(id) !== opId) continue;
                    if (previousById[id]) next[id] = previousById[id];
                    else delete next[id];
                    rolledBackAny = true;
                }
                return rolledBackAny ? { logsById: next } : state;
            });
            throw error;
        } finally {
            for (const id of affectedIds) {
                if (pendingOpByLogId.get(id) === opId) pendingOpByLogId.delete(id);
            }
        }
    };

    return {
        logsById: emptyLogsById(),
        loaded: false,
        refreshing: false,

        addLog: async (log) => {
            await applyOptimisticMutation(
                [log.id],
                (logsById) => (logsById[log.id] ? logsById : { [log.id]: log, ...logsById }),
                () => insertTimerLog(log),
            );
        },

        editLog: async (log) => {
            await applyOptimisticMutation(
                [log.id],
                (logsById) => (logsById[log.id] ? { ...logsById, [log.id]: log } : logsById),
                () => updateTimerLog(log),
            );
        },

        removeLog: async (id) => {
            await applyOptimisticMutation(
                [id],
                (logsById) => {
                    if (!logsById[id]) return logsById;
                    const next = { ...logsById };
                    delete next[id];
                    return next;
                },
                () => deleteTimerLog(id),
            );
        },

        removeLogs: async () => {
            await deleteAllTimerLogs();
            set({ logsById: emptyLogsById() });
        },

        reassignLogCategoryLocal: (oldCategoryId, newCategoryId) => {
            set((state) => {
                let changed = false;
                const next = { ...state.logsById };
                for (const id in next) {
                    const log = next[id];
                    if (log.category !== oldCategoryId) continue;
                    changed = true;
                    next[id] = { ...log, category: newCategoryId };
                }
                return changed ? { logsById: next } : state;
            });
        },

        reassignLogTagLocal: (oldTagId, newTagId) => {
            set((state) => {
                let changed = false;
                const next = { ...state.logsById };
                for (const id in next) {
                    const log = next[id];
                    if (!log.tags?.includes(oldTagId)) continue;
                    const nextTags = log.tags.filter((t) => t !== oldTagId);
                    if (newTagId && !nextTags.includes(newTagId)) nextTags.push(newTagId);
                    changed = true;
                    next[id] = { ...log, tags: nextTags };
                }
                return changed ? { logsById: next } : state;
            });
        },

        logCount: async () => (await countTimerLogs()) ?? 0,

        refreshLogs: async () => {
            set({ refreshing: true });
            try {
                const loadedLogs = await getAllTimerLogs();
                set({ logsById: normalizeLogs(loadedLogs), loaded: true });
                return get().logsById;
            } finally {
                set({ refreshing: false });
            }
        },
    };
});