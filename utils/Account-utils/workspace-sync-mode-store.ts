import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "workspace_sync_mode";

export type WorkspaceSyncMode = "synced" | "detached_pending_choice";

type WorkspaceSyncModeStore = {
  mode: WorkspaceSyncMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: WorkspaceSyncMode) => Promise<void>;
};

export const useWorkspaceSyncModeStore = create<WorkspaceSyncModeStore>(
  (set, get) => ({
    mode: "synced",
    hydrated: false,

    hydrate: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({
        mode: stored === "detached_pending_choice" ? "detached_pending_choice" : "synced",
        hydrated: true,
      });
    },

    setMode: async (mode) => {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
      set({ mode });
    },
  }),
);

// Non-React callers (transition-coordinator.ts, etc.) use this directly —
// no hook, no component needed, still hits the same single store.
export function getWorkspaceSyncMode(): WorkspaceSyncMode {
  return useWorkspaceSyncModeStore.getState().mode;
}

export async function setWorkspaceSyncMode(mode: WorkspaceSyncMode): Promise<void> {
  await useWorkspaceSyncModeStore.getState().setMode(mode);
}