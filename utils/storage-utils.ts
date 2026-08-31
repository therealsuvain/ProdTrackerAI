// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SettingsConfig, defaultSettings } from '@/types/settings';

const SETTINGS_KEY = '@prodtracker_settings';
const SYNC_MODE_KEY = "workspace_sync_mode";

export const loadSettings = async (): Promise<SettingsConfig> => {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultSettings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = async (settings: SettingsConfig): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

export const clearStorageByKey = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    console.log("Cleared key:", key);
  } catch (e) {
    console.error('Error clearing metrics:', e);
  }
};

export const clearStorage = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
};