import { AvatarId } from "@/constants/avatars";

export interface SettingsConfig {
  avatarId:{ id:AvatarId, updatedAt:string}
  isDarkMode: boolean;
  isSystemTheme: boolean;
  hapticsEnabled: boolean;
  manualSyncEnabled: boolean;
  restoreRecovery: boolean;
  autoCloudSync: boolean;
  notificationEnabled: boolean //string | null; // e.g., "09:00" or null if disabled
  soundEffectsEnabled: boolean;
  resetAchievements: boolean;
  enableCloudSync: boolean;
  deleteProfile: boolean;
  deleteAllData: boolean;
  deleteTasks: boolean;
  deleteHabits: boolean;
  deleteEvents: boolean;
  deleteTimerLogs: boolean;
  editCategories: boolean
  editTags: boolean
  resetSettings: boolean

}

export const defaultSettings: SettingsConfig = {
  avatarId: {id: "avatar_1", updatedAt: ""},
  isDarkMode: true, // Assuming dark mode based on previous context
  isSystemTheme: true,
  hapticsEnabled: true,
  manualSyncEnabled: false,
  restoreRecovery: false,
  autoCloudSync: true,
  notificationEnabled: false,
  soundEffectsEnabled: true,
  resetAchievements: false,
  enableCloudSync: false,
  deleteProfile: false,
  deleteAllData: false,
  deleteTasks: false,
  deleteHabits: false,
  deleteEvents: false,
  deleteTimerLogs: false,
  editCategories: false,
  editTags: false,
  resetSettings: false
};
