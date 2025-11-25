import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './NotificationsTimer.types';

type NotificationsTimerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class NotificationsTimerModule extends NativeModule<NotificationsTimerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(NotificationsTimerModule, 'NotificationsTimerModule');
