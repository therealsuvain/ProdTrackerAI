ALTER TABLE `calendar_events` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `timer_logs` ADD `deleted_at` text;