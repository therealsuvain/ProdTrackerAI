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
  // ── Audit fields ──────────────────────────────────────────────────────────
  createdAt: string;                 // ISO 8601 — set once, never mutated
  updatedAt: string;                 // ISO 8601 — updated on every save
  completedAt?: string;              // ISO 8601 — set when completed, cleared on un-complete
  embedding?:number[]; // For Semantic Search
}
