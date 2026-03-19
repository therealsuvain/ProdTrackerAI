import { ChatListItem, DaySeparatorItem } from '../types/chat';
import { Message } from '../types/chat';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) {
    return date.toLocaleDateString('en-IN', { weekday: 'long' }); // 'Monday', 'Tuesday'...
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined, // e.g. '12 Mar' or '12 Mar 2023'
  });
}

export function injectDaySeparators(messages: Message[]): ChatListItem[] {
  const result: ChatListItem[] = [];
  let lastDate: Date | null = null;
  let insertPosition = 0;
  for (const message of messages) {
    const msgDate = new Date(message.timestamp);

    if (lastDate && !isSameDay(lastDate, msgDate)) {
      const separator: DaySeparatorItem = {
        id: `separator-${msgDate.toDateString()}`,
        type: 'day_separator',
        date: msgDate,
      };
      result.push(separator);
      
    }
    lastDate = msgDate;
    result.push(message);
  }

  // The first/topmost day seperator has to be inserted explicilty here
  if (lastDate) {
      const separator: DaySeparatorItem = {
        id: `separator-${lastDate.toDateString()}`,
        type: 'day_separator',
        date: lastDate,
      };
      result.push(separator);
  }
  return result;
}