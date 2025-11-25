import * as React from 'react';

import { NotificationsTimerViewProps } from './NotificationsTimer.types';

export default function NotificationsTimerView(props: NotificationsTimerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
