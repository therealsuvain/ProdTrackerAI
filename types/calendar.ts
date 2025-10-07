export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
  reminder?: boolean; // For notifications
}

