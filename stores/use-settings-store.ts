import { create } from "zustand";

import { SettingsConfig, defaultSettings } from "@/types/settings";
import { loadSettings, saveSettings } from "@/utils/storage-utils";

type SettingsStoreState = {
    settings: SettingsConfig;
    updateSettings: (patch: Partial<SettingsConfig>) => void;
    resetSettings: () => void;
};

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
    // MMKV is synchronous, so the first render already sees persisted values.
    // Merging with defaults fills keys added after the user last saved.
    settings: { ...defaultSettings, ...loadSettings() },

    updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
        saveSettings(get().settings);
    },

    resetSettings: () => {
        set({ settings: { ...defaultSettings } });
        saveSettings(get().settings);
    },
}));