DROP INDEX `categories_name_unique`;--> statement-breakpoint
ALTER TABLE `categories` ADD `normalized_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
DROP INDEX `tags_name_unique`;--> statement-breakpoint
ALTER TABLE `tags` ADD `normalized_name` text DEFAULT '' NOT NULL;