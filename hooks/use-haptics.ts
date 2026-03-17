import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';
import { useCallback } from 'react';

export const useHaptics = () => {
  const { settings } = useSettings();

  const triggerHaptic = useCallback(
    async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
      // The engine silently intercepts the call and does nothing if the user disabled it
      if (settings.hapticsEnabled) {
        try {
          //await Haptics.impactAsync(style);
          await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
          console.log("VIBRATE");
        } catch (e) {
          console.log("Haptics failed:", e);
        }
      }
    },
    [settings.hapticsEnabled]
  );

  return { triggerHaptic };
};