import { NativeModule, requireNativeModule } from 'expo';

import { NotificationsTimerModuleEvents } from './NotificationsTimer.types';

declare class NotificationsTimerModule extends NativeModule<NotificationsTimerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<NotificationsTimerModule>('NotificationsTimer');
