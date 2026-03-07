export interface Task {
  id: string; // Use UUID or Date.now().toString() for uniqueness
  title: string;
  description?: string;
  category?: string;
  dueDate?: Date;
  reminder: boolean;
  reminderDate?: Date;
  notificationId?: string; // To track/cancel reminders
  priority: "low" | "medium" | "high";
  completed: boolean;
  tags?: string[];
  embedding?:number[]; // For Semantic Search
}
