export interface TimerLog {
  id: string;
  title: string; // e.g., "Workout"
  startTime: string;
  endTime?: string;
  duration?: number; // In seconds
  category?:string;
  tags?: string[];
  laps?: number[];
  isPartial?: boolean;
   // ── Audit fields ──────────────────────────────────────────────────────────
  createdAt: string;                 // ISO 8601 — when record entered the DB
  updatedAt: string;                 // ISO 8601 — updated if user edits the log
}