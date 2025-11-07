export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date ;
  startTime: Date;
  endTime: Date ;
  description: string | undefined;
  reminder: boolean; // For notifications
  recurrence: string | undefined; //  For repeating events
  notificationId: string | undefined; // To track/cancel reminders
  category: string | undefined; // e.g., 'work', 'personal' for colors
}

