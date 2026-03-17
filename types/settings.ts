export interface SettingsConfig {
  isDarkMode: boolean;
  hapticsEnabled: boolean;
  notificationEnabled: boolean //string | null; // e.g., "09:00" or null if disabled
  soundEffectsEnabled: boolean;
  resetAchievements : boolean;
  enableCloudSync: boolean;
  deleteProfile: boolean;
  deleteAllData: boolean;
  deleteTasks: boolean;
  deleteHabits: boolean;
  deleteEvents: boolean;
  deleteTimerLogs: boolean;

}

export const defaultSettings: SettingsConfig = {
  isDarkMode: true, // Assuming dark mode based on previous context
  hapticsEnabled: true,
  notificationEnabled: false,
  soundEffectsEnabled: true,
  resetAchievements: false,
  enableCloudSync: false,
  deleteProfile: false,
  deleteAllData: false,
  deleteTasks: false,
  deleteHabits: false,
  deleteEvents: false,
  deleteTimerLogs: false
};
