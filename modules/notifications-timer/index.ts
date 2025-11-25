// Reexport the native module. On web, it will be resolved to NotificationsTimerModule.web.ts
// and on native platforms to NotificationsTimerModule.ts
export { default  } from './src/NotificationsTimerModule';
export { default as NotificationsTimerView } from './src/NotificationsTimerView';
export * from  './src/NotificationsTimer.types';
import { requireNativeModule } from 'expo-modules-core';

// Get reference to the native module
const NotificationsTimer = requireNativeModule('NotificationsTimer');


// JS Helper functions

export function showNotification(
  title: string, 
  startTimeMs: number, 
  isRunning: boolean, 
  pausedElapsedSecs: number
) {
  NotificationsTimer.showNotification(title, startTimeMs, isRunning, pausedElapsedSecs);
}

export function addTimerActionListener(
  onPause: () => void,
  onResume: () => void
) {
  NotificationsTimer.addListener('onPauseAction', onPause);
  NotificationsTimer.addListener('onResumeAction', onResume);
}

export function stopNativeTimer() {
  NotificationsTimer.stopNotification();
}
