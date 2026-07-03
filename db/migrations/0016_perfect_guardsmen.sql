ALTER TABLE `achievement_global_metrics` RENAME COLUMN "habits_streak_max" TO "habits_streak_max_daily";--> statement-breakpoint
ALTER TABLE `daily_metrics` RENAME COLUMN "habits_streak_max" TO "habits_streak_max_daily";--> statement-breakpoint
ALTER TABLE `global_metrics` RENAME COLUMN "habits_streak_max" TO "habits_streak_max_daily";--> statement-breakpoint
ALTER TABLE `achievement_global_metrics` ADD `habits_checked_in_before_8am` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `achievement_global_metrics` ADD `habits_checked_in_after_10pm` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `achievement_global_metrics` ADD `habits_streak_max_weekly` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `habits_checked_in_before_8am` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `habits_checked_in_after_10pm` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_metrics` ADD `habits_streak_max_weekly` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `habits_checked_in_before_8am` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `habits_checked_in_after_10pm` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `global_metrics` ADD `habits_streak_max_weekly` integer DEFAULT 0 NOT NULL;