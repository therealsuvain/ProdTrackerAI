import { SettingsConfig } from './settings';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

export type SettingInputType = 'toggle' | 'link' | 'action' | 'value-link'; // Expanded later for 'timepicker'

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