ALTER TABLE `achievement_global_metrics` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `achievement_global_metrics` ADD `synced_snapshot` text;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `synced_snapshot` text;--> statement-breakpoint
ALTER TABLE `daily_metrics_ai` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `daily_metrics_ai` ADD `synced_snapshot` text;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `synced_snapshot` text;--> statement-breakpoint
ALTER TABLE `global_metrics_ai` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `global_metrics_ai` ADD `synced_snapshot` text;