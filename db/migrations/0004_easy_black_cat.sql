CREATE TABLE `achievement_global_metrics` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`tasks_completed` integer DEFAULT 0 NOT NULL,
	`tasks_missed` integer DEFAULT 0 NOT NULL,
	`habits_checked_in` integer DEFAULT 0 NOT NULL,
	`habits_goals_completed` integer DEFAULT 0 NOT NULL,
	`habit_check_ins_missed` integer DEFAULT 0 NOT NULL,
	`habits_streak_max` integer DEFAULT 0 NOT NULL,
	`habits_frozen` integer DEFAULT 0 NOT NULL,
	`habits_auto_frozen` integer DEFAULT 0 NOT NULL,
	`time_tracked` integer DEFAULT 0 NOT NULL,
	`chat_messages_sent` integer DEFAULT 0 NOT NULL,
	`chat_actions_confirmed` integer DEFAULT 0 NOT NULL,
	`chat_actions_expired` integer DEFAULT 0 NOT NULL,
	`chat_actions_cancelled` integer DEFAULT 0 NOT NULL,
	`last_synced_at` text
);
