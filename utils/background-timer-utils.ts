// src/services/background-timer-service.ts
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_TASK_NAME = 'BACKGROUND_TIMER_TASK';
const TIMER_STORAGE_KEY = 'timer_state';

export interface TimerState {
  isRunning: boolean;
  startTime: number | null; // timestamp
  pausedTime: number; // accumulated seconds
  title: string;
  lastUpdate: number; // timestamp
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner:true,
    shouldShowList:true,
  }),
});

// Save timer state to persistent storage
export const saveTimerState = async (state: TimerState): Promise<void> => {
  try {
    await AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save timer state:', error);
  }
};

// Load timer state from persistent storage
export const loadTimerState = async (): Promise<TimerState | null> => {
  try {
    const json = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Failed to load timer state:', error);
    return null;
  }
};

// Calculate current elapsed time
export const calculateElapsedTime = (state: TimerState): number => {
  if (!state.isRunning || !state.startTime) {
    return state.pausedTime;
  }
  const now = Date.now();
  const runningSinceStart = Math.floor((now - state.startTime) / 1000);
  return state.pausedTime + runningSinceStart;
};

// Format time as HH:MM:SS
export const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Create or update the notification
export const updateTimerNotification = async (
  state: TimerState
): Promise<string | undefined> => {
  try {
    const elapsed = calculateElapsedTime(state);
    const timeString = formatTime(elapsed);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: state.title || 'Timer Running',
        body: timeString,
        data: { type: 'timer' },
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'timer',
      },
      trigger: null, // Show immediately
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to update notification:', error);
    return undefined;
  }
};

// Cancel the timer notification
export const cancelTimerNotification = async (): Promise<void> => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
};

// Setup notification categories with actions
export const setupNotificationCategories = async (): Promise<void> => {
  try {
    await Notifications.setNotificationCategoryAsync('timer', [
      {
        identifier: 'pause',
        buttonTitle: '⏸ Pause',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'resume',
        buttonTitle: '▶ Resume',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹ Stop',
        options: {
          opensAppToForeground: true,
          isDestructive: true,
        },
      },
    ]);
  } catch (error) {
    console.error('Failed to setup notification categories:', error);
  }
};

// Handle notification responses (button presses)
export const handleNotificationResponse = async (
  response: Notifications.NotificationResponse,
  onPause: () => void,
  onResume: () => void,
  onStop: () => void
): Promise<void> => {
  const actionIdentifier = response.actionIdentifier;

  switch (actionIdentifier) {
    case 'pause':
      onPause();
      break;
    case 'resume':
      onResume();
      break;
    case 'stop':
      onStop();
      break;
    default:
      break;
  }
};

// Define the background task using expo-task-manager
// This task will update the notification while the app is in background
TaskManager.defineTask(TIMER_TASK_NAME, async () => {
  try {
    const state = await loadTimerState();
    
    if (state && state.isRunning) {
      await updateTimerNotification(state);
      return 1 ;
    }
    
    return 2;
  } catch (error) {
    console.error('Background task error:', error);
    return 2;
  }
});

// Note: For continuous background updates, you would typically use:
// - expo-background-fetch (deprecated, but used for periodic tasks)
// - expo-task-manager alone (for one-time tasks)
// 
// For a timer, the recommended approach is:
// 1. Use timestamp-based calculation (not interval-based)
// 2. Update notification when app state changes
// 3. Recalculate elapsed time when app returns to foreground
//
// True background execution is limited on mobile for battery reasons.
// The simple approach in TimerContext-Simple.tsx is recommended.