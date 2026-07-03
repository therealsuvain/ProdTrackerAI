ALTER TABLE `achievement_global_metrics` ADD `tags_added` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `tags_added` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `tags_added` integer DEFAULT 0 NOT NULL;