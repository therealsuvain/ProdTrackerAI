DROP INDEX `habits_archived_idx`;--> statement-breakpoint
ALTER TABLE `habits` ADD `category` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `habits` DROP COLUMN `is_archived`;--> statement-breakpoint
ALTER TABLE `habits` DROP COLUMN `archived_at`;--> statement-breakpoint
ALTER TABLE `calendar_events` ADD `tags` text;