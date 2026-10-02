import { useSettingsStore } from "@/stores/use-settings-store";
import { SettingsConfig } from "@/types/settings";

export function updateSettingWithEffects<K extends keyof SettingsConfig>(
    key: K,
    value: SettingsConfig[K],
): void {
    const patch: Partial<SettingsConfig> = { [key]: value };

    // Preserved from the old SettingsContext: toggling system theme also reset
    // the stored isDarkMode to true. This is settings data only, so it lives here.
    if (key === "isSystemTheme") {
        patch.isDarkMode = true;
    }

    useSettingsStore.getState().updateSettings(patch);
}

export function resetSettingsWithEffects(): void {
    useSettingsStore.getState().resetSettings();
}