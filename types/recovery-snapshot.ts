export type RecoveryEntityType =
  | "task"
  | "habit"
  | "calendar_event"
  | "timer_log"
  | "category"
  | "tag"
  | "unlocked_achievement"
  | "global_metrics"
  | "daily_metrics"
  | "global_metrics_ai"
  | "daily_metrics_ai"
  | "achievement_global_metrics";

export type RecoveryItem = {
  entityType: RecoveryEntityType;
  entityId: string;
  payload: unknown;
};

export type RecoverySnapshotSummary = {
  id: string;
  createdAt: string;
  expiresAt: string;
  sourceUserId: string | null;
  sourceIsAnonymous: boolean;
  itemCount: number;
};