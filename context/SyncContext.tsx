import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

import {
  clearSyncCursor,
  getSyncCursor,
  saveSyncCursor,
} from "@/db/repositories/sync-repository";
import { useAuth } from "@/context/AuthContext";
import {
  runFullSync,
  pullFromCloud,
  pushToCloud,
  runSelectiveNotificationReschedule,
} from "@/utils/Account-utils/sync-orchestrator";
import {
  replaceWorkspaceFromAccount,
  restoreRecoverySnapshotAsActiveWorkspace,
  mergeIntoAccount,
  discardAndReturnToAccount,
  replaceCloudWithLocal,
} from "@/utils/Account-utils/transition-coordinator";
import { getAllTasks } from "@/db/repositories/task-repository";
import { getAllHabits } from "@/db/repositories/habit-repository";
import { getAllCalendarEvents } from "@/db/repositories/event-repository";
import { useTasks } from "@/hooks/context-hooks/use-tasks";
import { useHabits } from "@/hooks/context-hooks/use-habits";
import { useEvents } from "@/hooks/context-hooks/use-events";
import { useLogs } from "@/hooks/context-hooks/use-logs";
import { useData } from "@/hooks/context-hooks/use-data";
import { loadSettings } from "@/utils/storage-utils";
import { Task } from "@/types/task";
import { Habit } from "@/types/habits";
import { CalendarEvent } from "@/types/calendar";
import { useWorkspaceSyncModeStore } from "@/utils/Account-utils/workspace-sync-mode-store";
import { useRecoveryConsumedStore } from "@/utils/Account-utils/snapshot-status-store";
import { usePendingNotificationsStore } from "@/utils/Account-utils/pending-notification-store";
import { NotificationRescheduleChoice } from "@/components/modal/notificaiton-reschedule-modal";

type SyncContextValue = {
  isSyncing: boolean;
  isSignInSyncCompleted: number;
  isReplacingWorkspace: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  syncNow: () => Promise<void>;
  restoreFromRecovery: (snapshotId: string) => Promise<void>;
  mergeRecoveryWithCloud: () => Promise<void>;
  discardRecovery: () => Promise<void>;
  replaceCloud: () => Promise<void>;
  setAutoSyncEnabled: (enabled: boolean) => void;
  notificationPromptData: {
    tasks: Task[];
    habits: Habit[];
    events: CalendarEvent[];
  } | null;
  showNotificationPrompt: boolean;
  dismissNotificationPrompt: () => void;
  submitNotificationReschedule: (
    choice: NotificationRescheduleChoice,
  ) => Promise<void>;
  loadAndReschduleNotifications: () => Promise<void>;
};

// TODO cloud data delteion otion in settings
// TODO local data deltetion option in settings without deleting cloud data
// TODO tag names unique issue, maybe can be psued and pulled that causes error, either ignore duplciate or silently
// TODO duplicate adds for habitAutoFrozen metric
// TODO a recovery snapshot is created even if there is not data
// TODO add a indicator that current data is jsut restored from a currently saved recovery snapshot
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const {
    userId,
    authLoaded,
    isAnonymous,
    consumePendingAccountTransition,
    session,
  } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cursorLoadedForUser, setCursorLoadedForUser] = useState<string | null>(
    null,
  );
  const [isReplacingWorkspace, setIsReplacingWorkspace] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  // SyncContext.tsx, alongside the other useState calls
  const [notificationPromptData, setNotificationPromptData] = useState<{
    tasks: Task[];
    habits: Habit[];
    events: CalendarEvent[];
  } | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isSignInSyncCompleted, setSignInSyncCompleted] = useState(0);
  const { refreshTasks } = useTasks();
  const { refreshHabits } = useHabits();
  const { refreshEvents } = useEvents();
  const { refreshLogs } = useLogs();
  const { refreshTagsCatsAchievements } = useData();
  // Inside SyncProvider — add this effect
  const prevUserIdRef = useRef<string | null>(null);
  const wasSignedOutRef = useRef<boolean>(true);

  //
  const lastPulledAtRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const refreshAllLocalState = useCallback(async () => {
    await refreshTagsCatsAchievements();
    await refreshTasks();
    await refreshHabits();
    await refreshEvents();
    await refreshLogs();
  }, [
    refreshTagsCatsAchievements,
    refreshTasks,
    refreshHabits,
    refreshEvents,
    refreshLogs,
  ]);
  const mode = useWorkspaceSyncModeStore((state) => state.mode);
  const setWorkspaceSyncMode = useWorkspaceSyncModeStore(
    (state) => state.setMode,
  );
  const markRecoveryConsumed = useRecoveryConsumedStore(
    (state) => state.markConsumed,
  );
  const setPendingNotifications = usePendingNotificationsStore(
    (state) => state.setPendingNotifications,
  );

  const clearPendingNotifications = usePendingNotificationsStore(
    (state) => state.clear,
  );

  const loadAndReschduleNotifications = useCallback(async () => {
    const [loadedTasks, loadedHabits, loadedEvents] = await Promise.all([
      getAllTasks(),
      getAllHabits(),
      getAllCalendarEvents(),
    ]);
    setNotificationPromptData({
      tasks: loadedTasks,
      habits: loadedHabits,
      events: loadedEvents,
    });
    setShowNotificationPrompt(true);
  }, []);

  const syncNow = useCallback(async () => {
    //console.log("[SyncProvider] Entered Syncer");
    if (!authLoaded || !userId || isAnonymous) return;

    if (mode === "detached_pending_choice") {
      console.log(
        "[SyncProvider] Skipping sync — workspace is pending a merge/replace decision.",
      );
      return;
    }
    console.log("[SyncProvider] Syncing now...");
    setIsSyncing(true);
    setSyncError(null);

    try {
      await runFullSync({
        userId,
        lastPulledAt: lastPulledAtRef.current,

        onPulled: async ({ tasks, habits, events }) => {
          const anyReminderBearing =
            tasks.some((t) => t.reminder) ||
            habits.some((h) => h.reminder) ||
            events.some((e) => e.reminder);
          if (anyReminderBearing) {
            setPendingNotifications(true);
          }
        },

        onSuccess: async (completedAt) => {
          lastPulledAtRef.current = completedAt;
          await saveSyncCursor(userId, completedAt);
          setLastSyncedAt(completedAt);
        },
      }).then(async () => {
        await refreshAllLocalState();
      });
      /*       console.log(
        "[SyncProvider] Sync complete. Refreshing local state...",
        lastPulledAtRef.current,
      ); */
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SyncProvider] Sync failed:", err);
      setSyncError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [authLoaded, userId, isAnonymous, mode]);

  const restoreFromRecovery = useCallback(
    async (snapshotId: string) => {
      setIsReplacingWorkspace(true);
      setSyncError(null);
      console.log("[SyncProvider] Restoring from snapshot:", snapshotId);
      try {
        await restoreRecoverySnapshotAsActiveWorkspace(snapshotId, "replace");

        if (userId && !isAnonymous) {
          await clearSyncCursor(userId);
          lastPulledAtRef.current = null;
          setWorkspaceSyncMode("detached_pending_choice");
        }

        await refreshAllLocalState();
        await loadAndReschduleNotifications();
        await refreshAllLocalState();

        markRecoveryConsumed(snapshotId, "Restored", new Date().toISOString());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[SyncProvider] Restore failed:", err);
        setSyncError(message);
        throw err;
      } finally {
        setIsReplacingWorkspace(false);
        console.log("[SyncProvider] Restored Finished");
      }
    },
    [userId, isAnonymous, refreshAllLocalState],
  );

  const mergeRecoveryWithCloud = useCallback(async () => {
    if (!authLoaded || !userId || isAnonymous) return;
    setIsReplacingWorkspace(true);
    setSyncError(null);
    setIsSyncing(true);

    try {
      await mergeIntoAccount({
        userId,
        pushLocalData: pushToCloud,
        pullAccountData: async () => {
          await pullFromCloud({
            userId,
            lastPulledAt: null,
            onPulled: async () => {},
            onSuccess: async (completedAt) => {
              lastPulledAtRef.current = completedAt;
              await saveSyncCursor(userId, completedAt);
              setLastSyncedAt(completedAt);
            },
          });
        },
        markRecoveryConsumed,
      });
      await refreshAllLocalState();
      //markRecoveryConsumed(snapshotId, "restored", new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SyncProvider] Merge failed:", err);
      setSyncError(message);
      throw err;
    } finally {
      setIsReplacingWorkspace(false);
      setIsSyncing(false);
    }
  }, [authLoaded, userId, isAnonymous, refreshAllLocalState]);

  const discardRecovery = useCallback(async () => {
    if (!authLoaded || !userId || isAnonymous) return;
    setIsReplacingWorkspace(true);
    setSyncError(null);
    try {
      await discardAndReturnToAccount({
        targetUserId: userId,
        pullAccountData: async () => {
          await pullFromCloud({
            userId,
            lastPulledAt: null,
            onPulled: async () => {},
            onSuccess: async (completedAt) => {
              lastPulledAtRef.current = completedAt;
              await saveSyncCursor(userId, completedAt);
              setLastSyncedAt(completedAt);
            },
          });
        },
      });
      await refreshAllLocalState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SyncProvider] Discard failed:", err);
      setSyncError(message);
      throw err;
    } finally {
      setIsReplacingWorkspace(false);
    }
  }, [authLoaded, userId, isAnonymous, refreshAllLocalState]);

  // Load the periodic-sync preference independently of SettingsContext.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const settings = await loadSettings();
      const enabled = settings.autoCloudSync;
      if (!cancelled) setAutoSyncEnabled(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceCloud = useCallback(async () => {
    if (!authLoaded || !userId || isAnonymous) return;
    setIsReplacingWorkspace(true);
    setSyncError(null);
    try {
      await replaceCloudWithLocal({
        userId,
        pushAllLocalData: async () => {
          await pushToCloud(userId);
        },
      });
      await refreshAllLocalState();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SyncProvider] Replace failed:", err);
      setSyncError(message);
      throw err;
    } finally {
      setIsReplacingWorkspace(false);
    }
  }, [authLoaded, userId, isAnonymous, refreshAllLocalState]);

  const dismissNotificationPrompt = useCallback(() => {
    setShowNotificationPrompt(false);
    setNotificationPromptData(null);
  }, []);

  const submitNotificationReschedule = useCallback(
    async (choice: NotificationRescheduleChoice) => {
      if (!notificationPromptData) return;
      await runSelectiveNotificationReschedule(notificationPromptData, choice);
      dismissNotificationPrompt();
      clearPendingNotifications();
    },
    [
      notificationPromptData,
      dismissNotificationPrompt,
      runSelectiveNotificationReschedule,
      clearPendingNotifications,
    ],
  );

  // Get sync cursor on initial render.
  useEffect(() => {
    if (!authLoaded || !userId || isAnonymous) {
      setCursorLoadedForUser(null);
      return;
    }
    setCursorLoadedForUser(null);
    lastPulledAtRef.current = null;

    let cancelled = false;

    void (async () => {
      const cursor = await getSyncCursor(userId);

      if (!cancelled) {
        lastPulledAtRef.current = cursor;
        setCursorLoadedForUser(userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoaded, userId, isAnonymous]);

  //update ref on sign out
  useEffect(() => {
    if (isAnonymous) {
      wasSignedOutRef.current = true;
      prevUserIdRef.current = null;
    }
  }, [isAnonymous]);

  // Event-triggered sync: app returns to foreground.
  useEffect(() => {
    //console.log("[EventSync] Enabled:", autoSyncEnabled);
    if (
      !authLoaded ||
      !userId ||
      isAnonymous ||
      cursorLoadedForUser !== userId ||
      !autoSyncEnabled
    )
      return;
    console.log("[EventSync]");
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackgrounded =
        appStateRef.current === "background" ||
        appStateRef.current === "inactive";

      appStateRef.current = nextState;

      if (nextState === "active" && wasBackgrounded) {
        void syncNow().catch(() => {
          // State is already recorded in syncError.
        });
        refreshAllLocalState();
      }
    });

    return () => subscription.remove();
  }, [authLoaded, userId, isAnonymous, syncNow]);

  // Periodic sync
  useEffect(() => {
    // console.log("[AutoSync] Enabled:", autoSyncEnabled);
    if (
      !authLoaded ||
      !userId ||
      isAnonymous ||
      cursorLoadedForUser !== userId ||
      !autoSyncEnabled
    )
      return;
    //console.log("[AutoSync]");
    const intervalId = setInterval(
      () => {
        void syncNow().catch(() => {});
        console.log("[AutoSync] Syncing now...");
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(intervalId);
  }, [authLoaded, userId, isAnonymous, syncNow, autoSyncEnabled]);

  // Sync on sign in
  useEffect(() => {
    if (!authLoaded || !userId || isAnonymous || cursorLoadedForUser !== userId)
      return;
    console.log("[SigninSync]");
    const justSignedIn =
      userId !== null &&
      (userId !== prevUserIdRef.current || wasSignedOutRef.current) &&
      !isAnonymous;

    prevUserIdRef.current = userId;
    wasSignedOutRef.current = false;
    if (!justSignedIn) return;
    //console.log("[SigninSync] Transition:");
    const transition = consumePendingAccountTransition();

    void (async () => {
      try {
        setIsSyncing(true);
        setSyncError(null);

        if (transition?.mode === "replace") {
          setIsReplacingWorkspace(true);
          await clearSyncCursor(userId);
          lastPulledAtRef.current = null;
          console.log("SYNC: replace start");
          await replaceWorkspaceFromAccount({
            targetUserId: userId,
            sourceUserId: transition.sourceUserId,
            sourceIsAnonymous: transition.sourceIsAnonymous,
            pullAccountData: async () => {
              await pullFromCloud({
                userId,
                lastPulledAt: null,
                onPulled: async ({ tasks, habits, events }) => {
                  if (
                    tasks.length > 0 ||
                    habits.length > 0 ||
                    events.length > 0
                  ) {
                    setNotificationPromptData({ tasks, habits, events });
                    setShowNotificationPrompt(true);
                  }
                },
                onSuccess: async (completedAt) => {
                  lastPulledAtRef.current = completedAt;
                  await saveSyncCursor(userId, completedAt);
                  setLastSyncedAt(completedAt);
                },
              });
            },
          });

          //console.log("SYNC: replace finished");
          await refreshAllLocalState();
          setWorkspaceSyncMode("synced");
          //console.log("SYNC: refreshAllLocalState finished");
          return;
        }

        // Merge or no explicit transition:
        lastPulledAtRef.current = null;
        console.log("SYNC: new start");
        await syncNow();
        await refreshAllLocalState();
        //console.log("SYNC: refreshAllLocalState finished");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        setSyncError(message);
      } finally {
        //console.log("SYNC: setting isSyncing false");
        setIsSyncing(false);
        setIsReplacingWorkspace(false);
        setSignInSyncCompleted((prev) => prev + 1);
      }
    })();
  }, [
    cursorLoadedForUser,
    consumePendingAccountTransition,
    userId,
    isAnonymous,
    authLoaded,
    syncNow,
    refreshAllLocalState,
  ]);

  return (
    <SyncContext.Provider
      value={{
        isSyncing,
        isSignInSyncCompleted,
        isReplacingWorkspace,
        lastSyncedAt,
        syncError,
        syncNow,
        restoreFromRecovery,
        mergeRecoveryWithCloud,
        discardRecovery,
        replaceCloud,
        setAutoSyncEnabled,
        notificationPromptData,
        showNotificationPrompt,
        dismissNotificationPrompt,
        submitNotificationReschedule,
        loadAndReschduleNotifications,
      }}
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
