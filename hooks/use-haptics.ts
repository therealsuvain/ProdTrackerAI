import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { useSettingsStore } from '@/stores/use-settings-store';


export const useHaptics = () => {
  const hapticsEnabled = useSettingsStore((s) => s.settings.hapticsEnabled)

  const triggerHaptic = useCallback(
    async (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Soft) => {
      let hapticMode;
      /* switch (style) {
        case
      } */
      // The engine silently intercepts the call and does nothing if the user disabled it
      if (hapticsEnabled) {
        try {
          //Note impactAsync doesnt work with my phone with Android 10, custom One Plus OS - Oxygen OS
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
    [hapticsEnabled]
  );

  return { triggerHaptic };
};