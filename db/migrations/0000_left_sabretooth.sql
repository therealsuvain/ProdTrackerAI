CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`is_all_day` integer DEFAULT false NOT NULL,
	`recurrence` text,
	`color` text,
	`location` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `calendar_events_start_date_idx` ON `calendar_events` (`start_date`);--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`date` text PRIMARY KEY NOT NULL,
	`tasks_completed` integer DEFAULT 0 NOT NULL,
	`habits_checked_in` integer DEFAULT 0 NOT NULL,
	`habits_goals_completed` integer DEFAULT 0 NOT NULL,
	`habits_streak_max` integer DEFAULT 0 NOT NULL,
	`habits_frozen` integer DEFAULT 0 NOT NULL,
	`time_tracked` integer DEFAULT 0 NOT NULL,
	`chat_messages_sent` integer DEFAULT 0 NOT NULL,
	`chat_actions_confirmed` integer DEFAULT 0 NOT NULL,
	`chat_actions_expired` integer DEFAULT 0 NOT NULL,
	`chat_actions_cancelled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_deleted_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `calendar_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_deleted_occurrences_event_idx` ON `event_deleted_occurrences` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_notification_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `calendar_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_notification_ids_event_idx` ON `event_notification_ids` (`event_id`);--> statement-breakpoint
CREATE TABLE `global_metrics` (
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
	`chat_actions_cancelled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `habit_check_ins` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_check_ins_habit_date_idx` ON `habit_check_ins` (`habit_id`,`date`);--> statement-breakpoint
CREATE TABLE `habit_freeze_history` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_freeze_history_habit_idx` ON `habit_freeze_history` (`habit_id`);--> statement-breakpoint
CREATE TABLE `habit_goal_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`goal` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_goal_completions_habit_idx` ON `habit_goal_completions` (`habit_id`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`reminder` integer DEFAULT false NOT NULL,
	`reminder_date` integer,
	`target_days` text,
	`streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`streak_freezes` integer DEFAULT 1 NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`goal` integer DEFAULT 7 NOT NULL,
	`pending_streak_reset_after` text,
	`notification_id` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `habits_archived_idx` ON `habits` (`is_archived`);--> statement-breakpoint
CREATE INDEX `habits_frequency_idx` ON `habits` (`frequency`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`timestamp` text NOT NULL,
	`updated_at` text NOT NULL,
	`pending_actions` text,
	`is_confirmed` integer,
	`is_expired` integer
);
--> statement-breakpoint
CREATE INDEX `messages_timestamp_idx` ON `messages` (`timestamp`);--> statement-breakpoint
CREATE INDEX `messages_sender_idx` ON `messages` (`sender`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`due_date` integer,
	`reminder_date` integer,
	`reminder` integer DEFAULT false NOT NULL,
	`notification_id` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`tags` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_completed_idx` ON `tasks` (`completed`);--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_category_idx` ON `tasks` (`category`);--> statement-breakpoint
CREATE TABLE `timer_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration` integer,
	`category` text,
	`laps` text,
	`is_partial` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `timer_logs_category_idx` ON `timer_logs` (`category`);--> statement-breakpoint
CREATE INDEX `timer_logs_start_time_idx` ON `timer_logs` (`start_time`);