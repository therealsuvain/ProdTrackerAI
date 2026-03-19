export interface Message {
  id: string;
  sender: 'user' | 'ai';
  type: 'text' | 'loading' | 'action';
  text: string;
  timestamp: Date;
  pendingActions?: any[]; // Stores functionCalls for 'ACTION_REQUIRED' bubbles
  isConfirmed?: boolean; // Tracks if the action was already processed
  isExpired?:boolean;
}
export interface DaySeparatorItem {
  id: string;
  type: 'day_separator';
  date: Date;
}

export type ChatListItem = Message | DaySeparatorItem;