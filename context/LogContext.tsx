import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import {
  getAllTimerLogs,
  insertTimerLog,
  updateTimerLog,
  deleteTimerLog,
  deleteAllTimerLogs,
  countTimerLogs,
} from "@/db/repositories/timer-log-repository";

import { TimerLog } from "@/types/timer";
import { useData } from "@/hooks/context-hooks/use-data";

interface LogContextType {
  timerLogs: TimerLog[];
  setTimerLogs: React.Dispatch<React.SetStateAction<TimerLog[]>>;
  addLog: (log: TimerLog) => Promise<void>;
  editLog: (log: TimerLog) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  removeLogs: () => Promise<void>;
  reassignLogCategoryLocal: (oldId: string, newId: string) => void;
  reassignLogTagLocal: (oldId: string, newId: string) => void;
  logCount: () => Promise<number>;
  refreshLogs: () => void;
}

export const LogContext = createContext<LogContextType | undefined>(undefined);

export default function LogProvider({ children }: { children: ReactNode }) {
  const { dispatchError } = useData();
  const [timerLogs, setTimerLogs] = useState<TimerLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const optimisticTimerLogMutation = useCallback(
    async (
      optimisticUpdate: (prev: TimerLog[]) => TimerLog[],
      dbWrite: () => Promise<void> | Promise<TimerLog>,
    ): Promise<void> => {
      // 1. Snapshot
      let snapshot: TimerLog[] = [];
      setTimerLogs((prev) => {
        snapshot = prev;
        return prev;
      });

      // 2. Optimistic update
      setTimerLogs(optimisticUpdate);

      // 3. DB write
      try {
        await dbWrite();
      } catch (err) {
        // 4. Rollback
        console.error(
          "[LogContext] TimerLog DB write failed, rolling back:",
          err,
        );
        setTimerLogs(snapshot);
        throw err; // caller catches this and shows DbErrorToast
      }
    },
    [],
  );

  const addLog = useCallback(
    async (log: TimerLog): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => [log, ...prev],
        () => insertTimerLog(log),
      );
    },
    [optimisticTimerLogMutation],
  );

  const editLog = useCallback(
    async (log: TimerLog): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => prev.map((e) => (e.id === log.id ? log : e)),
        () => updateTimerLog(log),
      );
    },
    [optimisticTimerLogMutation],
  );

  const removeLog = useCallback(
    async (id: string): Promise<void> => {
      await optimisticTimerLogMutation(
        (prev) => prev.filter((e) => e.id !== id),
        () => deleteTimerLog(id),
      );
    },
    [optimisticTimerLogMutation],
  );

  const removeLogs = useCallback(async () => {
    await deleteAllTimerLogs();
    setTimerLogs([]);
  }, []);

  const logCount = useCallback(async (): Promise<number> => {
    const result = await countTimerLogs();
    return result ?? 0;
  }, []);

  const reassignLogCategoryLocal = useCallback(
    (oldCategoryId: string, newCategoryId: string): void => {
      setTimerLogs((prev) =>
        prev.map((l) =>
          l.category === oldCategoryId
            ? {
                ...l,
                category: newCategoryId,
              }
            : l,
        ),
      );
    },
    [],
  );
  const reassignLogTagLocal = useCallback(
    (oldTagId: string, newTagId: string | null): void => {
      setTimerLogs((prev) =>
        prev.map((l) => {
          // If the task doesn'l have the old tag, return it untouched
          if (!l.tags?.includes(oldTagId)) return l;

          // Remove the old tag
          const filteredTags = l.tags.filter((id) => id !== oldTagId);

          // Add new tag securely
          if (newTagId && !filteredTags.includes(newTagId)) {
            filteredTags.push(newTagId);
          }

          return { ...l, tags: filteredTags };
        }),
      );
    },
    [],
  );
  const refreshLogs = useCallback(async () => {
    try {
      let loadedLogs = await getAllTimerLogs();
      setTimerLogs(loadedLogs);
    } catch (err) {
      console.error("[LogContext] Failed to initialise database:", err);
      dispatchError(
        `Failed to initialise database: ${err instanceof Error ? err.message : String(err)}`,
        "fatal",
      );
    } finally {
      setLoaded(true);
    }
  }, [dispatchError]);
  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <LogContext.Provider
      value={{
        timerLogs,
        setTimerLogs,
        addLog,
        editLog,
        removeLog,
        removeLogs,
        reassignLogCategoryLocal,
        reassignLogTagLocal,
        logCount,
        refreshLogs,
      }}
    >
      {children}
    </LogContext.Provider>
  );
}
