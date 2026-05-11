CREATE TABLE `habit_tags` (
	`habit_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`habit_id`, `tag_id`),
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`end_date` text,
	`description` text,
	`reminder` integer DEFAULT false NOT NULL,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`category` text,
	`tags` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_calendar_events`("id", "title", "start_date", "start_time", "end_time", "end_date", "description", "reminder", "recurrence", "category", "tags", "embedding", "created_at", "updated_at") SELECT "id", "title", "start_date", "start_time", "end_time", "end_date", "description", "reminder", "recurrence", "category", "tags", "embedding", "created_at", "updated_at" FROM `calendar_events`;--> statement-breakpoint
DROP TABLE `calendar_events`;--> statement-breakpoint
ALTER TABLE `__new_calendar_events` RENAME TO `calendar_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `calendar_events_start_date_idx` ON `calendar_events` (`start_date`);--> statement-breakpoint
CREATE TABLE `__new_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`reminder` integer DEFAULT false NOT NULL,
	`reminder_date` text,
	`target_days` text,
	`streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`streak_freezes` integer DEFAULT 1 NOT NULL,
	`goal` integer DEFAULT 7 NOT NULL,
	`pending_streak_reset_after` text,
	`notification_id` text,
	`category` text,
	`tags` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_habits`("id", "title", "frequency", "reminder", "reminder_date", "target_days", "streak", "longest_streak", "streak_freezes", "goal", "pending_streak_reset_after", "notification_id", "category", "tags", "embedding", "created_at", "updated_at") SELECT "id", "title", "frequency", "reminder", "reminder_date", "target_days", "streak", "longest_streak", "streak_freezes", "goal", "pending_streak_reset_after", "notification_id", "category", "tags", "embedding", "created_at", "updated_at" FROM `habits`;--> statement-breakpoint
DROP TABLE `habits`;--> statement-breakpoint
ALTER TABLE `__new_habits` RENAME TO `habits`;--> statement-breakpoint
CREATE INDEX `habits_frequency_idx` ON `habits` (`frequency`);--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`due_date` text NOT NULL,
	`reminder_date` text,
	`reminder` integer DEFAULT false NOT NULL,
	`notification_id` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`tags` text,
	`embedding` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "description", "category", "due_date", "reminder_date", "reminder", "notification_id", "priority", "completed", "completed_at", "tags", "embedding", "created_at", "updated_at") SELECT "id", "title", "description", "category", "due_date", "reminder_date", "reminder", "notification_id", "priority", "completed", "completed_at", "tags", "embedding", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
CREATE INDEX `tasks_completed_idx` ON `tasks` (`completed`);--> statement-breakpoint
CREATE INDEX `tasks_due_date_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_category_idx` ON `tasks` (`category`);