CREATE TABLE `timer_tags` (
	`log_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`log_id`, `tag_id`),
	FOREIGN KEY (`log_id`) REFERENCES `timer_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_timer_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration` integer,
	`category` text,
	`tags` text,
	`laps` text,
	`is_partial` integer DEFAULT false,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_timer_logs`("id", "title", "start_time", "end_time", "duration", "category", "tags", "laps", "is_partial", "created_at", "updated_at") SELECT "id", "title", "start_time", "end_time", "duration", "category", "tags", "laps", "is_partial", "created_at", "updated_at" FROM `timer_logs`;--> statement-breakpoint
DROP TABLE `timer_logs`;--> statement-breakpoint
ALTER TABLE `__new_timer_logs` RENAME TO `timer_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `timer_logs_category_idx` ON `timer_logs` (`category`);--> statement-breakpoint
CREATE INDEX `timer_logs_start_time_idx` ON `timer_logs` (`start_time`);