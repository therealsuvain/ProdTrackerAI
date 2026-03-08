import { SettingsConfig } from './settings';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

export type SettingInputType = 'toggle' | 'link'; // Expanded later for 'timepicker'

export interface SettingItem {
  id: keyof SettingsConfig; 
  label: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialIcons.glyphMap;
  type: SettingInputType;
}

export interface SettingsSection {
  title: string;
  data: SettingItem[];
}