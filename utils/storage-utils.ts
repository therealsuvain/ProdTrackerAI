import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsConfig, defaultSettings } from '@/types/settings';
import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'

const SETTINGS_KEY = '@prodtracker_settings';


export const loadSettings = (): SettingsConfig => {
  try {
    const jsonValue = storageMMKV.getString(SETTINGS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultSettings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = (settings: SettingsConfig): void => {
  try {
    const jsonValue = JSON.stringify(settings);
    storageMMKV.set(SETTINGS_KEY, jsonValue);
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

export const clearStorageByKey = (key: string) => {
  try {
    storageMMKV.remove(key);
    console.log("Cleared key:", key);
  } catch (e) {
    console.error('Error clearing metrics:', e);
  }
};

export const clearStorage =  () => {
  try {
    storageMMKV.clearAll();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
};