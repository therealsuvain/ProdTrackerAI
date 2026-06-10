// src/utils/GlobalErrorHandler.ts
import { Alert } from 'react-native';

let originalHandler: ((error: any, isFatal?: boolean) => void) | null = null;
let unhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

export const setupGlobalErrorHandler = () => {
  // Override RN's error handler
  originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => { // Fix: isFatal?: boolean (optional)
    console.error('Global Error:', error, isFatal);
    
    // Show user-friendly fallback
    Alert.alert(
      isFatal ? 'App Crashed' : 'Error Occurred',
      error.message || 'Something went wrong. Restarting...',
      [{ text: 'Restart', onPress: () => globalThis.location?.reload() }] // Web; use Expo restart for mobile
    );
    
    // Call original for dev tools
    originalHandler?.call(null, error, isFatal);
  });

  // Handle unhandled promise rejections (async errors)
  // Fix: Define handler as function, store reference, add listener (no saving 'original' property—invalid)
  unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
    event.preventDefault(); // Prevent default logging
    const error = event.reason;
    console.error('Unhandled Promise Rejection:', error);
    Alert.alert('Async Error', error.message || 'Promise failed unexpectedly.');
  };
  globalThis.addEventListener('unhandledrejection', unhandledRejectionHandler);
};

export const teardownGlobalErrorHandler = () => {
  if (originalHandler) {
    ErrorUtils.setGlobalHandler(originalHandler);
  }
  // Fix: Remove the stored handler
  if (unhandledRejectionHandler) {
    globalThis.removeEventListener('unhandledrejection', unhandledRejectionHandler);
  }
};