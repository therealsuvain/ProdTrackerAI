ALTER TABLE `calendar_events` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `categories` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `tags` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `timer_logs` ADD `synced_at` text;