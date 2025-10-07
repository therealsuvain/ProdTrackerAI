export interface Task {
  id: string; // Use UUID or Date.now().toString() for uniqueness
  title: string;
  description?: string;
  category?: string;
  dueDate?: Date;
  priority: "low" | "medium" | "high";
  completed: boolean;
  tags?: string[];
}
