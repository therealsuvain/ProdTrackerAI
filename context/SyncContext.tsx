import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { runFullSync } from "@/utils/Account-utils/sync-orchestrator";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { useData } from "@/hooks/context-hooks/use-data";

type SyncContextValue = {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { userId, authLoaded, isAnonymous } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { refreshTasks } = useTasks();
  const { refreshHabits } = useHabits();
  const { refreshEvents } = useEvents();
  const { refreshLogs } = useLogs();
  const { refreshTagsCatsAchievements } = useData();
  // Inside SyncProvider — add this effect
  const prevUserIdRef = useRef<string | null>(null);

  const lastPulledAtRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const syncNow = useCallback(async () => {
    console.log("[SyncProvider] Entered Syncer");
    if (!authLoaded || !userId || isAnonymous) return;
    console.log("[SyncProvider] Syncing now...");
    setIsSyncing(true);
    setSyncError(null);

    try {
      await runFullSync({
        userId,
        lastPulledAt: lastPulledAtRef.current,

        onPulled: async ({ tasks, habits, events }) => {
          // Later: refresh provider state and notification reconciliation.
          // Keep this callback here because SyncProvider is the coordinator.
          void tasks;
          void habits;
          void events;
        },

        onSuccess: (completedAt) => {
          lastPulledAtRef.current = completedAt;
          setLastSyncedAt(completedAt);
        },
      });
      console.log(
        "[SyncProvider] Sync complete. Refreshing local state...",
        lastPulledAtRef.current,
      );
      refreshTagsCatsAchievements();
      refreshTasks();
      refreshHabits();
      refreshEvents();
      refreshLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SyncProvider] Sync failed:", err);
      setSyncError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [authLoaded, userId, isAnonymous]);

  // Event-triggered sync: app returns to foreground.
  useEffect(() => {
    if (!authLoaded || !userId || isAnonymous) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackgrounded =
        appStateRef.current === "background" ||
        appStateRef.current === "inactive";

      appStateRef.current = nextState;

      if (nextState === "active" && wasBackgrounded) {
        void syncNow().catch(() => {
          // State is already recorded in syncError.
        });
        refreshTagsCatsAchievements();
        refreshTasks();
        refreshHabits();
        refreshEvents();
        refreshLogs();
      }
    });

    return () => subscription.remove();
  }, [authLoaded, userId, isAnonymous, syncNow]);

  // Periodic sync: every five minutes while the provider is mounted.
  useEffect(() => {
    if (!authLoaded || !userId || isAnonymous) return;

    const intervalId = setInterval(
      () => {
        void syncNow().catch(() => {});
        console.log("[AutoSync] Syncing now...");
      },
      10 * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [authLoaded, userId, isAnonymous, syncNow]);

  useEffect(() => {
    if (!authLoaded) return;

    const justSignedIn =
      userId !== null && userId !== prevUserIdRef.current && !isAnonymous;

    prevUserIdRef.current = userId;

    if (justSignedIn) {
      void syncNow().catch(() => {
        // error already recorded in syncError
      });
    }
  }, [userId, isAnonymous, authLoaded, syncNow]);

  return (
    <SyncContext.Provider
      value={{ isSyncing, lastSyncedAt, syncError, syncNow }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return context;
}
