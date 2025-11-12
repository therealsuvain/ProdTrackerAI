export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date ;
  startTime: Date;
  endTime: Date ;
  description?: string ;
  reminder: boolean; // For notifications
  recurrence: 'none'|'daily'|'weekly'  //  For repeating events
  notificationIds?: {date: string, id:string}[]; // To track/cancel reminders
  category?: string  // e.g., 'work', 'personal' for colors
  deletedOccurrences?: string[]; // To track deleted instances in recurring events
}

