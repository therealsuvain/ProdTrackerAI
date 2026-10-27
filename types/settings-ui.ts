import { SettingsConfig } from './settings';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

export type SettingInputType = 'toggle' | 'link' | 'action' | 'value-link' | 'custom'; // Expanded later for 'timepicker'

export interface SettingOption {
  type: 'widget' | 'radio' | 'dropdown';
  value: string | number | boolean;
}
export interface SettingItem {
  id: keyof SettingsConfig;
  label: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialIcons.glyphMap | keyof typeof FontAwesome6.glyphMap;
  type: SettingInputType;
  destructive?: boolean;       // If true, renders the text/icon in theme.colors.error
  options?: SettingOption[];   // Reserved for future inline radio/dropdown implementations
  href?: string;               // Optional: The Expo Router path for 'link' types
}

export interface SettingsSection {
  title: string;
  data: SettingItem[];
}

export const SETTINGS_LAYOUT: SettingsSection[] = [
  {
    title: "Profile",
    data: [
      /*    {
           id: "soundEffectsEnabled",
           label: "ADMIN Mode",
           icon: "key",
           type: "link",
         }, */
      {
        id: "deleteProfile",
        label: "Delete Profle",
        icon: "trash",
        type: "link",
      },
      {
        id: "manualSyncEnabled",
        label: "Sync Now",
        icon: "cloud-upload-outline",
        type: "action",
        options: [
          {
            type: "widget",
            value: "ManualSyncWidget",
          },
        ],
      },
      {
        id: "restoreRecovery",
        label: "Restore Old Data",
        icon: "restore",
        type: "action",
        options: [
          {
            type: "widget",
            value: "RestoreRecoveryWidget",
          },
        ],
      },
      {
        id: "autoCloudSync",
        label: "Auto Cloud Sync",
        icon: "cloud-sync",
        type: "toggle",
      },
    ],
  },
  {
    title: "Appearance",
    data: [
      {
        id: "isSystemTheme",
        label: "Match System Theme",
        icon: "phonelink-setup",
        type: "toggle",
      },
      { id: "isDarkMode", label: "Dark Mode", icon: "moon", type: "toggle" },
    ],
  },
  {
    title: "Sound",
    data: [
      {
        id: "hapticsEnabled",
        label: "Haptic Feedback",
        icon: "vibration",
        type: "toggle",
      },
      {
        id: "soundEffectsEnabled",
        label: "Sound Effects",
        icon: "volume-high",
        type: "toggle",
      },
    ],
  },
  {
    title: "Data Mangement",
    data: [
      {
        id: "deleteAllData",
        label: "Delete All Data",
        icon: "folder-delete",
        type: "link",
        href: "/settings/data-management",
      },
      {
        id: "editCategories",
        label: "Categories Management",
        icon: "category",
        type: "link",
        options: [
          {
            type: "widget",
            value: "CategoryWidget",
          },
        ],
        href: "/settings/category/category-settings",
      },
      {
        id: "editTags",
        label: "Tags Management",
        icon: "pricetags-sharp",
        type: "link",
        options: [
          {
            type: "widget",
            value: "TagsWidget",
          },
        ],
        href: "/settings/tags/tags-settings",
      },
      {
        id: "resetAchievements",
        label: "Reset Achievements",
        icon: "trophy",
        type: "link",
      },
      {
        id: "resetSettings",
        label: "Reset to default settings",
        icon: "settings-backup-restore",
        type: "action",
      },
    ],
  },
];
