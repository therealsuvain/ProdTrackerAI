export interface Task {
  id: string; // Use UUID or Date.now().toString() for uniqueness
  title: string;
  description?: string;
  category?: string;
  dueDate: string;
  reminder: boolean;
  reminderDate?: string;
  notificationId?: string; // To track/cancel reminders
  priority: "low" | "medium" | "high";
  completed: boolean;
  tags?: string[];
  embedding?:number[]; // For Semantic Search
}
