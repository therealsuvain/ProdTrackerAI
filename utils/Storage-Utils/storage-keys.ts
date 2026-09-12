export const STORAGE_KEYS = {
  THEME: "@app:theme",
  COLOR_CACHE: "@prodtracker_recent_colors",
  TIMER: "timer_data",
  SETTINGS: "@prodtracker_settings",           // confirm actual existing key name in storage-utils.ts
  TOKEN_USAGE: "usage:tokensUsedToday",
  TOKEN_USAGE_DATE: "usage:tokensUsedDate",
  TOKEN_MONITOR: "AI_TOKEN_MONITOR_STATS",     // confirm actual existing key name in ai-token-monitor
  AI_UNDO_STACK: "ai_action_undo_stack",       // confirm actual existing key name in ai-action-undo-handlers
  WORKSPACE_SYNC_MODE: "workspace_sync_mode",  // confirm actual existing key name in the zustand store
  CHART_LAYOUT: 'analytics_dashboard_layout',
} as const;