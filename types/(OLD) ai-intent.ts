export type BaseIntent =
  | "add_task"
  | "edit_task"
  | "delete_task"
  | "complete_task"
  | "add_event"
  | "edit_event"
  | "delete_event"
  | "add_habit"
  | "edit_habit"
  | "delete_habit"
  | "checkin_habit"
  | "add_log"
  | "edit_log"
  | "delete_log";

export type ExtraIntent = "start_timer" | "stop_timer" | "search";

export type AIIntent =
  | SingleAIIntent
  | CompoundAIIntent;

export type SingleAIIntent = {
  intent: BaseIntent| ExtraIntent;
  params: Record<string, any>;
  searchQuery?: string;
};

export type CompoundAIIntent = {
  intent: "multi_action";
  actions: (Omit<SingleAIIntent, "intent"> & { intent: BaseIntent})[];
};