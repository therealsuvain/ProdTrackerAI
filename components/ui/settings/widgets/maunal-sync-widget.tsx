import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useSync } from "@/context/SyncContext";
import el from "zod/v4/locales/el.cjs";
import { useWorkspaceSyncModeStore } from "@/utils/Account-utils/workspace-sync-mode-store";

const formatElapsed = (lastSyncedAt: string | null) => {
  if (!lastSyncedAt) return "Never";

  const elapsedMs = Date.now() - new Date(lastSyncedAt).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 1) return "Just Now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const getNextUpdateDelay = (lastSyncedAt: string | null) => {
  if (!lastSyncedAt) return null;

  const elapsedMs = Date.now() - new Date(lastSyncedAt).getTime();
  //console.log(elapsedMs);
  if (elapsedMs < 60 * 60_000) {
    // Update exactly when the minute count changes.
    return 60_000 - (elapsedMs % 60_000);
  }

  if (elapsedMs < 24 * 60 * 60_000) {
    // Update exactly when the hour count changes.
    return 60 * 60_000 - (elapsedMs % (60 * 60_000));
  }

  // Update exactly when the day count changes.
  return 24 * 60 * 60_000 - (elapsedMs % (24 * 60 * 60_000));
};

export const ManualSyncWidget = () => {
  const { lastSyncedAt, isSyncing } = useSync();
  const [elapsedText, setElapsedText] = useState(() =>
    formatElapsed(lastSyncedAt),
  );
  const [syncDots, setSyncDots] = useState(".");
  const workspaceSyncMode = useWorkspaceSyncModeStore((state) => state.mode);

  useEffect(() => {
    if (!isSyncing) {
      setSyncDots(".");
      return;
    }

    const interval = setInterval(() => {
      setSyncDots((prev) => {
        if (prev === "...") return ".";
        return prev + ".";
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isSyncing]);

  useEffect(() => {
    setElapsedText(formatElapsed(lastSyncedAt));

    const delay = getNextUpdateDelay(lastSyncedAt);

    if (delay == null) return;

    const timeout = setTimeout(() => {
      setElapsedText(formatElapsed(lastSyncedAt));
    }, delay);

    return () => clearTimeout(timeout);
  }, [lastSyncedAt, elapsedText]);
  if (lastSyncedAt === null && workspaceSyncMode !== "detached_pending_choice")
    return null;

  return (
    <View>
      <Text style={{ color: "#ffffff88" }}>
        {workspaceSyncMode === "detached_pending_choice" ? (
          <Text style={{ color: "#ff3a3a", fontStyle: "italic", fontSize: 10 }}>
            * Sync Paused — Local data won't be pushed until resolution
          </Text>
        ) : isSyncing ? (
          `Syncing${syncDots}`
        ) : (
          `Last Synced At: ${elapsedText}`
        )}
      </Text>
    </View>
  );
};
