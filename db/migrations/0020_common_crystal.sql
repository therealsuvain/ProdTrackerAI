ALTER TABLE `achievement_global_metrics` RENAME COLUMN "last_synced_at" TO "synced_at";--> statement-breakpoint
ALTER TABLE `global_metrics` RENAME COLUMN "last_synced_at" TO "synced_at";--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `daily_metrics_ai` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `global_metrics_ai` ADD `synced_at` text;--> statement-breakpoint
ALTER TABLE `unlocked_achievements` ADD `synced_at` text;