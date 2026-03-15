import React, { createContext, useContext, useState, useEffect } from 'react';

import { SettingsConfig, defaultSettings } from '@/types/settings';
import { loadSettings, saveSettings } from '@/utils/storage-utils';

interface SettingsContextType {
  settings: SettingsConfig;
  updateSetting: <K extends keyof SettingsConfig>(key: K, value: SettingsConfig[K]) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettingsFromStorage = async () => {
      try {
        const storedSettings = await loadSettings();
        setSettings(storedSettings);
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettingsFromStorage();
  }, []);

  // Generic function that enforces strict type-checking based on the key
  const updateSetting = async <K extends keyof SettingsConfig>(key: K, value: SettingsConfig[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); // Optimistic UI update
    await saveSettings(newSettings); // Persist to storage
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};