import { requireNativeView } from 'expo';
import * as React from 'react';

import { NotificationsTimerViewProps } from './NotificationsTimer.types';

const NativeView: React.ComponentType<NotificationsTimerViewProps> =
  requireNativeView('NotificationsTimer');

export default function NotificationsTimerView(props: NotificationsTimerViewProps) {
  return <NativeView {...props} />;
}
