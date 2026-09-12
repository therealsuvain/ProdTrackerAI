import { create } from "zustand";
import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'


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
      const stored = storageMMKV.getString(STORAGE_KEYS.WORKSPACE_SYNC_MODE);
      set({
        mode: stored === "detached_pending_choice" ? "detached_pending_choice" : "synced",
        hydrated: true,
      });
    },

    setMode: async (mode) => {
      storageMMKV.set(STORAGE_KEYS.WORKSPACE_SYNC_MODE, mode);
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