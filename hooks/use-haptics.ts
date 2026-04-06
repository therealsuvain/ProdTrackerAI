import * as Haptics from 'expo-haptics';
import { useSettings } from '../context/SettingsContext';
import { useCallback } from 'react';

//TODO Diff Haptic modes for different functions
export const useHaptics = () => {
  const { settings } = useSettings();

  const triggerHaptic = useCallback(
    async (style:  Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Soft) => {
      let hapticMode;
      /* switch (style) {
        case
      } */
      // The engine silently intercepts the call and does nothing if the user disabled it
      if (settings.hapticsEnabled) {
        try {
          //TODO impactAsync doesnt work with my phone with Android 10, custom One Plus OS - Oxygen OS
          //TODO will have to be curated for iOS too
          await Haptics.impactAsync(style);
          //await Haptics.impactAsync(style);
          //await Haptics.selectionAsync();
          //await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          //await Haptics.performAndroidHapticsAsync(style)
          //console.log("VIBRATE");
        } catch (e) {
          console.log("Haptics failed:", e);
        }
      }
    },
    [settings.hapticsEnabled]
  );

  return { triggerHaptic };
};